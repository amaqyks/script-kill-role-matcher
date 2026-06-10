// ── Agent 编排器（ReAct 模式） ──
// Agent 循环：分析用户意图 → 选择工具 → 执行 → 观察结果 → 回复或继续

import { TOOL_DEFINITIONS, executeTool } from "./tools.js";
import * as vs from "../rag/vectorStore.js";
import { buildKnowledgeDocs } from "../rag/knowledgeBase.js";

const SYSTEM_PROMPT = `你是「剧本杀AI选角助手」——一个专为剧本杀玩家推荐角色的智能Agent。

## 你的能力
你可以使用以下工具：
- search_script: 搜索剧本的公开测评和角色信息
- retrieve_knowledge: 从知识库检索角色特征信息
- analyze_user_persona: 分析用户的MBTI/星座/标签等画像
- recommend_roles: 根据画像和角色信息打分推荐
- compare_roles: 对比多个角色的差异

## 工作原则
1. 证据优先：只基于工具返回的真实信息推荐，绝不胡编角色
2. 多维度驱动：结合用户画像（MBTI/星座/偏好）、历史角色记录、当前对话来综合推荐
3. 主动追问：当信息不足以做精准推荐时，生成 2-3 个有针对性的问题帮助缩小范围
4. 循序渐进：先确认剧本→了解用户→结合历史记录→检索角色→对比推荐→说明原因
5. 完整输出：推荐时必须包含角色名、分数、推荐原因、注意事项、备选方案

## 典型对话流程
1. 用户说"帮我选告别诗的角色"
2. 你先 retrieve_knowledge("告别诗") 了解角色
3. 再 analyze_user_persona 分析用户画像（含历史角色记录的偏好模式）
4. 用 recommend_roles 给出推荐
5. 如果用户犹豫，用 compare_roles 做对比
6. 如果用户只说了想玩什么类型但没说具体剧本，先用历史记录推断偏好，再追问

## 输出格式
用自然的中文回复，包含：
- 🎭 角色推荐 + 匹配分数
- ✅ 推荐原因（特征匹配、情感线匹配等）
- ⚠️ 注意事项（雷点、反串等）
- 📋 备选方案

如果信息不足，宁可追问也不要瞎编。`;

const MODEL = "google/gemini-2.5-flash";
const MAX_TOOL_CALLS = 6;

/**
 * 初始化 Agent：建立知识库索引
 */
let initialized = false;
export async function initAgent() {
  if (initialized) return;
  await vs.init();

  const stats = vs.getStats();
  if (stats.count === 0) {
    console.log("Indexing knowledge base...");
    const docs = buildKnowledgeDocs();
    await vs.addBatch(docs.map(d => ({ text: d.text, meta: d.meta })));
    await vs.save();
    console.log(`Indexed ${docs.length} documents`);
  }
  initialized = true;
}

/**
 * Agent 对话入口
 * @param {string} userMessage - 用户输入
 * @param {object} context - 会话上下文 { history, userProfile, roleRecords }
 * @returns {object} { reply, toolCalls, error }
 */
export async function chat(userMessage, context = {}) {
  await initAgent();

  if (!process.env.OPENROUTER_API_KEY) {
    return {
      reply: "🔑 需要配置 OpenRouter API Key 才能使用 Agent 功能。\n\n请在终端设置：\n`$env:OPENROUTER_API_KEY=\"你的密钥\"`\n然后重启服务。\n\n获取密钥：https://openrouter.ai/keys",
      error: "no_api_key"
    };
  }

  const messages = buildMessages(userMessage, context);
  let loopCount = 0;

  while (loopCount < MAX_TOOL_CALLS) {
    loopCount++;
    const response = await callLLM(messages);

    const choice = response.choices?.[0]?.message;
    if (!choice) return { reply: "Agent 响应异常，请重试。" };

    // 有工具调用
    if (choice.tool_calls?.length) {
      messages.push(choice);

      for (const tc of choice.tool_calls) {
        const args = JSON.parse(tc.function.arguments || "{}");
        const result = await executeTool(tc.function.name, args);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result)
        });
      }
      continue; // 继续循环，让 LLM 处理工具结果
    }

    // 无工具调用：最终回复
    return { reply: choice.content || "", toolCalls: loopCount - 1 };
  }

  // 超出最大工具调用次数，强制生成回复
  messages.push({ role: "user", content: "请根据已收集的信息直接给出推荐回复。" });
  const final = await callLLM(messages);
  return { reply: final.choices?.[0]?.message?.content || "处理超时，请简化问题重试。" };
}

function buildMessages(userMessage, context) {
  const msgs = [{ role: "system", content: SYSTEM_PROMPT }];

  // 注入用户画像上下文（如果有）
  if (context.userProfile) {
    msgs.push({ role: "system", content: buildPersonaContext(context.userProfile) });
  }

  // 注入角色记录上下文（如果有）
  if (context.roleRecords?.length) {
    msgs.push({ role: "system", content: buildRecordsContext(context.roleRecords) });
  }

  // 注入历史消息
  if (context.history?.length) {
    msgs.push(...context.history.slice(-10));
  }

  msgs.push({ role: "user", content: userMessage });
  return msgs;
}

function buildPersonaContext(up) {
  const parts = [];
  if (up.gender) parts.push(`性别偏好：${up.gender}`);
  if (up.crossGender) parts.push(`反串态度：${up.crossGender === "yes" ? "接受" : up.crossGender === "maybe" ? "可考虑" : "不接受"}`);
  if (up.mbti) parts.push(`MBTI：${up.mbti}`);
  if (up.zodiac) parts.push(`星座/标签：${up.zodiac}`);
  if (up.preferredLines?.length) parts.push(`偏好情感线：${up.preferredLines.join("、")}`);
  if (up.preferredTraits?.length) parts.push(`偏好角色气质：${up.preferredTraits.join("、")}`);
  if (up.avoidTags?.length) parts.push(`雷区：${up.avoidTags.join("、")}`);
  if (up.freeText) parts.push(`补充说明：${up.freeText}`);
  return parts.length ? `当前用户画像：\n${parts.join("\n")}` : "用户尚未填写画像。";
}

function buildRecordsContext(records) {
  const lines = records.map(r => {
    const bits = [`· ${r.script} — ${r.role}（${r.rating}分）`];
    if (r.tags?.length) bits.push(`标签：${r.tags.join("、")}`);
    if (r.review) bits.push(`评价：${r.review}`);
    return bits.join(" | ");
  });
  return `用户历史角色记录（共 ${records.length} 条）：\n${lines.join("\n")}\n\n请根据这些记录分析用户的偏好模式：高分角色共有的情感线/气质特征、低分角色的雷区，在推荐和追问时参考。`;
}

async function callLLM(messages) {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:4173",
      "X-Title": "ScriptKillAgent"
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 3000
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`LLM API error ${resp.status}: ${err}`);
  }
  return resp.json();
}