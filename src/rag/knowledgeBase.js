// ── 剧本知识图谱 ──
// 结构化热门剧本的角色信息，供 RAG 检索和 Agent 使用
// 数据来源：小红书、迷圈、千岛、抖音公开测评整理

export const SCRIPT_KNOWLEDGE = [
  {
    name: "告别诗",
    type: "情感本",
    players: 6,
    genderSplit: "3男3女",
    difficulty: "新手友好",
    duration: "4-5小时",
    tags: ["校园", "青春", "虐恋", "救赎"],
    roles: [
      { name: "林星落", gender: "女", traits: ["敏感", "高共情", "缺爱", "克制"], emotionalLines: ["爱情", "亲情", "遗憾"], suitableFor: ["水龙头", "高共情", "能接受虐恋"], risks: ["原生家庭痛点", "卑微感"], spotlight: "情感C位，哭点密集", summary: "敏感缺爱的女主，爱情线与亲情线交织，后期情感爆发力极强。适合能哭、能代入的玩家。" },
      { name: "苏橙", gender: "女", traits: ["主动", "外放", "热烈", "强势"], emotionalLines: ["爱情", "救赎"], suitableFor: ["菠萝头", "主动型", "愿意输出"], risks: [], spotlight: "直球女主，对线感强", summary: "主动热烈的女主，爱情线为主，表达欲强。适合喜欢主导情感节奏的玩家。" },
      { name: "楚云歌", gender: "男", traits: ["隐忍", "克制", "守护", "慢热"], emotionalLines: ["友情", "成长"], suitableFor: ["慢热型", "注重友情线"], risks: ["边缘感"], spotlight: "隐忍守护型男主", summary: "克制隐忍的男主，友情线+成长线厚重，与余心乐有强互动。适合能沉下来的玩家。" },
      { name: "顾言", gender: "男", traits: ["理智", "守护", "责任感"], emotionalLines: ["爱情", "事业"], suitableFor: ["沉稳型", "责任感强"], risks: [], spotlight: "理智守护型，CP线稳定", summary: "理智守护型男主，与苏橙CP感强，爱情线+事业线。适合成熟稳重的玩家。" },
      { name: "余心乐", gender: "男", traits: ["外放", "活泼", "热情"], emotionalLines: ["友情", "救赎"], suitableFor: ["社牛", "活泼型"], risks: ["大量输出"], spotlight: "活泼外放，与楚云歌互动多", summary: "活泼外放的男主，救赎线+友情线。适合社牛、愿意带动气氛的玩家。" }
    ]
  },
  {
    name: "古木吟",
    type: "情感本",
    players: 6,
    genderSplit: "3男3女",
    difficulty: "进阶",
    duration: "5-6小时",
    tags: ["校园", "恐怖", "情感", "反转"],
    roles: [
      { name: "林小鱼", gender: "女", traits: ["敏感", "高共情", "缺爱"], emotionalLines: ["爱情", "救赎", "亲情"], suitableFor: ["水龙头", "高共情玩家"], risks: ["原生家庭", "情感冲击大"], spotlight: "情感C位，全程高能", summary: "核心女主，爱情+救赎双线。情感浓度极高，需要强共情能力。" },
      { name: "于念", gender: "女", traits: ["独立", "清醒", "慢热"], emotionalLines: ["成长", "友情"], suitableFor: ["外冷内热", "慢热型"], risks: ["边缘感"], spotlight: "成长线女主", summary: "独立清醒的女主，成长线为主。适合外冷内热的玩家。" },
      { name: "李明昊", gender: "男", traits: ["守护", "克制", "责任感"], emotionalLines: ["守护", "事业"], suitableFor: ["沉稳型", "责任感强"], risks: [], spotlight: "守护型男主，微NPC感", summary: "守护型男主，带有微NPC视角。适合能扛责任的玩家。" }
    ]
  },
  {
    name: "来电",
    type: "欢乐机制本",
    players: 6,
    genderSplit: "3男3女（反串友好）",
    difficulty: "新手友好",
    duration: "3-4小时",
    tags: ["欢乐", "机制", "反转", "诈骗"],
    roles: [
      { name: "秦思雨", gender: "女", traits: ["外放", "活泼", "主动"], emotionalLines: ["友情", "事业"], suitableFor: ["社牛", "戏精"], risks: [], spotlight: "欢乐C位，机制核心", summary: "活泼外放的欢乐本女主。适合社牛，能带动游戏节奏。" },
      { name: "李瑶瑶", gender: "女", traits: ["温柔", "细腻", "敏感"], emotionalLines: ["爱情", "友情"], suitableFor: ["温柔型", "吃情感副线"], risks: [], spotlight: "温柔细腻，有情感厚度", summary: "温柔细腻的女主，在欢乐机制中藏有情感线。适合喜欢细腻表达的玩家。" },
      { name: "宋重德", gender: "男", traits: ["强势", "主动", "外放"], emotionalLines: ["事业"], suitableFor: ["推土机", "喜欢主导"], risks: [], spotlight: "强硬派男主", summary: "强势主动的男主，事业线为主。适合推土机型玩家。" },
      { name: "谢微风", gender: "男", traits: ["理智", "冷静", "克制"], emotionalLines: ["成长"], suitableFor: ["理智型", "沉稳型"], risks: [], spotlight: "冷静谋略型", summary: "冷静理智的男主。适合喜欢分析、沉稳的玩家。" },
      { name: "贺林", gender: "男", traits: ["守护", "责任感", "温柔"], emotionalLines: ["友情", "守护"], suitableFor: ["守护型", "重情义"], risks: [], spotlight: "守护型，重情义", summary: "守护型男主，友情线+责任感。适合重情义的玩家。" }
    ]
  },
  {
    name: "风吹麦浪",
    type: "情感本",
    players: 6,
    genderSplit: "3男3女",
    difficulty: "进阶",
    duration: "4-5小时",
    tags: ["农村", "年代", "爱情", "遗憾"],
    roles: [
      { name: "林晚", gender: "女", traits: ["高共情", "敏感", "隐忍", "克制"], emotionalLines: ["爱情", "遗憾"], suitableFor: ["水龙头", "能接受隐忍爱情线"], risks: ["卑微感", "憋屈感"], spotlight: "情感核心，后劲极强", summary: "高共情的女主，爱情线为主。过程憋屈但后劲极强。适合能默默承受、喜欢虐恋的玩家。" },
      { name: "许知夏", gender: "女", traits: ["懂事", "压抑", "敏感"], emotionalLines: ["亲情", "成长"], suitableFor: ["能接受亲情线", "外冷内热"], risks: ["原生家庭痛点"], spotlight: "亲情+成长线女主", summary: "懂事压抑的女主，亲情线+自我成长。适合能接受家庭题材的玩家。" },
      { name: "周野", gender: "男", traits: ["外放", "主动", "热烈", "执着"], emotionalLines: ["爱情", "救赎"], suitableFor: ["主动型", "愿意输出", "对线感强"], risks: [], spotlight: "热烈直球男主", summary: "热烈执着的男主，表达欲强。适合不怕输出、喜欢对抗的玩家。" },
      { name: "沈清", gender: "男", traits: ["理智", "沉稳", "守护", "清醒"], emotionalLines: ["爱情", "守护"], suitableFor: ["沉稳型", "慢热型", "不喜欢卑微感"], risks: [], spotlight: "理智守护型，关系稳定", summary: "清醒沉稳的男主。爱情不重但有稳定CP线。适合不喜欢卑微感的玩家。" }
    ]
  },
  {
    name: "落日航班",
    type: "情感本",
    players: 6,
    genderSplit: "3男3女",
    difficulty: "进阶",
    duration: "4-5小时",
    tags: ["都市", "遗憾", "爱情", "友情"],
    roles: [
      { name: "苏眠", gender: "女", traits: ["敏感", "缺爱", "依赖"], emotionalLines: ["爱情", "遗憾"], suitableFor: ["水龙头", "能接受拉扯感"], risks: ["卑微感", "恋爱脑"], spotlight: "爱情线C位，哭点密集", summary: "敏感缺爱的女主，爱情线为主且有拉扯感。适合能接受情感依赖的玩家。" },
      { name: "陈屿", gender: "男", traits: ["理智", "克制", "责任感"], emotionalLines: ["爱情", "遗憾"], suitableFor: ["理智型", "慢热型"], risks: [], spotlight: "克制型男主，后劲来自没说出的话", summary: "理智克制的男主，爱情线中后劲来自沉默。适合慢热、不急于表达的玩家。" },
      { name: "温北", gender: "男", traits: ["热烈", "外放", "友情"], emotionalLines: ["友情", "理想"], suitableFor: ["社牛", "愿意推动关系"], risks: [], spotlight: "友情线核心", summary: "热烈外放的男主，友情线+理想主义。适合社牛、愿意表达和推动关系的玩家。" },
      { name: "秦遥", gender: "女", traits: ["独立", "自尊", "防备", "破防"], emotionalLines: ["亲情", "成长"], suitableFor: ["独立型", "喜欢强自尊角色"], risks: ["原生家庭"], spotlight: "自尊型女主，亲情线明显", summary: "独立自尊的女主，亲情线+破防。适合喜欢强自尊、能接受家庭线的玩家。" }
    ]
  }
];

/**
 * 将知识库转换为可索引的文档片段
 * 每个角色生成多个检索维度：按名字、按特征、按情感线、按玩家类型
 */
export function buildKnowledgeDocs() {
  const docs = [];
  for (const script of SCRIPT_KNOWLEDGE) {
    // 剧本级别文档
    docs.push({
      text: `剧本《${script.name}》：${script.type}，${script.players}人（${script.genderSplit}），难度${script.difficulty}，时长${script.duration}。标签：${script.tags.join("、")}。`,
      meta: { type: "script_overview", script: script.name }
    });

    // 角色级别文档（多维度）
    for (const role of script.roles) {
      docs.push({
        text: `【${script.name}】${role.name}（${role.gender}）：${role.summary} 性格特征：${role.traits.join("、")}。情感线：${role.emotionalLines.join("、")}。适合玩家：${role.suitableFor.join("、")}。注意：${role.risks.join("、") || "无明显雷点"}。定位：${role.spotlight}。`,
        meta: { type: "role_detail", script: script.name, role: role.name, gender: role.gender }
      });

      // 按特征检索维度
      docs.push({
        text: `${role.traits.join(" ")} 类型角色 ${role.name} 《${script.name}》`,
        meta: { type: "role_trait_index", script: script.name, role: role.name, traits: role.traits }
      });

      // 按情感线检索维度
      docs.push({
        text: `${role.emotionalLines.join(" ")} 线角色 ${role.name} 《${script.name}》 ${role.suitableFor.join(" ")}`,
        meta: { type: "role_line_index", script: script.name, role: role.name, lines: role.emotionalLines }
      });
    }
  }
  return docs;
}

/** 按名称模糊查找剧本 */
export function findScript(name) {
  const lower = name.toLowerCase();
  return SCRIPT_KNOWLEDGE.find(s =>
    s.name === name || s.name.includes(name) || name.includes(s.name) ||
    s.name.toLowerCase().includes(lower) || lower.includes(s.name.toLowerCase())
  );
}