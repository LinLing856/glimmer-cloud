# 微光集 Glimmer · 云同步版

人生大事记的**云同步版本**：数据通过 GitHub Gist 存储在你自己的账号下，多设备互通，永不过期。

> Cloud-sync edition of Glimmer. Your data lives in a private Gist under your own GitHub account — sync across devices, no expiry.

**在线使用 / Live demo**: https://linling856.github.io/glimmer-cloud/

> ⚠️ **此仓库公开仅供访问页面。这是作者的个人工具，云同步仅支持自己的 Token。**

## ✨ 功能 / Features

包含[本地版](https://github.com/LinLing856/glimmer)的全部功能（时间线 / 主题 / 播放动效 / 双语 / 备份导入导出），另加：

- ☁️ **云同步**：数据存入你 GitHub 账号下的**私密 Gist**（secret，搜索引擎搜不到）
- 🔄 **多设备互通**：各设备使用同一 Token，自动双向合并同步
- 🪦 **删除墓碑机制**：删除操作可靠地同步到所有设备
- 🔑 **Token 本地保存**：Token 只存在你设备的浏览器里，不写入任何代码

## 🔑 如何启用云同步 / Setup

云同步使用 GitHub Gist 作为存储，需要一把「钥匙」（Token）。**如果你不是仓库作者，不建议使用本版本**——请使用无需凭证的[本地版](https://github.com/LinLing856/glimmer)。

作者自己的流程：

1. 打开 GitHub → 头像 → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
2. Expiration 选 **No expiration**，权限**只勾 `gist`**（最小权限，无需 repo）
3. 打开本应用 → 「更多 ⋮ → 连接云端」→ 粘贴 Token
4. 状态栏显示「已同步」即成功。Token 每台设备只需粘贴一次

数据隔离原理：每人用**自己的 Token** 读写**自己的私密 Gist**，互相不可见；同一 Token 的多台设备之间互通。

## 📁 文件 / Files

| 文件 | 说明 |
|---|---|
| `index.html` | 全部界面与逻辑（单文件应用） |
| `cloud-sync.js` | 云同步层（GitHub Gist API，双向合并 + 墓碑删除） |
| `app-lang.js` | 中英双语切换层 |
| `manifest.webmanifest` / `icons/` | PWA 图标与清单 |

## 🔒 安全说明 / Security

- Token 仅从你的浏览器直连 GitHub 官方 API，**不经过任何第三方服务器**
- 建议只勾 `gist` 权限：即使泄露，也无法触及你的任何代码仓库
- 如怀疑泄露：GitHub → Settings → Developer settings → 删除该 Token 即可立即作废，重新生成后在新设备重贴

## 🔗 相关版本 / Other Editions

- **纯本地版**（零凭证，推荐给普通访客）：[glimmer](https://github.com/LinLing856/glimmer) · https://linling856.github.io/glimmer/

---

*记录人生的高光与微光。Capture the glimmers of your life.*
