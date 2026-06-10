# 情感本 AI 选角助手 MVP

这是一个证据优先的本地 MVP，用来验证：

```text
输入剧本名
-> 搜索公开网页摘要
-> 只从来源文本中识别玩家角色
-> 根据性别/是否反串和玩家画像动态追问
-> 推荐角色并说明原因
```

## 运行

```powershell
npm start
```

打开：

```text
http://localhost:4173
```

## 接入公开网页搜索

当前实现支持 Bing Web Search API。启动服务前配置：

```powershell
$env:BING_SEARCH_API_KEY="你的 Bing Search API Key"
npm start
```

系统会围绕剧本名检索：

- 迷圈
- 千岛
- 抖音
- 小红书
- 其他公开网页

## 关键约束

- 不使用预设角色库。
- 不根据剧本名胡编人物。
- 只展示公开来源摘要中出现过、且看起来像可选玩家角色的人物。
- 明确标注为 NPC、DM、主持人、店家、作者、工作人员的人物不会进入推荐。
- 玩家性别和是否接受反串优先处理；不接受反串时，性别不匹配角色会被排除。
- 角色资料不足时，系统会停止在“追问/推荐”之前，而不是生成看似合理的结果。

## 主要文件

- `src/searchAgent.js`：公开网页搜索层。
- `src/roleProfiler.js`：从来源摘要中识别玩家角色，保留证据。
- `src/questionAgent.js`：根据已识别角色差异动态追问。
- `src/matchAgent.js`：性别优先的匹配推荐。
- `public/index.html`、`public/app.js`：前端流程。
