# 微光集 Glimmer · 云同步版

人生大事记时间线应用，数据通过 GitHub Gist 云端存储，多设备互通。

**在线使用**: https://linling856.github.io/glimmer-cloud/

## 功能

- 📅 时间线展示，竖向 / 横向切换
- 🗓️ 事件日期精度可选「年 / 月 / 日」
- 🎨 7 套主题，多角色、多时间线管理
- ▶️ 播放模式：时间线逐条生长动效
- 🌐 中英双语界面切换
- 💾 数据导出 / 导入 JSON 备份
- 📱 支持手机浏览器与添加到主屏幕
- ☁️ 数据存入你 GitHub 账号下的私密 Gist
- 🔄 多设备自动双向同步，删除操作同样可靠同步

## 启用云同步

需要一把 GitHub Token（相当于钥匙）：

1. 打开 https://github.com/settings/tokens → **Generate new token (classic)**
2. Expiration 选 **No expiration**，权限只勾 **gist**
3. 打开应用 → 「更多 ⋮ → 连接云端」→ 粘贴 Token
4. 状态栏显示「已同步」即成功，Token 每台设备只需粘贴一次

## 数据与安全

- 数据按账号隔离：每人用自己的 Token 读写自己的私密 Gist，互不可见；同一 Token 的多台设备之间互通
- Token 只保存在你设备的浏览器中，直连 GitHub 官方 API，不经过任何第三方服务器
- Token 泄露时到 GitHub 删除该 Token 即可立即作废
