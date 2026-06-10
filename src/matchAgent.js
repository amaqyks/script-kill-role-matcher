// ── 画像映射 ──
import { extractPersonaSignals, describePersona } from "./personaMapper.js";

const SIGNALS = {
  "爱情": ["爱情"],
  "亲情": ["亲情", "原生家庭", "家庭"],
  "友情": ["友情"],
  "成长": ["成长"],
  "救赎": ["救赎"],
  "遗憾": ["遗憾"],
  "隐忍克制": ["隐忍", "克制", "压抑", "慢热"],
  "主动外放": ["主动", "外放", "热烈", "输出"],
  "理性守护": ["理性", "守护", "责任感", "沉稳"],
  "外冷内热": ["防备", "独立", "自尊", "破防"],
  "高共情慢热": ["高共情", "敏感", "慢热", "缺爱"],
  "卑微感": ["卑微信", "缺爱", "恋爱脑"],
  "原生家庭痛点": ["原生家庭", "家庭痛点", "亲情"],
  "背叛/出轨": ["背叛", "出轨"],
  "大量输出": ["输出", "外放", "主动"],
  "角色边缘": ["边缘"],
  "恋爱脑": ["恋爱脑"]
};

export function matchRoles(profile, userProfile = {}, answers = {}) {
  const persona = extractPersonaSignals(userProfile);
  const eligible = (profile?.roles || []).map((role) => scoreRole(role, userProfile, answers, persona));
  const ranked = eligible.sort((a, b) => b.score - a.score);
  const recommended = ranked.find((item) => item.eligible) || null;

  return {
    scriptName: profile?.scriptName || "",
    confidence: profile?.confidence || "低",
    personaSummary: describePersona(userProfile),
    recommended,
    alternatives: ranked.filter((item) => item.eligible && item !== recommended).slice(0, 2),
    ineligible: ranked.filter((item) => !item.eligible),
    avoid: ranked[ranked.length - 1] || null,
    ranked
  };
}

function scoreRole(role, userProfile, answers, persona) {
  const roleSignals = unique([
    role.gender,
    ...role.traits,
    ...role.emotionalLines,
    ...role.suitablePlayers,
    ...role.riskPoints
  ]);

  let score = 42;
  let eligible = true;
  let reasons = [];
  let risks = [];

  // ── 画像层打分：MBTI/星座推导的特质匹配 ──
  const personaResult = evaluatePersona(role, persona);
  score += personaResult.score;
  reasons = reasons.concat(personaResult.reasons);
  risks = risks.concat(personaResult.risks);

  const genderResult = evaluateGender(role, userProfile);
  score += genderResult.score;
  eligible = genderResult.eligible;
  reasons.push(...genderResult.reasons);
  risks.push(...genderResult.risks);

  for (const value of flattenAnswers(answers)) {
    const weights = SIGNALS[value] || [value];
    const hit = weights.find((weight) => roleSignals.some((signal) => includesEither(signal, weight)));
    if (!hit) continue;

    if (isAvoidanceAnswer(value, answers)) {
      score -= 20;
      risks.push(`你选择避开"${value}"，而 ${role.name} 的公开信息里出现了相关信号"${hit}"。`);
    } else {
      score += 12;
      reasons.push(`你选择了"${value}"，与 ${role.name} 的"${hit}"信息相符。`);
    }
  }

  const userText = normalizeUserText(userProfile);
  for (const signal of roleSignals) {
    if (signal && userText.includes(signal)) {
      score += 6;
      reasons.push(`你的画像提到"${signal}"，与 ${role.name} 的公开角色信息重合。`);
    }
  }

  if (role.confidence === "低") {
    score -= 8;
    risks.push(`${role.name}目前只有少量公开证据，推荐置信度偏低。`);
  }

  return {
    role,
    eligible,
    score: Math.max(0, Math.min(99, Math.round(score))),
    reasons: unique(reasons).slice(0, 5),
    risks: unique(risks).slice(0, 4)
  };
}

// ── 画像匹配评分 ──
function evaluatePersona(role, persona) {
  const result = { score: 0, reasons: [], risks: [] };

  // 特质匹配
  for (const trait of persona.traits) {
    if (role.traits.includes(trait)) {
      result.score += 7;
      result.reasons.push(`你的画像特征"${trait}"与 ${role.name} 的性格标签一致`);
    }
  }

  // 情感线匹配
  for (const line of persona.lines) {
    if (role.emotionalLines.includes(line)) {
      result.score += 6;
      result.reasons.push(`你偏好的情感线"${line}"覆盖 ${role.name} 的主要剧情`);
    }
  }

  // 雷区检测
  for (const avoid of persona.avoid) {
    if (role.riskPoints.includes(avoid)) {
      result.score -= 10;
      result.risks.push(`${role.name} 的公开信息含雷区信号"${avoid}"，与你画像冲突`);
    }
  }

  // 风格描述重叠检测（模糊匹配）
  if (persona.style) {
    const roleText = [...role.traits, ...role.emotionalLines, ...role.suitablePlayers].join("，");
    const styleWords = persona.style.split(/[，、；;]/);
    for (const word of styleWords) {
      if (word.length >= 2 && roleText.includes(word)) {
        result.score += 3;
        result.reasons.push(`画像风格"${word}"与 ${role.name} 的定位有共鸣`);
      }
    }
  }

  return result;
}

function evaluateGender(role, userProfile) {
  const preferred = userProfile.gender || "不限";
  const crossGender = userProfile.crossGender || "no";
  const result = { score: 0, eligible: true, reasons: [], risks: [] };

  if (preferred === "不限") {
    result.reasons.push("你没有限制玩家性别，系统不会按性别排除角色。");
    return result;
  }

  if (role.gender === preferred) {
    result.score += 28;
    result.reasons.push(`${role.name}的公开资料性别为"${role.gender}"，符合你的优先性别要求。`);
    return result;
  }

  if (role.gender === "未知") {
    result.score -= 18;
    result.risks.push(`${role.name}的性别未能从公开资料确认，不能作为高置信推荐。`);
    return result;
  }

  if (crossGender === "yes" || crossGender === "maybe") {
    result.score += crossGender === "yes" ? 4 : -6;
    result.risks.push(`${role.name}需要反串：角色性别"${role.gender}"与你的优先性别"${preferred}"不一致。`);
    return result;
  }

  result.score -= 80;
  result.eligible = false;
  result.risks.push(`${role.name}因性别不匹配且你不接受反串，已从推荐中排除。`);
  return result;
}

function isAvoidanceAnswer(value, answers) {
  const avoidance = answers.avoidance;
  return Array.isArray(avoidance) ? avoidance.includes(value) : avoidance === value;
}

function flattenAnswers(answers) {
  return Object.values(answers).flat().filter(Boolean);
}

function normalizeUserText(userProfile) {
  return Object.values(userProfile).flat().filter(Boolean).join(" ").toLowerCase();
}

function includesEither(a, b) {
  return String(a).includes(b) || String(b).includes(a);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
