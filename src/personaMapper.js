// ── 画像映射层 ──
// 将 MBTI、星座、自定义标签转换为角色特征信号，
// 供 matchAgent 评分时使用。

// ---------- MBTI → 角色倾向 ----------
const MBTI_MAP = {
  // 分析家 (NT)
  INTJ: { traits: ["理智", "独立", "克制", "强势"], lines: ["事业", "成长"], style: "冷静主导型，擅长谋略角色", avoid: ["恋爱脑", "卑微感"] },
  INTP: { traits: ["理智", "慢热", "独立", "清醒"], lines: ["成长", "遗憾"], style: "内省型，适合复杂的内心挣扎角色", avoid: ["大量输出", "恋爱脑"] },
  ENTJ: { traits: ["强势", "主动", "责任感", "外放"], lines: ["家国", "事业", "师徒"], style: "领袖型，适合掌控全局的角色", avoid: ["卑微", "边缘"] },
  ENTP: { traits: ["外放", "主动", "清醒", "疯批"], lines: ["成长", "友情"], style: "反套路型，适合打破常规的角色", avoid: ["克制", "慢热"] },

  // 外交家 (NF)
  INFJ: { traits: ["高共情", "敏感", "克制", "守护"], lines: ["救赎", "遗憾", "友情"], style: "深度共情型，适合有使命感的角色", avoid: ["卑微感", "大量输出"] },
  INFP: { traits: ["高共情", "敏感", "慢热", "缺爱"], lines: ["爱情", "救赎", "遗憾"], style: "理想主义型，适合纯爱/虐恋线", avoid: ["强势", "背叛"] },
  ENFJ: { traits: ["高共情", "外放", "主动", "责任感"], lines: ["救赎", "友情", "成长"], style: "引导者型，适合影响他人的角色", avoid: ["卑微信", "边缘"] },
  ENFP: { traits: ["外放", "主动", "热情", "高共情"], lines: ["爱情", "友情", "救赎"], style: "快乐小狗型，适合多线互动的角色", avoid: ["克制", "理智"] },

  // 守护者 (SJ)
  ISTJ: { traits: ["理智", "责任感", "克制", "沉稳"], lines: ["家国", "事业", "守护"], style: "传统守护型，适合有原则的角色", avoid: ["疯批", "出轨"] },
  ISFJ: { traits: ["敏感", "守护", "温柔", "克制"], lines: ["亲情", "友情", "爱情"], style: "温柔奉献型，适合默默付出的角色", avoid: ["强势", "背叛"] },
  ESTJ: { traits: ["强势", "外放", "理性", "责任感"], lines: ["事业", "家国", "师徒"], style: "秩序维护型，适合领袖/家长角色", avoid: ["恋爱脑", "卑微"] },
  ESFJ: { traits: ["外放", "热情", "责任感", "温柔"], lines: ["亲情", "友情", "爱情"], style: "社牛管家型，适合照顾他人的角色", avoid: ["边缘", "疯批"] },

  // 探险家 (SP)
  ISTP: { traits: ["克制", "独立", "理智", "慢热"], lines: ["成长", "事业"], style: "技术冷静型，适合有技能的酷角色", avoid: ["恋爱脑", "大量输出"] },
  ISFP: { traits: ["敏感", "独立", "慢热", "清醒"], lines: ["成长", "遗憾", "爱情"], style: "艺术敏感型，适合唯美/虐心角色", avoid: ["强势", "家国"] },
  ESTP: { traits: ["外放", "主动", "热情", "强势"], lines: ["事业", "友情"], style: "行动派型，适合冲锋陷阵的角色", avoid: ["克制", "慢热"] },
  ESFP: { traits: ["外放", "热情", "主动", "高共情"], lines: ["爱情", "友情", "救赎"], style: "表演者型，适合中心位的角色", avoid: ["理智", "克制"] }
};

// ---------- 星座 → 情感倾向 ----------
const ZODIAC_MAP = {
  // 火象
  "白羊": { traits: ["主动", "外放", "热情"], lines: ["爱情", "成长"], style: "冲动直球型", avoid: ["慢热", "克制"] },
  "狮子": { traits: ["强势", "外放", "热情", "责任感"], lines: ["爱情", "事业", "守护"], style: "霸道主角型", avoid: ["卑微感", "边缘"] },
  "射手": { traits: ["外放", "主动", "独立"], lines: ["友情", "成长", "救赎"], style: "自由探索型", avoid: ["克制", "原生家庭痛点"] },

  // 土象
  "金牛": { traits: ["慢热", "克制", "责任感", "守护"], lines: ["友情", "事业", "亲情"], style: "持久输出型", avoid: ["疯批", "大量输出"] },
  "处女": { traits: ["理智", "克制", "敏感", "责任感"], lines: ["成长", "友情", "事业"], style: "细节扣人心型", avoid: ["疯批", "恋爱脑"] },
  "摩羯": { traits: ["理性", "克制", "独立", "责任感"], lines: ["事业", "家国", "遗憾"], style: "深沉隐忍型", avoid: ["恋爱脑", "大量输出"] },

  // 风象
  "双子": { traits: ["外放", "主动", "清醒"], lines: ["友情", "成长"], style: "多变社交型", avoid: ["克制", "慢热"] },
  "天秤": { traits: ["理智", "温柔", "清醒"], lines: ["爱情", "友情"], style: "优雅平衡型", avoid: ["疯批", "强势"] },
  "水瓶": { traits: ["独立", "理智", "清醒"], lines: ["友情", "事业", "救赎"], style: "思想独立型", avoid: ["恋爱脑", "卑微感"] },

  // 水象
  "巨蟹": { traits: ["温柔", "敏感", "守护", "缺爱"], lines: ["亲情", "爱情", "守护"], style: "细心照顾型", avoid: ["强势", "背叛"] },
  "天蝎": { traits: ["克制", "敏感", "强势", "缺爱"], lines: ["爱情", "救赎", "遗憾"], style: "极致投入型，适合虐恋/暗黑", avoid: ["恋爱脑", "背叛"] },
  "双鱼": { traits: ["高共情", "敏感", "缺爱", "温柔"], lines: ["爱情", "救赎", "遗憾"], style: "浪漫幻想型，适合纯爱/守护", avoid: ["强势", "理智"] }
};

// ---------- 自定义标签 → 信号词 ----------
const TAG_SIGNALS = {
  "水龙头": { traits: ["高共情", "敏感", "温柔"], lines: ["爱情", "遗憾"] },
  "菠萝头": { traits: ["理智", "克制", "独立"], lines: ["事业", "家国"] },
  "戏精": { traits: ["外放", "主动", "热情"], lines: ["爱情", "友情"] },
  "推土机": { traits: ["理智", "强势", "主动"], lines: ["事业", "成长"] },
  "硬核": { traits: ["理智", "独立", "强势"], lines: ["事业", "家国"] },
  "情感喷泉": { traits: ["高共情", "敏感", "外放", "缺爱"], lines: ["爱情", "救赎", "遗憾"] },
  "外冷内热": { traits: ["克制", "敏感", "慢热"], lines: ["爱情", "成长", "守护"] },
  "社恐": { traits: ["慢热", "克制", "独立", "敏感"], lines: ["友情", "成长"] },
  "社牛": { traits: ["外放", "主动", "热情"], lines: ["友情", "爱情"] },
  "恋爱脑": { traits: ["缺爱", "敏感", "高共情"], lines: ["爱情"], avoid: ["理智"] },
  "事业批": { traits: ["强势", "理智", "独立", "责任感"], lines: ["事业", "家国"] },
  "疯批美人": { traits: ["疯批", "强势", "外放"], lines: ["爱情", "救赎"], avoid: ["克制", "理智"] }
};

/**
 * 从用户画像中提取所有角色特征信号
 * @param {Object} userProfile - { mbti, zodiac, preferredLines, preferredTraits, freeText, ... }
 * @returns {{ traits: string[], lines: string[], style: string, avoid: string[] }}
 */
export function extractPersonaSignals(userProfile = {}) {
  const traits = new Set();
  const lines = new Set();
  const styles = [];
  const avoid = new Set();

  // 1) MBTI 映射
  const mbti = String(userProfile.mbti || "").toUpperCase().trim();
  if (MBTI_MAP[mbti]) {
    MBTI_MAP[mbti].traits.forEach((t) => traits.add(t));
    MBTI_MAP[mbti].lines.forEach((l) => lines.add(l));
    styles.push(MBTI_MAP[mbti].style);
    MBTI_MAP[mbti].avoid?.forEach((a) => avoid.add(a));
  }

  // 2) 星座映射
  const zodiacText = String(userProfile.zodiac || "").trim();
  for (const [zodiac, data] of Object.entries(ZODIAC_MAP)) {
    if (zodiacText.includes(zodiac)) {
      data.traits.forEach((t) => traits.add(t));
      data.lines.forEach((l) => lines.add(l));
      styles.push(data.style);
      data.avoid?.forEach((a) => avoid.add(a));
    }
  }

  // 3) 自定义标签解析
  const freeText = String(userProfile.freeText || "");
  for (const [tag, data] of Object.entries(TAG_SIGNALS)) {
    if (freeText.includes(tag) || (userProfile.zodiac || "").includes(tag)) {
      data.traits?.forEach((t) => traits.add(t));
      data.lines?.forEach((l) => lines.add(l));
      data.avoid?.forEach((a) => avoid.add(a));
    }
  }

  // 4) 用户直接选的情感线和特质
  (userProfile.preferredLines || []).forEach((l) => lines.add(l));
  (userProfile.preferredTraits || []).forEach((t) => traits.add(t));
  (userProfile.avoidTags || []).forEach((a) => avoid.add(a));

  return {
    traits: [...traits],
    lines: [...lines],
    style: styles.join("；"),
    avoid: [...avoid]
  };
}

/**
 * 根据 MBTI 和星座生成玩家画像描述文本（供 LLM 或追问使用）
 */
export function describePersona(userProfile = {}) {
  const signals = extractPersonaSignals(userProfile);
  const mbti = String(userProfile.mbti || "").toUpperCase().trim() || "未填";
  const zodiac = String(userProfile.zodiac || "").trim() || "未填";

  return [
    `MBTI: ${mbti}`,
    `星座/标签: ${zodiac}`,
    `性格信号: ${signals.traits.join("、") || "无"}`,
    `情感线偏好: ${signals.lines.join("、") || "无"}`,
    `风格: ${signals.style || "未推断"}`,
    `雷区: ${signals.avoid.join("、") || "无"}`
  ].join("\n");
}
