## Context

项目前端已完成全面中文化（导航、标签、提示等均为中文），但 AI 生成的穿搭建议内容和系统通知消息仍以英文输出。当前架构中，AI 输出语言由 prompt 模板和硬编码格式字符串决定，通知消息由 `notification_service.py` 中的 Python 字符串模板生成。

涉及的输出源头：
- 3 个 prompt 文件（`recommendation.txt`、`item_pairing.txt`、`clothing_description.txt`）
- 1 个 Python 常量（`SINGLE_OUTFIT_FORMAT`）
- 1 个通知服务（4 个 `_build_*` 方法）
- 1 个 worker 任务（wash reminder）

## Goals / Non-Goals

**Goals:**
- AI 生成的穿搭建议内容（headline、highlights、styling_tip）以中文输出
- 衣物描述（clothing_description）以中文输出
- 所有通知消息（ntfy、Mattermost、邮件、Expo Push）模板文本中文化
- Wash reminder 通知文本中文化

**Non-Goals:**
- 不引入多语言支持框架或语言参数
- 不修改 `clothing_analysis.txt`（输出结构化 JSON 枚举值，前端已有映射）
- 不修改前端代码
- 不修改数据库 schema 或 API 接口定义

## Decisions

### 1. 在 prompt 末尾追加中文指令而非重写整个 prompt

**选择**：在现有英文 prompt 末尾追加 `"Please always reply in Chinese!"`

**理由**：英文 prompt 对 AI 模型的指令遵循度更高，末尾追加语言指令是最小改动且效果可靠的方式。重写为中文 prompt 可能导致模型对风格指引的理解偏差。

**替代方案**：
- 整个 prompt 翻译为中文 → 改动大，且英文 prompt 对时尚领域术语表达更精确
- 在 prompt 开头添加语言指令 → 末尾位置对输出语言的约束力更强（recency bias）

### 2. 通知模板直接翻译为中文

**选择**：将 `notification_service.py` 和 `workers/notifications.py` 中的硬编码英文文本直接翻译为中文。

**理由**：通知模板是固定的字符串拼接，不涉及 AI 生成，直接翻译最简单可靠。

## Risks / Trade-offs

- [AI 可能中英混杂] → 风险较低，主流模型对 "reply in Chinese" 指令遵循良好；如有问题可后续调整 prompt 措辞
- [未来需要多语言支持] → 当前硬编码中文可满足需求；如未来需要多语言，再引入语言参数机制，不影响本次改动
