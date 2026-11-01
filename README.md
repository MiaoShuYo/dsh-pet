# DSH Pet · 桌宠

> 给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）Web / 桌面客户端用的桌面宠物（应用内，外加可选的 Windows 独立置顶窗口）：常驻显示**账户余额**、**本会话 token**、**上下文占用**和**正在执行的任务**，并在余额不足、上下文将满、轮次完成/失败、等待审批或回答时提醒你。

![DSH Pet preview](docs/preview.svg)

![Live task list and busy pose](docs/tasks.png)

![Windows desktop companion](docs/desktop.png)

> 仓库地址已指向 **MiaoShuYo/dsh-pet**。如要迁移到别的账号，替换本文件、`package.json`、`site/index.html` 中的 `MiaoShuYo`；CI、Release 包名与 Pages 索引会自动从 `GITHUB_REPOSITORY` 读取真实仓库地址。

## 功能

- **常驻状态牌**：余额 · 本会话 token · 上下文占用环（绿/橙/红）。点击余额去充值，点击 token 打开面板。
- **进行中的任务**：宠物上方显示当前会话正在执行的任务——既有后台 job，也有同步工具调用（例如正在运行的 `pwsh`/`bash` 命令）；标题优先取工具的 `description`，其次取命令首行。任务执行时宠物自动切换为抱着笔记本的忙碌姿态，最多展示 3 条。
- **桌面定位**：位置按**屏幕坐标**保存；移动 DSH 窗口时宠物不会跟着走，而是留在用户放置的桌面位置。
- **Windows 独立桌面窗口**：外观 → 独立桌面窗口，打开一个独立的透明置顶 WPF 窗口，可拖到 DSH 窗口外；显示宠物、任务卡和余额/token/上下文牌。关闭后应用内宠物自动恢复，设置仍在 DSH 面板。
- **顶层渲染**：宠物挂载到页面 `body` 顶层并使用最高 z-index，DSH 聊天卡片、侧栏等不会遮住它；但窗口边界仍是硬限制。
- **余额提醒**：可配置阈值与币种；跌破时气泡 + 表情提醒，30 分钟内不重复，点击直达充值页。
- **上下文预警**：80% / 90% 两级（可调）；每个会话每一级只提醒一次，压缩后自动重置闩锁。
- **轮次提醒**：当前会话完成/失败、后台会话完成、等待审批/回答，各有独立气泡与跳转。
- **本会话与每日统计**：四类 token、系统/工具/消息构成、今日余额变化、最近 7 天；只存本机。
- **番茄钟 / 喝水**：25/5 专注、45 分钟喝水（可改可关）；基于绝对截止时间，后台不漂移。
- **可换肤**：三套原创矢量皮肤 + 导入图片皮肤（png/jpeg/webp/gif data URL 或 https）。
- **系统通知 / 提示音**：默认关闭；页面在后台时可发通知，点击回到对应会话。
- **交互**：拖动、单击互动、双击/右键打开面板、Esc 关闭、键盘 Enter/Space 互动；隐藏后留下边缘 paw 手柄。
- **中英双语**，默认跟随 DSH 界面语言。

## 兼容性

| 项 | 范围 |
|---|---|
| DSH | `>=0.2.0-rc.2 <0.3.0`（当前验证目标 0.2.1-rc.5） |
| 客户端 | DSH Web 与内嵌该 Web 客户端的桌面应用 |
| Node（开发） | >= 20，无运行时依赖 |
| 平台 | 应用内宠物，Windows / macOS / Linux 的 Web 界面均可用 |

## 安装

先安装到 Web profile，然后**完全退出并重启** DSH（Host 会缓存插件模块），再到「插件」页启用它。

### 方式 A：GitHub Release 预构建包（最稳）

```bash
dsh plugin --profile web add https://github.com/MiaoShuYo/dsh-pet/releases/download/v0.4.0/dsh-pet-0.4.0.tgz
```

### 方式 B：直接从 GitHub 安装

```bash
dsh plugin --profile web add github:MiaoShuYo/dsh-pet#v0.4.0
```

`lib/client.js` 已提交到仓库，因此不需要在安装时执行构建脚本，也不需要 pnpm 的 `allowBuilds` 授权。Windows 独立窗口的 PowerShell helper 与宠物 PNG 已包含在包内，使用系统自带的 Windows PowerShell，不需要另外安装 Electron 或运行时。

### 方式 C：插件市场

1. 在「插件」页打开实验性的 **自定义插件市场**（若未启用）。
2. 进入 **发现 → 添加索引源**，填入：

```text
https://miaoshuyo.github.io/dsh-pet/index.json
```

3. 找到 **DSH Pet**，确认来源后安装。

> 「发现」页读取的是 GitHub Pages 索引；仓库 Settings → Pages → Source 需选择 **GitHub Actions**，release 工作流会自动部署。

### 从源码安装（开发）

```bash
git clone https://github.com/MiaoShuYo/dsh-pet.git
cd dsh-pet
dsh plugin --profile web add ./
```

### 启用与卸载

- 安装后「插件」页会出现 `dsh-pet`；如果显示为关闭，手动打开。
- 卸载：`dsh plugin --profile web remove dsh-pet`，然后重启 DSH。
- 升级：重新执行 `add`（或市场里安装新版本），再重启 DSH。

## 使用

- **拖动**：按住宠物拖动；位置以屏幕坐标保存，移动 DSH 窗口不会移动宠物。若窗口移开导致宠物完全不可见，右侧边缘会出现 paw 手柄，点击即可把它带回当前窗口右下角。
- **单击**：互动台词 + 短暂开心。
- **双击 / 右键 / 长按**：打开设置面板。
- **状态牌**：余额（点击充值）· 本会话 token（点击面板）· 上下文环 · `⋯` 快捷菜单（充值/用量/刷新/复制/设置/隐藏）。
- **任务列表**：当前会话有正在执行的任务时，宠物上方出现任务卡。后台 job 显示 `label`/进度；同步工具调用显示工具 `description`（或命令首行），运行中的命令显示“正在运行命令”。最多列 3 条，其余显示“还有 N 个任务”。可在「外观 → 显示任务列表」关闭。
- **面板页签**：状态 / 外观 / 提醒 / 专注 / 数据。
- **隐藏**：外观 → 隐藏桌宠，右侧边缘出现 paw 手柄，点击恢复。
- **演示状态**：数据 → 演示状态，可模拟任务执行、工作中、等待、低余额、上下文 90%、开心、难过，30 秒后自动结束，适合截图与验收。

### 数据来源

| 显示 | 来源 |
|---|---|
| 余额 / 账户状态 | DSH 既有 Remote：`account/getState`、`account/getBalance` |
| 本会话 token | Session projection `tokenUsage`（四类桶） |
| 上下文占用 | Session projection `contextPressure`（`projectedTokens`/`pressureTokens` ÷ `contextWindow`） |
| token 构成 | Session projection `contextBreakdown`（system / tools / messages） |
| 进行中的任务 | `ctx.jobs` 的 `job.list` 任务流 + 当前会话事件流中的 `tool/call` / `tool/result`（标题取 `arguments.description` 或命令首行） |
| 轮次/等待/完成 | Client `useSessionStatus`（running / pendingInteraction / completionUnread） |
| 今日统计 | 本机 localStorage 中的累计差值 |

插件不新增任何网络请求；余额读取复用 DSH 已经提供给账户设置页的 Remote。未登录、API-key-only、没有 token-meter 或断网时会降级显示 `—` / “账户不可用”，不影响 DSH 正常使用。

### 本机存储

| Key | 内容 |
|---|---|
| `dsh-pet:prefs:v1` | 位置、尺寸、透明度、语言、阈值、通知/声音、番茄钟等偏好 |
| `dsh-pet:skins:v1` | 导入的图片皮肤 |
| `dsh-pet:stats:v1` | 每日 token 桶与余额首末值（最多 60 天） |

清空浏览器站点数据或删除这些 key 即可重置；面板里也提供“清除统计”“导出/导入设置”。

## 皮肤

内置 `Kuro`（小黑）、`Mochi`（奶团）、`Pixel`（像素）。导入格式：

```json
{
  "format": 1,
  "kind": "image",
  "id": "night-cat",
  "name": "Night Cat",
  "images": {
    "idle": "data:image/png;base64,...",
    "working": "data:image/png;base64,...",
    "waiting": "https://example.com/waiting.png"
  }
}
```

- 只有 `idle` 必填；其余状态缺失时回退 `idle`。
- 单张 ≤ 512KB，总计 ≤ 3MB；只接受 png/jpeg/webp/gif 的 data URL 或 https URL。
- 完整规则与安全说明见 [docs/skins.md](docs/skins.md)。

## 隐私

- 不收集遥测，不上传聊天内容、token、余额或皮肤。
- 余额来自 DSH 自己的账户 Remote；插件不读取或保存凭据。
- 外部 `https:` 皮肤图片只在你主动导入并启用该皮肤时由浏览器加载；担心隐私请用 data URL。
- 统计与偏好只在本机 `localStorage`。

## 开发

```bash
npm run build      # 由 src/ 生成 lib/client.js（零依赖迷你打包器）
npm run check      # manifest / 版本 / 语法 / bundle 新鲜度 / 包装器不变量
npm test           # node:test：纯函数、store 状态机、bundle 烟测（渲染所有面板页签）
```

目录：

```text
src/shared/      纯函数：格式化、阈值、几何、偏好、皮肤校验、统计、番茄钟、气泡
src/client/      store（非 React 状态）、UI、矢量宠物、样式、词典、浏览器副作用
scripts/         build-client.mjs（零依赖打包）、check.mjs、market-index.mjs
lib/             lib/index.js（Host 空插件）+ lib/client.js（已提交的浏览器 bundle）
tests/           node:test
site/            GitHub Pages：index.html、icons/、生成的 index.json
docs/            skins.md、QA.md、preview.svg
```

本地迭代：

1. 修改 `src/` 后执行 `npm run build && npm run check && npm test`。
2. 若通过 `add ./` 链接安装，`lib/client.js` 就是插件实际加载的文件；保存后在浏览器刷新页面。若仍加载旧版，完全退出并重启 DSH。
3. 新增或修改 Host 半（`lib/index.js`、`cordis.patch.yml`）必须重启 Host。
4. 手工验收清单见 [docs/QA.md](docs/QA.md)。

> 不要只把文件复制进 `node_modules` 或手改 profile 的 `cordis.patch.yml`：插件能跑，但「插件」页不会列出它，也无法在 UI 里启停/移除。请始终用 `dsh plugin add` 安装。

## 发布到 GitHub

1. 新建仓库（建议名 `dsh-pet`），把本目录推上去。
2. 仓库地址已指向 `MiaoShuYo/dsh-pet`；如需更换账号，替换 README、`package.json`、`site/index.html` 中的 `MiaoShuYo`。
3. 仓库 Settings → Pages → Source 选择 **GitHub Actions**。
4. 发布版本：

```bash
git tag v0.4.0
git push origin v0.4.0
```

release 工作流会：

- 运行 `build` / `check` / `test`；
- `npm pack` 并把 `dsh-pet-0.4.0.tgz` 挂到 GitHub Release；
- 从所有 `v*` tag 生成 `site/index.json` 并部署到 GitHub Pages。

> 首次手动开启 Pages 时，`github-pages` 环境默认只允许 `main` 部署。如果 Release 工作流提示 “Tag `v0.4.0` is not allowed to deploy to github-pages”，到 Settings → Environments → github-pages → Deployment branches and tags 添加 `v*` tag 规则。本仓库已添加。

也可以本地预览市场索引：

```bash
npm run market:index
# 打开 site/index.json；site/index.html 可直接作为静态页预览
```

## 已知限制

- **仅 DeepSeek Platform 账户**：API-key-only 环境没有可读余额，会显示“账户不可用/未登录”，这是既有能力边界。
- **上下文占用是近似值**：分子是最近一次请求的 provider 用量（或 surface 预计值），分母是该路由声明的 `contextWindow`；切换模型时两者可能短暂配对不上。这是 DSH token-meter 自身的设计，不是插件另算。
- **仅应用内 / Windows 独立窗口**：默认仍绘制在 DSH 窗口内部；Windows 可在外观里打开独立置顶窗口，真正把宠物放到 DSH 窗口外。独立窗口是矩形透明窗口，不是逐像素点击穿透，空白区域仍会接收鼠标；macOS/Linux 暂只有应用内模式。
- **独立窗口需要 Windows PowerShell**：helper 随插件打包，不额外下载；首次打开若失败，可查看 `%LOCALAPPDATA%\\dsh-pet\\last-error.txt`。
- **DSH 预 1.0**：扩展点仍在演进；`engines.dsh` 锁定 `<0.3.0`，升级 DSH 后请先跑 `docs/QA.md`。
- 首次安装/升级后必须重启 Host，刷新页面不足以加载新的 Host 插件。

## License

MIT。所有内置宠物形象均为本项目原创矢量图形；不包含任何第三方角色素材。第三方皮肤由导入者自行负责版权。

---

## English

DSH Pet is a desktop pet for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) that lives in the Web Client's `shell.overlay` layer, with an optional **Windows always-on-top companion window** for the pet and task card. It shows account balance, per-session token usage, context-window occupancy and live running tasks.

**Highlights**

- Draggable, hideable, keyboard-accessible pet with a compact status plaque and quick menu.
- Desktop-anchored position: moving the DSH window does not move the pet; if the window moves completely away, a paw handle restores it.
- Optional **Windows always-on-top desktop window** containing the pet, live task card and compact plaque; it can sit outside DSH. Open/close from **Look → Desktop window**.
- Live task list from the client job roster **and the session event feed** (running `tool/call` entries), plus a laptop-holding busy pose while work runs.
- Body-level portal with maximum stacking: DSH chat cards and side panels cannot cover the pet (window bounds still apply).
- Low-balance, context 80/90%, turn completion/failure, background completion and waiting-for-approval bubbles.
- Session projections: `tokenUsage`, `contextPressure`, `contextBreakdown`; balance reuses the existing account Remote. No new network calls, no telemetry.
- Daily stats in `localStorage`, pomodoro/water reminders, optional OS notifications and chimes.
- Three original vector skins plus validated image-skin import/export (`docs/skins.md`).
- Chinese/English UI, light/dark theme, reduced-motion support.

**Install** (repository: `MiaoShuYo/dsh-pet`):

```bash
dsh plugin --profile web add github:MiaoShuYo/dsh-pet#v0.4.0
# or a release tarball
dsh plugin --profile web add https://github.com/MiaoShuYo/dsh-pet/releases/download/v0.4.0/dsh-pet-0.4.0.tgz
```

Restart DSH completely, then enable **dsh-pet** on the Plugins page. The market index is `https://miaoshuyo.github.io/dsh-pet/index.json`.

**Develop**

```bash
npm run build && npm run check && npm test
```

`lib/client.js` is committed because GitHub installs do not run a build. The Windows companion's PowerShell script and PNG assets are bundled; it uses the system Windows PowerShell, with no Electron or extra runtime install. See `docs/QA.md` for the manual matrix; `src/` is the source of truth, and the build has no dependencies.

**Compatibility** — DSH `>=0.2.0-rc.2 <0.3.0`; balance requires a DeepSeek Platform account. API-key-only setups show the account as unavailable. Context occupancy is the approximate value DSH itself exposes.

**License** — MIT. Built-in pet art is original vector work; no third-party character assets are bundled.
