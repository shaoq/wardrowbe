## 1. Prompt 模板追加中文输出指令

- [x] 1.1 在 `backend/app/prompts/recommendation.txt` 末尾追加 "Please always reply in Chinese!"
- [x] 1.2 在 `backend/app/prompts/item_pairing.txt` 末尾追加 "Please always reply in Chinese!"
- [x] 1.3 在 `backend/app/prompts/clothing_description.txt` 末尾追加 "Please always reply in Chinese!"
- [x] 1.4 在 `backend/app/services/recommendation_service.py` 的 `SINGLE_OUTFIT_FORMAT` 常量末尾追加 "Please always reply in Chinese!"

## 2. 通知服务模板中文化

- [x] 2.1 在 `backend/app/services/notification_service.py` 的 `_build_ntfy_notification` 方法中，将 "Today"/"Tomorrow" 改为 "今天"/"明天"，"Tip:" 改为 "提示："，"Your outfit is ready." 改为 "您的穿搭已就绪。"
- [x] 2.2 在 `_build_mattermost_message` 方法中，将 "Good morning"/"Good evening" 改为 "早上好"/"晚上好"，"Here's your outfit suggestion for..." 改为中文，"Tip:" 改为 "提示："，"Your outfit is ready!" 改为中文
- [x] 2.3 在 `_build_email_message` 方法中，将邮件标题、按钮文案 "View Outfit" 改为 "查看穿搭"，"Tip:" 改为 "提示："，"Sent by Wardrowbe" 改为 "由 Wardrowbe 发送"，"Manage notification settings" 改为 "管理通知设置"，纯文本模板同步翻译
- [x] 2.4 在 `_build_expo_push_message` 方法中，将 "Today"/"Tomorrow" 改为 "今天"/"明天"，"Tip:" 改为 "提示："，"Your outfit is ready!" 改为中文

## 3. Wash Reminder 中文化

- [x] 3.1 在 `backend/app/workers/notifications.py` 中，将 "Laundry Reminder" 改为 "洗衣提醒"，将英文数量描述改为中文（如 "3 件衣物需要清洗：衬衫, T恤, 牛仔裤"），"and X more" 改为 "等共 X 件"
