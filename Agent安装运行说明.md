# 求职工作台：给安装 Agent 的执行说明

这份说明与 `求职工作台-源码交付版.zip` 一起交给接收方的开发 Agent。你的任务不是开发新功能，而是把项目安装到接收方电脑、成功启动，并把访问地址和必要的人工步骤告诉用户。

## 最终目标

完成后应达到：

1. Web 工作台可通过 `http://localhost:3000` 访问。
2. 简历工作台开发服务运行在 `http://127.0.0.1:3001`。
3. Typst 简历编译服务运行在 `http://127.0.0.1:8791`。
4. Chrome/Edge 可以加载解压后的 `apps/extension` 插件。

不要把项目改造成业务 Agent，不要修改产品功能，也不要要求用户提供 API Key 才能完成安装。

## 一、解压并确认目录

将 ZIP 解压到用户指定的普通工作目录，进入解压后的项目根目录。必须确认以下文件存在：

```text
package.json
README.md
apps/web/package.json
apps/web/package-lock.json
apps/resume-studio/package.json
apps/resume-studio/pnpm-lock.yaml
apps/extension/manifest.json
scripts/dev.mjs
scripts/typst-compiler.mjs
apps/web/typst/fonts
apps/web/typst/packages
```

如果缺少任何一项，停止安装并说明交付包不完整。

## 二、检查并安装系统环境

项目要求：

- Node.js `>= 22.13.0`
- npm
- pnpm
- Typst
- Poppler（必须提供 `pdftoppm`）
- Chrome 或 Edge

先执行：

```bash
node --version
npm --version
pnpm --version
typst --version
pdftoppm -v
```

缺少工具时，根据接收方操作系统使用可信的官方包管理器安装。macOS 可使用：

```bash
brew install node pnpm typst poppler
```

不要降低 Node 版本要求，也不要用来源不明的二进制文件替代 Typst 或 Poppler。

## 三、安装项目依赖

在项目根目录依次执行：

```bash
npm --prefix apps/web ci
pnpm --dir apps/resume-studio install --frozen-lockfile --ignore-scripts
```

简历工作台使用 `--ignore-scripts`，是为了避免其上游 `postinstall` 自动初始化 Husky 和下载 Puppeteer Chrome；当前工作台运行不依赖这两项。

如果下载依赖失败，先检查网络、npm/pnpm registry 和代理。不要删除锁文件，也不要直接升级依赖解决安装问题。

## 四、安装后验证

执行完整构建：

```bash
npm run build
```

构建成功后再启动：

```bash
npm run dev
```

该命令会同时启动 Web、简历工作台和 Typst 服务。保持这个进程运行，不要在启动后立即结束终端任务。

验证：

```bash
curl -I http://localhost:3000
```

同时查看启动日志，确认出现 Typst 服务监听 `127.0.0.1:8791` 的提示。若端口被占用，只能停止已确认属于本项目的旧进程；不要直接终止来源不明的进程。

## 五、浏览器插件

浏览器安全策略通常要求用户确认“加载已解压的扩展程序”。如果 Agent 有可靠的本机 GUI 操作能力，可以协助打开扩展管理页；最终仍需让用户看到并确认加载结果。

1. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择解压项目中的 `apps/extension` 目录。
5. 打开 BOSS 直聘职位详情页。
6. 点击插件图标，在头像设置中把工作台切换为 `http://localhost:3000`。

每次重新加载插件后，都要刷新已经打开的招聘页面。

## 六、AI 设置

安装和启动不需要 API Key。需要使用 AI 功能时，由用户自己在 Web 工作台“设置 → AI 设置”中填写：

- DeepSeek API Key：文字分析。
- 阿里云百炼 API Key：Qwen 视觉识别。

不要向用户索取密钥，不要替用户把密钥写进源码、`.env`、数据库或日志。

## 七、完成后向用户报告

只在以下项目确认后宣布安装完成：

- 系统依赖版本符合要求。
- 两个前端应用依赖安装成功。
- `npm run build` 成功。
- `npm run dev` 仍在运行。
- `http://localhost:3000` 可以访问。
- 已说明插件的加载步骤及 API Key 由用户在页面内自行配置。

最终回复示例：

```text
求职工作台已经安装并启动。
Web 地址：http://localhost:3000
简历工作台：http://127.0.0.1:3001
Typst 服务：http://127.0.0.1:8791
开发服务正在终端中持续运行。浏览器插件还需要你在扩展管理页确认加载 apps/extension；AI Key 请在工作台设置页自行填写。
```

如果未完成，不要笼统地说“环境问题”。请给出失败命令、核心错误、已经尝试的安全处理，以及用户下一步需要做什么。
