## ADDED Requirements

### Requirement: AI 穿搭建议内容以中文输出
系统 SHALL 在所有穿搭建议生成的 prompt 中包含中文输出指令，使 AI 返回中文的 headline、highlights 和 styling_tip。

#### Scenario: 每日穿搭推荐生成中文内容
- **WHEN** 用户请求每日穿搭推荐
- **THEN** AI 返回的 headline、highlights、styling_tip 字段内容均为中文

#### Scenario: 单品搭配生成中文内容
- **WHEN** 用户查看某件衣物的搭配建议
- **THEN** AI 返回的 headline、highlights、styling_tip 字段内容均为中文

#### Scenario: 衣物描述以中文生成
- **WHEN** 系统通过 AI 分析用户上传的衣物图片并生成描述
- **THEN** AI 返回的衣物描述文本为中文

### Requirement: ntfy 通知消息中文化
系统 SHALL 将 ntfy 通知的标题、正文模板翻译为中文，包括日期标签、提示前缀和默认消息。

#### Scenario: ntfy 发送当日穿搭通知
- **WHEN** 系统通过 ntfy 发送当日穿搭通知
- **THEN** 通知标题包含中文日期标签（"今天"），正文中的 "Tip:" 前缀改为 "提示："，默认消息改为中文

#### Scenario: ntfy 发送明日穿搭通知
- **WHEN** 系统通过 ntfy 发送明日穿搭通知
- **THEN** 通知标题包含中文日期标签（"明天"）

### Requirement: Mattermost 通知消息中文化
系统 SHALL 将 Mattermost 通知的问候语、正文模板翻译为中文。

#### Scenario: Mattermost 发送穿搭通知
- **WHEN** 系统通过 Mattermost 发送穿搭通知
- **THEN** 问候语为中文（"早上好"/"晚上好"），正文中的 "Tip:" 改为 "提示："，默认消息改为中文

### Requirement: 邮件通知中文化
系统 SHALL 将邮件通知的标题、正文 HTML 模板、纯文本模板翻译为中文。

#### Scenario: 邮件发送穿搭通知
- **WHEN** 系统通过邮件发送穿搭通知
- **THEN** 邮件标题、按钮文案（"查看穿搭"）、页脚文案均为中文

### Requirement: Expo Push 通知中文化
系统 SHALL 将 Expo Push 通知的标题、正文模板翻译为中文。

#### Scenario: Expo Push 发送穿搭通知
- **WHEN** 系统通过 Expo Push 发送穿搭通知
- **THEN** 通知标题包含中文日期标签，默认消息改为中文

### Requirement: Wash Reminder 通知中文化
系统 SHALL 将洗衣提醒通知的标题和正文翻译为中文。

#### Scenario: 发送洗衣提醒
- **WHEN** 系统检测到需要清洗的衣物并发送提醒
- **THEN** 通知标题为"洗衣提醒"，正文包含中文数量描述和衣物列表
