import { searchPublicSummaries } from "./searchAgent.js";

const TRAIT_WORDS = [
  "敏感", "隐忍", "克制", "缺爱", "高共情", "外放", "主动", "热烈",
  "理性", "沉稳", "守护", "责任感", "慢热", "压抑", "懂事", "独立",
  "自尊", "防备", "破防", "强势", "温柔", "疯批", "清醒", "恋爱脑"
];

const LINE_WORDS = ["爱情", "亲情", "友情", "救赎", "成长", "遗憾", "家国", "事业", "师徒", "群像"];
const RISK_WORDS = ["卑微", "背叛", "出轨", "原生家庭", "家庭痛点", "牺牲", "死亡", "霸凌", "边缘", "恋爱脑", "输出"];
const NPC_HINTS = ["NPC", "npc", "非玩家", "主持人", "DM", "dm", "店家", "发行", "作者", "老板", "工作人员"];
const PLAYER_HINTS = ["玩家角色", "可选角色", "角色推荐", "选角", "男角色", "女角色", "人物介绍", "角色介绍"];

export { searchPublicSummaries };

export function profileRoles(scriptName, sources) {
  if (process.env.OPENROUTER_API_KEY && sources.length > 0) {
    return profileRolesWithLLM(scriptName, sources);
  }
  return profileRolesRegex(scriptName, sources);
}

function profileRolesRegex(scriptName, sources) {
  const candidates = new Map();

  for (const source of sources) {
    const text = (source.title || "") + "。" + (source.summary || "");
    for (const candidate of extractCandidateNames(text)) {
      const context = contextAround(text, candidate);
      if (!isValidCandidate(candidate, context)) continue;

      const current = candidates.get(candidate) || emptyRole(candidate);
      current.evidence.push({
        platform: source.platform,
        title: source.title,
        url: source.url,
        quote: context
      });
      merge(current.traits, extractWords(context, TRAIT_WORDS));
      merge(current.emotionalLines, extractWords(context, LINE_WORDS));
      merge(current.riskPoints, extractWords(context, RISK_WORDS));
      const gender = inferGender(context);
      if (current.gender === "未知" && gender !== "未知") current.gender = gender;
      const roleType = inferRoleType(context);
      if (roleType === "player" || current.roleType !== "player") current.roleType = roleType;
      candidates.set(candidate, current);
    }
  }

  return buildProfile(scriptName, sources, candidates);
}

async function profileRolesWithLLM(scriptName, sources) {
  const sourceText = sources
    .map((s, i) => "[" + (i + 1) + "] " + s.platform + ": " + s.title + "\n" + s.summary)
    .join("\n\n");

  const prompt = "你是一个剧本杀数据分析助手。请根据以下公开网页摘要，提取\"" + scriptName + "\"中可选的玩家角色信息。\n\n要求：\n- 只从来源文本中提取角色，不要编造\n- 排除明确标注为 NPC、DM、主持人、店家、作者的角色\n- 每个角色提取：角色名、性别（男/女/未知）、性格特征、情感线类型、风险点、适合的玩家类型描述\n- 输出严格 JSON 格式\n\n来源文本：\n" + sourceText.slice(0, 4000) + "\n\n请输出 JSON：{\"roles\":[{\"name\":\"角色名\",\"gender\":\"男|女|未知\",\"traits\":[\"特征1\"],\"emotionalLines\":[\"爱情\"],\"riskPoints\":[],\"suitablePlayers\":[\"描述\"],\"evidenceIndexes\":[1]}]}";

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.OPENROUTER_API_KEY,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:4173",
        "X-Title": "ScriptKillRoleMatcher"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 3000
      })
    });

    if (!response.ok) throw new Error("LLM 请求失败：" + response.status);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return profileRolesRegex(scriptName, sources);

    const parsed = JSON.parse(jsonMatch[0]);
    const llmRoles = (parsed.roles || []).filter((r) => r.name?.length >= 2);
    if (llmRoles.length === 0) return profileRolesRegex(scriptName, sources);

    const candidates = new Map();
    for (const llmRole of llmRoles) {
      const role = emptyRole(llmRole.name);
      role.gender = llmRole.gender || "未知";
      role.traits = llmRole.traits || [];
      role.emotionalLines = llmRole.emotionalLines || [];
      role.riskPoints = llmRole.riskPoints || [];
      role.suitablePlayers = llmRole.suitablePlayers || [];
      role.roleType = "player";

      for (const idx of (llmRole.evidenceIndexes || [])) {
        const src = sources[idx - 1];
        if (src) role.evidence.push({ platform: src.platform, title: src.title, url: src.url, quote: src.summary?.slice(0, 200) || "" });
      }

      if (role.evidence.length === 0) {
        for (const src of sources) {
          if ((src.title + " " + src.summary).includes(role.name)) {
            role.evidence.push({ platform: src.platform, title: src.title, url: src.url, quote: src.summary?.slice(0, 200) || "" });
          }
        }
      }

      candidates.set(role.name, role);
    }

    return buildProfile(scriptName, sources, candidates, "llm");
  } catch (err) {
    console.warn("LLM 角色提取失败，回退到正则模式:", err.message);
    return profileRolesRegex(scriptName, sources);
  }
}

function buildProfile(scriptName, sources, candidates, extractMethod = "regex") {
  const roles = [...candidates.values()]
    .filter((role) => role.roleType !== "npc")
    .filter((role) => role.evidence.length >= 1)
    .map(finalizeRole)
    .sort((a, b) => b.evidence.length - a.evidence.length);

  return {
    scriptName,
    extractMethod,
    confidence: calculateConfidence(sources, roles),
    roles,
    missing: buildMissingMessages(sources, roles),
    sourceCount: sources.length,
    guardrails: [
      "不使用预设角色库",
      "不生成来源中没有出现的人物",
      "不把明确标注为 NPC/DM/非玩家的角色纳入推荐",
      "性别与是否接受反串在匹配阶段优先处理"
    ]
  };
}

function extractCandidateNames(text) {
  const names = new Set();
  const patterns = [
    /(?:角色|人物|玩家角色|可选角色|男角色|女角色)[：:\s]+([一-鿿]{2,4})/g,
    /([一-鿿]{2,4})[：:（(](?:男|女|男性|女性|男生|女生)[）:)]?/g,
    /(?:推荐|选|拿到|体验)([一-鿿]{2,4})(?:这个角色|这角色)/g,
    /([一-鿿]{2,4})(?:适合|合适|是)(?:高共情|爱情线|亲情线|友情线|成长线|输出|隐忍|外放|克制)/g
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      names.add(match[1]);
    }
  }
  return [...names];
}

function isValidCandidate(name, context) {
  if (!/^[一-鿿]{2,4}$/.test(name)) return false;
  if (/剧本|情感|角色|玩家|测评|复盘|推荐|体验|适合|公开|资料|搜索|配置|介绍|喜欢|能吃|这个|那个|男性|女性|女生|男生/.test(name)) return false;
  if (NPC_HINTS.some((hint) => context.includes(hint))) return false;
  return PLAYER_HINTS.some((hint) => context.includes(hint)) || inferGender(context) !== "未知";
}

function emptyRole(name) {
  return {
    name,
    gender: "未知",
    roleType: "uncertain-player",
    traits: [],
    emotionalLines: [],
    suitablePlayers: [],
    riskPoints: [],
    evidence: []
  };
}

function finalizeRole(role) {
  return {
    ...role,
    suitablePlayers: buildSuitablePlayers(role),
    confidence: role.evidence.length >= 3 ? "高" : role.evidence.length >= 2 ? "中" : "低"
  };
}

function buildSuitablePlayers(role) {
  const result = [];
  if (role.emotionalLines.includes("爱情")) result.push("想体验爱情线");
  if (role.emotionalLines.includes("亲情")) result.push("能接受亲情/家庭线");
  if (role.emotionalLines.includes("友情")) result.push("重视友情或群像关系");
  if (role.traits.some((item) => ["隐忍", "克制", "敏感", "慢热"].includes(item))) result.push("偏沉浸、慢热、高共情");
  if (role.traits.some((item) => ["外放", "主动", "热烈", "强势"].includes(item))) result.push("偏外放、愿意输出");
  return result;
}

function inferGender(context) {
  if (/[：:（(](?:女|女性|女生)[）:)]?/.test(context)) return "女";
  if (/[：:（(](?:男|男性|男生)[）:)]?/.test(context)) return "男";
  if (/女角色|女性角色|女生角色|女玩家|女本体|女[，。；\s]/.test(context)) return "女";
  if (/男角色|男性角色|男生角色|男玩家|男本体|男[，。；\s]/.test(context)) return "男";
  return "未知";
}

function inferRoleType(context) {
  if (NPC_HINTS.some((hint) => context.includes(hint))) return "npc";
  if (PLAYER_HINTS.some((hint) => context.includes(hint))) return "player";
  return "uncertain-player";
}

function extractWords(text, dictionary) {
  return dictionary.filter((word) => text.includes(word));
}

function merge(target, values) {
  for (const value of values) {
    if (!target.includes(value)) target.push(value);
  }
}

function contextAround(text, name) {
  const sentences = text
    .split(/[。；;,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.includes(name));
  const best = sentences.find(
    (s) =>
      /[（(](?:男|女|男性|女性|男生|女生)[）)]|[：:](?:男|女|男性|女性|男生|女生)/.test(s) ||
      /[：:]?(?:敏感|高共情|隐忍|外放|克制|强势|温柔|理智|守护|独立|主动)/.test(s)
  ) || sentences[0];
  if (best) return best.slice(0, 180);

  const index = text.indexOf(name);
  if (index < 0) return text.slice(0, 160);
  return text.slice(Math.max(0, index - 60), Math.min(text.length, index + 140)).trim();
}

function calculateConfidence(sources, roles) {
  const realSources = sources.filter((source) => source.confidence === "search" || source.confidence === "llm");
  if (roles.length >= 4 && realSources.length >= 6 && roles.every((role) => role.gender !== "未知")) return "高";
  if (roles.length >= 2 && realSources.length >= 3) return "中";
  return "低";
}

function buildMissingMessages(sources, roles) {
  const messages = [];
  if (sources.some((source) => source.confidence === "no-api-key")) {
    messages.push("尚未配置搜索密钥。请设置 OPENROUTER_API_KEY（推荐，AI 搜索社交平台）或 BING_SEARCH_API_KEY。");
  }
  if (sources.some((source) => source.confidence === "no-results")) {
    messages.push("未在任何来源中找到该剧本的角色资料。");
  }
  if (sources.some((source) => source.confidence === "missing-search-key")) {
    messages.push("尚未配置公开网页搜索密钥，系统没有真实来源可用。");
  }
  if (!roles.length) {
    messages.push("未从公开摘要中识别出可选玩家角色。为避免胡编，系统不会生成追问或推荐。");
  }
  if (roles.some((role) => role.gender === "未知")) {
    messages.push("部分角色性别未知，推荐时会降低置信度；建议补充官方角色表或更完整公开资料。");
  }
  return messages;
}