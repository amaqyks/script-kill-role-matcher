const TARGET_PLATFORMS = ["小红书","迷圈","千岛","抖音"];

export async function searchPublicSummaries(scriptName = "") {
  const name = scriptName.trim();
  if (!name) return [];

  if (process.env.OPENROUTER_API_KEY) {
    try {
      const results = await searchWithLLM(name);
      if (results.length > 0) return results;
    } catch (err) {
      console.warn("LLM search failed, trying Bing:", err.message);
    }
  }

  if (process.env.BING_SEARCH_API_KEY) {
    try {
      const results = await searchWithBing(name);
      if (results.length > 0) return results;
    } catch (err) {
      console.warn("Bing search failed:", err.message);
    }
  }

  return noApiKeyMessage();
}

function noApiKeyMessage() {
  return [{
    platform: "系统",
    title: "需要配置搜索密钥",
    url: "about:blank",
    confidence: "no-api-key",
    summary: "系统需要 OPENROUTER_API_KEY 或 BING_SEARCH_API_KEY 才能搜索公开网页。\n\n推荐 OpenRouter（免费额度）：\n1. 打开 https://openrouter.ai/keys 获取密钥\n2. 启动前设置: \=\"你的密钥\"\n3. npm start 重启\n\n也可用 Bing Search：\n1. Azure Portal 创建 Bing Search 资源\n2. \=\"你的密钥\"\n3. npm start 重启"
  }];
}

async function searchWithLLM(scriptName) {
  const prompt = [
    "你是剧本杀资深玩家助手。请回忆你在训练数据中见过的、来自小红书、迷圈、千岛、抖音等社交平台上关于剧本《" + scriptName + "》的公开帖子和测评内容。",
    "",
    "请根据记忆中这些社交平台的公开内容，列出该剧本可选的玩家角色。",
    "",
    "严格要求：",
    "1. 只基于记忆中真实的社交平台公开内容回答，绝对不要编造角色",
    "2. 如果你确实没见过或不确定，直接返回 {\"sources\":[]}",
    "3. 排除 NPC、DM、主持人、店家、作者等非玩家角色",
    "4. 每个角色说明性格特征、情感线类型、适合的玩家、可能的雷点",
    "",
    "输出严格 JSON：",
    "{\"sources\":[{\"platform\":\"小红书/迷圈/千岛/抖音\",\"title\":\"摘要\",\"summary\":\"角色名（性别）：性格特征，情感线，适合玩家，雷点\"}]}",
  ].join("\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.OPENROUTER_API_KEY,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:4173",
      "X-Title": "ScriptKillRoleMatcher"
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 4000
    })
  });

  if (!response.ok) throw new Error("LLM request failed: " + response.status);

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  const sources = (parsed.sources || []).filter(function(s) { return s.summary && s.summary.length > 20; });

  return sources.map(function(s) {
    return {
      platform: TARGET_PLATFORMS.includes(s.platform) ? s.platform : "AI 综合",
      title: s.title || (scriptName + " 角色信息"),
      url: "about:blank",
      confidence: "llm",
      summary: s.summary.slice(0, 800)
    };
  });
}

async function searchWithBing(scriptName) {
  var queries = [
    scriptName + " 剧本杀 角色 测评",
    scriptName + " 角色 推荐 选角",
    scriptName + " site:xiaohongshu.com 角色",
    scriptName + " site:zhihu.com 剧本杀 角色",
    scriptName + " 迷圈 角色",
    scriptName + " 千岛 测评",
    scriptName + " 抖音 角色 测评"
  ];
  var pages = [];

  for (var qi = 0; qi < queries.length; qi++) {
    var q = queries[qi];
    var bingUrl = new URL("https://api.bing.microsoft.com/v7.0/search");
    bingUrl.searchParams.set("q", q);
    bingUrl.searchParams.set("mkt", "zh-CN");
    bingUrl.searchParams.set("count", "5");
    bingUrl.searchParams.set("textDecorations", "false");
    bingUrl.searchParams.set("textFormat", "Raw");

    var resp = await fetch(bingUrl, {
      headers: { "Ocp-Apim-Subscription-Key": process.env.BING_SEARCH_API_KEY }
    });

    if (!resp.ok) throw new Error("Bing search failed: " + resp.status);

    var bingData = await resp.json();
    var items = bingData.webPages?.value || [];
    for (var ii = 0; ii < items.length; ii++) {
      var item = items[ii];
      var title = cleanText(item.name);
      var summary = cleanText(item.snippet);
      if (!looksRelevant(scriptName, title, summary)) continue;
      pages.push({
        platform: detectPlatform(item.url, title),
        title: title,
        url: item.url,
        confidence: "search",
        summary: summary
      });
    }
  }

  return dedupeByUrl(pages).slice(0, 20);
}

function looksRelevant(scriptName, title, summary) {
  var text = title + " " + summary;
  return text.includes(scriptName) || /剧本杀|情感本|角色|测评|复盘|选角/.test(text);
}

function detectPlatform(url, title) {
  url = url || "";
  title = title || "";
  var text = url + " " + title;
  if (/xiaohongshu|小红书/i.test(text)) return "小红书";
  if (/douyin|抖音/i.test(text)) return "抖音";
  if (/qiandao|千岛/i.test(text)) return "千岛";
  if (/miquan|迷圈/i.test(text)) return "迷圈";
  if (/zhihu|知乎/i.test(text)) return "知乎";
  for (var pi = 0; pi < TARGET_PLATFORMS.length; pi++) {
    if (text.includes(TARGET_PLATFORMS[pi])) return TARGET_PLATFORMS[pi];
  }
  return "公开网页";
}

function dedupeByUrl(items) {
  var seen = new Set();
  return items.filter(function(item) {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function cleanText(value) {
  value = value || "";
  return String(value).replace(/\s+/g, " ").trim();
}