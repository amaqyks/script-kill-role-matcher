// ── 嵌入层 ──
// 通过 OpenRouter 调用嵌入模型，或使用本地轻量 fallback

const EMBED_MODEL = "google/text-embedding-004";
const EMBED_DIM = 768;

// 本地关键词权重 fallback（无需 API，基于角色特征词构建稀疏向量）
const FEATURE_VOCAB = [
  "敏感","隐忍","克制","缺爱","高共情","外放","主动","热烈",
  "理性","沉稳","守护","责任感","慢热","压抑","懂事","独立",
  "自尊","防备","破防","强势","温柔","疯批","清醒","恋爱脑",
  "爱情","亲情","友情","救赎","成长","遗憾","家国","事业","师徒","群像",
  "卑微","背叛","出轨","原生家庭","家庭痛点","牺牲","死亡","霸凌","边缘","输出",
  "剧本杀","情感本","欢乐本","机制本","恐怖本","推理本","阵营本",
  "女","男","反串","菠萝头","水龙头","社牛","社恐"
];

/**
 * 生成文本的嵌入向量
 * 优先用 OpenRouter API，fallback 用本地关键词向量
 */
export async function embed(text) {
  if (process.env.OPENROUTER_API_KEY) {
    try { return await embedRemote(text); } catch (e) { console.warn("Remote embed failed, using local:", e.message); }
  }
  return embedLocal(text);
}

/**
 * 批量嵌入
 */
export async function embedBatch(texts) {
  if (process.env.OPENROUTER_API_KEY) {
    try { return await embedRemoteBatch(texts); } catch (e) { console.warn("Remote batch embed failed, using local:", e.message); }
  }
  return texts.map(t => embedLocal(t));
}

async function embedRemote(text) {
  const resp = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:4173",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 2000) })
  });
  if (!resp.ok) throw new Error(`Embed API error: ${resp.status}`);
  const data = await resp.json();
  return data.data?.[0]?.embedding || embedLocal(text);
}

async function embedRemoteBatch(texts) {
  const resp = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:4173",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts.map(t => t.slice(0, 2000)) })
  });
  if (!resp.ok) throw new Error(`Embed API error: ${resp.status}`);
  const data = await resp.json();
  return (data.data || []).map(d => d.embedding || new Array(EMBED_DIM).fill(0));
}

/**
 * 本地关键词向量：将文本映射到 FEATURE_VOCAB 的稀疏向量
 * 不依赖外部 API，保证离线可用
 */
function embedLocal(text) {
  const lower = text.toLowerCase();
  const vec = new Array(FEATURE_VOCAB.length).fill(0);
  for (let i = 0; i < FEATURE_VOCAB.length; i++) {
    // 统计关键词出现次数作为权重
    const word = FEATURE_VOCAB[i];
    let count = 0;
    let pos = lower.indexOf(word);
    while (pos !== -1) { count++; pos = lower.indexOf(word, pos + word.length); }
    vec[i] = Math.min(count, 5) / 5; // 归一化到 [0,1]
  }
  // 稠密化：用简单 hash 扩展到目标维度
  return densify(vec, EMBED_DIM);
}

function densify(sparse, dim) {
  const dense = new Array(dim).fill(0);
  for (let i = 0; i < sparse.length; i++) {
    if (sparse[i] === 0) continue;
    // 将每个稀疏维度扩散到多个稠密维度
    const hash = Math.abs(hashStr(FEATURE_VOCAB[i])) % dim;
    for (let j = 0; j < 8; j++) {
      const r = ((hash * (j + 1) * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      dense[(hash + j * 97) % dim] += sparse[i] * (0.5 + r * 0.1);
    }
  }
  // L2 归一化
  const norm = Math.sqrt(dense.reduce((s, v) => s + v * v, 0)) || 1;
  return dense.map(v => v / norm);
}

function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; }

/** 余弦相似度 */
export function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}
