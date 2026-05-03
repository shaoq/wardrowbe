## Why

前端界面已完成全面中文化，但 AI 生成的建议内容（穿搭标题、亮点、搭配技巧）和所有通知消息（ntfy、Mattermost、邮件、Expo Push）仍以英文输出，导致用户体验割裂——中文界面中夹杂大段英文。

## What Changes

- 在 `recommendation.txt`、`item_pairing.txt`、`clothing_description.txt` 三个 prompt 模板末尾追加中文输出指令
- 在 `recommendation_service.py` 的 `SINGLE_OUTFIT_FORMAT` 硬编码格式字符串末尾追加中文输出指令
- 将 `notification_service.py` 中 4 个通知构建方法（ntfy / mattermost / email / expo_push）的所有英文模板文本翻译为中文
- 将 `workers/notifications.py` 中 wash reminder 的英文文本翻译为中文

## Capabilities

### New Capabilities

- `chinese-ai-output`: 确保 AI 生成的穿搭建议内容和系统通知消息以中文输出

### Modified Capabilities

## Impact

- 后端 3 个 prompt 文件、1 个 Python 常量、1 个通知服务、1 个 worker 任务
- 不影响前端代码、数据库 schema、API 接口定义
- `clothing_analysis.txt` 不需改动（输出结构化 JSON 枚举值，前端已有中文映射）
