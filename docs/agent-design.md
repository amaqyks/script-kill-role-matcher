# 剧本杀 AI 选角助手 — Agent 设计文档

> 版本: v0.2 | 架构模式: ReAct + Function Calling

---

## 1. 总体架构

```
用户输入 → Orchestrator (ReAct 循环) → Function Calling → 工具执行 → 结果回传 → 最终回复
                ↓
        5 个 Function Tools  +  RAG 管线  +  匹配引擎
```

Orchestrator 是唯一入口，负责接收用户消息、维护对话上下文（画像 + 历史记录）、调用 LLM 进行 ReAct 循环决策。

---

## 2. Agent / Tool 清单

### 2.1 search_script — 搜索 Agent

| 属性 | 值 |
|------|-----|
| 职责 | 搜索指定剧本在社交平台的公开评测和角色信息 |
| 输入 | `scriptName`: 剧本名称 |
| 输出 | `{ sources, profile }`: 原始搜索结果 + 角色识别结果 |
| 触发条件 | 用户提到具体剧本名 |
| 内部流程 | Bing Search API → LLM 记忆召回 → 正则/LMM 角色识别 → 自动索引到 RAG |
| 边界 | 无 API Key 时回落知识库；找不到结果时停止推荐 |

### 2.2 retrieve_knowledge — 知识库检索 Agent

| 属性 | 值 |
|------|-----|
| 职责 | 从本地向量知识库检索剧本和角色结构化信息 |
| 输入 | `query`: 检索词, `topK`: 返回数(默认5) |
| 输出 | `{ results }`: 带相似度评分的文档列表 |
| 触发条件 | Orchestrator 判断需要角色特征对比或补充信息时 |
| 内部流程 | 查询 → 混合检索(语义0.7+关键词0.3) → 余弦相似度排序 |
| 边界 | 仅返回知识库已有数据；搜索结果会自动写入知识库 |

### 2.3 analyze_user_persona — 画像分析 Agent

| 属性 | 值 |
|------|-----|
| 职责 | 将 MBTI/星座/标签等非结构化画像转为角色特征信号 |
| 输入 | `{ mbti, zodiac, gender, crossGender, preferredLines, preferredTraits, freeText }` |
| 输出 | `{ signals, description }`: 4 维信号(特质/情感线/风格/雷区) + 可读描述 |
| 触发条件 | 用户提供新画像信息，或 Orchestrator 判断需要更新画像分析 |
| 内部流程 | MBTI 映射 → 星座映射 → 标签解析 → 特征融合去重 |
| 边界 | 不依赖 LLM，纯规则引擎；15 层映射表覆盖 16 型 MBTI + 12 星座 + 12 个自定义标签 |

### 2.4 recommend_roles — 匹配推荐 Agent

| 属性 | 值 |
|------|-----|
| 职责 | 综合画像信号和角色信息，打分推荐 |
| 输入 | `{ scriptName, gender, crossGender, mbti, zodiac, answers, ... }` |
| 输出 | `{ recommended, alternatives, ineligible, personaSummary }` |
| 触发条件 | 角色信息和用户画像均已就绪 |
| 内部流程 | 查知识库 → buildProfile → matchRoles → 多维评分 |
| 边界 | 角色信息不足时返回 error 而非强行推荐 |

### 2.5 compare_roles — 角色对比 Agent

| 属性 | 值 |
|------|-----|
| 职责 | 对比两个或多个角色的差异 |
| 输入 | `{ scriptName, roleNames[] }` |
| 输出 | `{ comparison }`: 每个角色的属性并列对比 |
| 触发条件 | 用户犹豫不决时 |
| 内部流程 | 从知识库取出角色 → 并列输出 |
| 边界 | 仅做客观对比，不做主观推荐 |

---

## 3. 协作关系

```
search_script ──→ 搜索结果自动写入 ──→ RAG 向量库
                                      ↓
retrieve_knowledge ←──────────────────┘
                                      ↓
analyze_user_persona ──→ 特征信号 ──→ recommend_roles
                                      ↓
                              compare_roles (可选)
```

### 典型对话的 Agent 调用序列

```
用户: "帮我选告别诗的角色，我 INFP 天蝎女"
  → Orchestrator 判断: 有剧本名 + 有 MBTI/星座
  → 调用 search_script("告别诗")
  → 调用 analyze_user_persona({ mbti:"INFP", zodiac:"天蝎", gender:"女" })
  → 调用 recommend_roles({ scriptName:"告别诗", ... })
  → 用户追问: "林星落和苏橙有什么区别？"
  → 调用 compare_roles({ scriptName:"告别诗", roleNames:["林星落","苏橙"] })
  → 最终回复
```

---

## 4. ReAct 循环控制

| 控制项 | 值 | 说明 |
|--------|-----|------|
| 最大工具调用次数 | 6 | 超出后强制生成回复 |
| 模型 | Gemini 2.5 Flash | 通过 OpenRouter 接入 |
| Temperature | 0.3 | 保证推荐结果稳定性 |
| Tool Choice | auto | LLM 自主决定是否调用工具 |
| 上下文注入 | 用户画像 + 历史角色记录 | 每次对话自动注入 |

---

## 5. 设计原则

1. **LLM 不做知识存储**: 剧本角色信息存知识图谱 + 向量库，LLM 只负责推理和调度
2. **工具之间低耦合**: 每个 tool 可独立测试、独立替换
3. **失败有降级**: 搜索失败 → 回退知识库；嵌入 API 失败 → 本地稀疏向量
4. **不编造是最重要的安全边界**: 找不到角色就停止，信息不够就追问