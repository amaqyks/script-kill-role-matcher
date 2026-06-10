// ── 文件向量库 ──
// 基于 JSON 文件持久化，内存中做余弦相似度检索

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { embed, embedBatch, cosineSimilarity } from "./embedder.js";

const DEFAULT_PATH = join(import.meta.dirname || ".", "../../data/vectors.json");

let store = null;      // { items: [{id, text, meta, vec}] }
let dirty = false;
let filePath = DEFAULT_PATH;

export async function init(pathOverride) {
  if (pathOverride) filePath = pathOverride;
  try {
    const raw = await readFile(filePath, "utf8");
    store = JSON.parse(raw);
    if (!store.items) store = { items: [] };
    console.log(`Vector store loaded: ${store.items.length} items`);
  } catch {
    store = { items: [] };
  }
  dirty = false;
}

export async function add(text, meta = {}) {
  if (!store) await init();
  const vec = await embed(text);
  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  store.items.push({ id, text: text.slice(0, 2000), meta, vec });
  dirty = true;
  return id;
}

export async function addBatch(entries) {
  if (!store) await init();
  const texts = entries.map(e => e.text);
  const vecs = await embedBatch(texts);
  const ids = [];
  for (let i = 0; i < entries.length; i++) {
    const id = `doc_${Date.now() + i}_${Math.random().toString(36).slice(2, 8)}`;
    store.items.push({ id, text: entries[i].text.slice(0, 2000), meta: entries[i].meta || {}, vec: vecs[i] || [] });
    ids.push(id);
  }
  dirty = true;
  return ids;
}

/**
 * 语义检索：返回 topK 个最相似文档
 */
export async function search(query, { topK = 5, minScore = 0.0, filterMeta = null } = {}) {
  if (!store) await init();
  const queryVec = await embed(query);

  const scored = store.items
    .map(item => {
      if (filterMeta && !matchMeta(item.meta, filterMeta)) return null;
      const score = cosineSimilarity(queryVec, item.vec);
      return { ...item, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.filter(item => item.score >= minScore);
}

/**
 * BM25 风格关键词检索（fallback，不依赖嵌入）
 */
export function keywordSearch(query, { topK = 5 } = {}) {
  if (!store) return [];
  const terms = query.split(/[\s，,。；;]+/).filter(t => t.length > 0).map(t => t.toLowerCase());

  const scored = store.items.map(item => {
    const text = (item.text + " " + JSON.stringify(item.meta)).toLowerCase();
    let score = 0;
    for (const term of terms) {
      let idx = text.indexOf(term);
      while (idx !== -1) { score++; idx = text.indexOf(term, idx + term.length); }
    }
    return { ...item, score };
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

/**
 * 混合检索：语义 + 关键词融合
 */
export async function hybridSearch(query, { topK = 5 } = {}) {
  const [semantic, keyword] = await Promise.all([
    search(query, { topK: topK * 2 }),
    Promise.resolve(keywordSearch(query, { topK: topK * 2 }))
  ]);

  // 合并去重，语义结果权重 0.7，关键词权重 0.3
  const merged = new Map();
  for (const item of semantic) merged.set(item.id, { ...item, score: item.score * 0.7 });
  for (const item of keyword) {
    if (merged.has(item.id)) merged.get(item.id).score += item.score * 0.3;
    else merged.set(item.id, { ...item, score: item.score * 0.3 });
  }

  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}


/**
 * 智能添加：如果已存在相似文档则更新，否则新增
 */
export async function upsert(text, meta = {}) {
  if (!store) await init();
  const hash = simpleHash(text);
  const existing = store.items.findIndex(item => item._hash === hash);
  const vec = await embed(text);
  const doc = { id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), text: text.slice(0, 2000), meta, vec, _hash: hash };
  if (existing >= 0) { store.items[existing] = doc; dirty = true; return { id: doc.id, action: 'updated' }; }
  store.items.push(doc); dirty = true; return { id: doc.id, action: 'inserted' };
}

export async function upsertBatch(entries) {
  if (!store) await init();
  const texts = entries.map(e => e.text);
  const vecs = await embedBatch(texts);
  const results = [];
  for (let i = 0; i < entries.length; i++) {
    const hash = simpleHash(entries[i].text);
    const existing = store.items.findIndex(item => item._hash === hash);
    const doc = { id: 'doc_' + (Date.now() + i) + '_' + Math.random().toString(36).slice(2, 8), text: entries[i].text.slice(0, 2000), meta: entries[i].meta || {}, vec: vecs[i] || [], _hash: hash };
    if (existing >= 0) { store.items[existing] = doc; results.push({ id: doc.id, action: 'updated' }); }
    else { store.items.push(doc); results.push({ id: doc.id, action: 'inserted' }); }
  }
  dirty = true; return results;
}

export function queryByMeta(filter, limit = 50) {
  if (!store) return [];
  return store.items.filter(item => matchMeta(item.meta, filter)).slice(0, limit);
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < Math.min(str.length, 500); i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
  return String(h);
}

export function getStats() {
  if (!store) return { count: 0, dirty: false };
  const scripts = [...new Set(store.items.map(i => i.meta?.script).filter(Boolean))];
  return { count: store.items.length, scripts, dirty };
}

export async function save() {
  if (!store || !dirty) return;
  await mkdir(new URL(".", `file://${filePath}`).pathname, { recursive: true }).catch(() => {});
  await writeFile(filePath, JSON.stringify(store), "utf8");
  dirty = false;
}

export async function clear() {
  store = { items: [] };
  dirty = true;
  await save();
}

function matchMeta(meta, filter) {
  return Object.entries(filter).every(([k, v]) => meta[k] === v);
}