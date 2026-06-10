// ── Agent 工具集 ──
// 将所有能力封装为 OpenRouter function-calling 兼容的工具定义

import { searchPublicSummaries } from "../searchAgent.js";
import { profileRoles } from "../roleProfiler.js";
import { generateQuestions } from "../questionAgent.js";
import { matchRoles } from "../matchAgent.js";
import { extractPersonaSignals, describePersona } from "../personaMapper.js";
import * as vs from "../rag/vectorStore.js";
import { findScript } from "../rag/knowledgeBase.js";

// ── 工具定义（OpenAI/OpenRouter Function Calling 格式） ──
export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_script",
      description: "搜索指定剧本在社交平台（小红书、迷圈、千岛、抖音）上的公开测评和角色信息。返回原始搜索结果。",
      parameters: {
        type: "object",
        properties: {
          scriptName: { type: "string", description: "剧本名称，如'告别诗'" }
        },
        required: ["scriptName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "retrieve_knowledge",
      description: "从本地知识库中检索剧本和角色的结构化信息。包含角色特征、情感线、适合玩家类型等。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索查询，如'适合高共情玩家的角色'或'告别诗 林星落'" },
          topK: { type: "integer", description: "返回结果数，默认5" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_user_persona",
      description: "分析用户画像：根据MBTI、星座、标签、偏好等推导角色特征信号。",
      parameters: {
        type: "object",
        properties: {
          mbti: { type: "string", description: "MBTI类型，如INFP" },
          zodiac: { type: "string", description: "星座或自定义标签，如'天蝎 水龙头'" },
          gender: { type: "string", enum: ["男", "女", "不限"] },
          crossGender: { type: "string", enum: ["no", "maybe", "yes"], description: "是否接受反串" },
          preferredLines: { type: "array", items: { type: "string" }, description: "偏好的情感线" },
          preferredTraits: { type: "array", items: { type: "string" }, description: "偏好的性格特征" },
          freeText: { type: "string", description: "自由描述" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "recommend_roles",
      description: "根据用户画像和剧本角色信息，打分推荐最适合的角色。返回推荐、备选、排除的角色及理由。",
      parameters: {
        type: "object",
        properties: {
          scriptName: { type: "string", description: "剧本名称" },
          gender: { type: "string", enum: ["男", "女", "不限"] },
          crossGender: { type: "string", enum: ["no", "maybe", "yes"] },
          mbti: { type: "string" },
          zodiac: { type: "string" },
          preferredLines: { type: "array", items: { type: "string" } },
          preferredTraits: { type: "array", items: { type: "string" } },
          avoidTags: { type: "array", items: { type: "string" } },
          freeText: { type: "string" },
          answers: { type: "object", description: "追问答案" }
        },
        required: ["scriptName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compare_roles",
      description: "对比两个或多个角色的差异，帮助玩家做选择。",
      parameters: {
        type: "object",
        properties: {
          scriptName: { type: "string" },
          roleNames: { type: "array", items: { type: "string" }, description: "要对比的角色名列表" }
        },
        required: ["scriptName", "roleNames"]
      }
    }
  }
];

// ── 工具执行器 ──
export async function executeTool(name, args) {
  switch (name) {
    case "search_script": return tool_searchScript(args);
    case "retrieve_knowledge": return tool_retrieveKnowledge(args);
    case "analyze_user_persona": return tool_analyzePersona(args);
    case "recommend_roles": return tool_recommendRoles(args);
    case "compare_roles": return tool_compareRoles(args);
    default: return { error: `Unknown tool: ${name}` };
  }
}

async function tool_searchScript({ scriptName }) {
  const sources = await searchPublicSummaries(scriptName);
  const real = sources.filter(s => s.confidence !== "no-api-key");
  if (!real.length) {
    const kb = findScript(scriptName);
    if (kb) {
      return {
        scriptName,
        from: "knowledge_base",
        result: {
          script: { name: kb.name, type: kb.type, players: kb.players, tags: kb.tags },
          roles: kb.roles.map(r => ({ name: r.name, gender: r.gender, traits: r.traits, emotionalLines: r.emotionalLines, summary: r.summary }))
        }
      };
    }
    return { scriptName, from: "none", result: null, message: "未找到该剧本信息。请检查剧本名称是否正确。" };
  }
  const profile = await profileRoles(scriptName, real);

  // ── 自动索引到 RAG 知识库 ──
  try {
    const toIndex = [];
    for (const src of real) {
      toIndex.push({
        text: `[${src.platform}] ${src.title}：${src.summary}`,
        meta: { type: "web_source", script: scriptName, platform: src.platform, source: "web_search" }
      });
    }
    for (const role of (profile.roles || [])) {
      toIndex.push({
        text: `【${scriptName}】${role.name}（${role.gender}）：性格 ${role.traits.join("、")}。情感线 ${role.emotionalLines.join("、")}。${role.suitablePlayers?.join("；") || ""}。雷点 ${role.riskPoints?.join("、") || "无"}。`,
        meta: { type: "role_detail", script: scriptName, role: role.name, gender: role.gender, source: "web_search" }
      });
    }
    if (toIndex.length) {
      const results = await vs.upsertBatch(toIndex);
      await vs.save();
      const inserted = results.filter(r => r.action === "inserted").length;
      const updated = results.filter(r => r.action === "updated").length;
      console.log(`RAG indexed: ${inserted} new + ${updated} updated for "${scriptName}"`);
    }
  } catch (err) {
    console.warn("RAG auto-index failed:", err.message);
  }

  const stats = vs.getStats();
  return { scriptName, from: "web_search", sources: real.slice(0, 5), profile, ragStats: stats };
}

async function tool_retrieveKnowledge({ query, topK = 5 }) {
  const results = await vs.hybridSearch(query, { topK });
  return {
    query,
    results: results.map(r => ({
      text: r.text,
      meta: r.meta,
      score: Math.round(r.score * 100) / 100
    }))
  };
}

function tool_analyzePersona(args) {
  const userProfile = {
    gender: args.gender || "不限",
    crossGender: args.crossGender || "no",
    mbti: args.mbti || "",
    zodiac: args.zodiac || "",
    preferredLines: args.preferredLines || [],
    preferredTraits: args.preferredTraits || [],
    freeText: args.freeText || ""
  };
  const signals = extractPersonaSignals(userProfile);
  const description = describePersona(userProfile);
  return { signals, description };
}

async function tool_recommendRoles(args) {
  const { scriptName, gender, crossGender, mbti, zodiac, preferredLines, preferredTraits, avoidTags, freeText, answers } = args;

  const userProfile = {
    gender: gender || "不限",
    crossGender: crossGender || "no",
    mbti: mbti || "",
    zodiac: zodiac || "",
    preferredLines: preferredLines || [],
    preferredTraits: preferredTraits || [],
    avoidTags: avoidTags || [],
    freeText: freeText || ""
  };

  // 先搜知识库
  const kb = findScript(scriptName);
  if (!kb) return { error: `未找到剧本"${scriptName}"的信息` };

  const profile = {
    scriptName,
    confidence: "中",
    roles: kb.roles.map(r => ({
      name: r.name,
      gender: r.gender,
      traits: r.traits,
      emotionalLines: r.emotionalLines,
      riskPoints: r.risks,
      suitablePlayers: r.suitableFor,
      evidence: [{ platform: "知识库", title: `${scriptName} - ${r.name}`, quote: r.summary }],
      confidence: "中"
    }))
  };

  const result = matchRoles(profile, userProfile, answers || {});
  return {
    scriptName,
    recommended: result.recommended ? {
      name: result.recommended.role.name,
      score: result.recommended.score,
      reasons: result.recommended.reasons,
      risks: result.recommended.risks
    } : null,
    alternatives: result.alternatives.map(a => ({ name: a.role.name, score: a.score })),
    ineligible: result.ineligible.map(a => ({ name: a.role.name, score: a.score, reason: a.risks?.[0] })),
    personaSummary: result.personaSummary
  };
}

async function tool_compareRoles({ scriptName, roleNames }) {
  const kb = findScript(scriptName);
  if (!kb) return { error: `未找到剧本"${scriptName}"` };

  const roles = kb.roles.filter(r => roleNames.includes(r.name));
  if (!roles.length) return { error: "未找到指定角色" };

  return {
    scriptName,
    comparison: roles.map(r => ({
      name: r.name,
      gender: r.gender,
      traits: r.traits,
      emotionalLines: r.emotionalLines,
      suitableFor: r.suitableFor,
      risks: r.risks,
      spotlight: r.spotlight,
      summary: r.summary
    }))
  };
}