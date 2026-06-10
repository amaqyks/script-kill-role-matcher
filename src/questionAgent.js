const BASE_QUESTIONS = [
  {
    id: "line_preference",
    label: "你这次最想体验哪类情感线？",
    type: "multi",
    options: ["爱情", "亲情", "友情", "成长", "救赎", "遗憾"]
  },
  {
    id: "expression_style",
    label: "你更容易代入哪种表达方式？",
    type: "multi",
    options: ["隐忍克制", "主动外放", "理性守护", "外冷内热", "高共情慢热"]
  },
  {
    id: "avoidance",
    label: "这些内容里，你希望避开哪些？",
    type: "multi",
    options: ["卑微感", "原生家庭痛点", "背叛/出轨", "大量输出", "角色边缘", "恋爱脑"]
  },
  {
    id: "spotlight",
    label: "你希望角色在车上的关系中心感如何？",
    type: "single",
    options: ["越强越好", "中等就好", "不想太被关注", "只要好代入即可"]
  }
];

export function generateQuestions(profile, userProfile = {}) {
  const roles = profile?.roles || [];
  if (roles.length < 2) return [];

  const questions = [];
  const roleLines = unique(roles.flatMap((role) => role.emotionalLines));
  const roleTraits = unique(roles.flatMap((role) => role.traits));
  const roleRisks = unique(roles.flatMap((role) => role.riskPoints));

  if (roleLines.length > 1) questions.push(filterOptions(BASE_QUESTIONS[0], roleLines));
  if (roleTraits.length > 1) questions.push(BASE_QUESTIONS[1]);
  if (roleRisks.length > 0) questions.push(filterOptions(BASE_QUESTIONS[2], roleRisks));
  questions.push(BASE_QUESTIONS[3]);

  if (hasGenderConflict(roles, userProfile)) {
    questions.unshift({
      id: "crossGenderConfirm",
      label: "当前资料中存在与你性别偏好不一致或性别未知的角色，你是否接受反串或待确认角色？",
      type: "single",
      options: ["不接受", "只接受轻度反串", "接受反串", "先看角色再决定"]
    });
  }

  return questions.slice(0, shouldAskMore(profile, userProfile) ? 6 : 4);
}

function filterOptions(question, signals) {
  const options = question.options.filter((option) => signals.some((signal) => option.includes(signal) || signal.includes(option)));
  return { ...question, options: options.length ? options : question.options };
}

function hasGenderConflict(roles, userProfile) {
  const gender = userProfile.gender;
  const allowCross = userProfile.crossGender !== "no";
  if (!gender || gender === "不限") return false;
  return roles.some((role) => role.gender === "未知" || (!allowCross && role.gender !== gender));
}

function shouldAskMore(profile, userProfile) {
  const userText = Object.values(userProfile).flat().join(" ");
  return profile?.confidence !== "高" || userText.length < 30;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
