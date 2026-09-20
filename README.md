# 求职工作台 MVP

产品目标是以职业档案作为可信事实底座，通过“岗位分析 → 投递准备 → 正式投递 → 面试准备 → 面试复盘”的岗位工作流连接插件、Web 工作台和 Tracker。当前仓库中的代码仍是联动 Demo，目标需求以以下文档为准：

- [产品需求文档 V0.5](./产品需求文档.md)
- [UI 设计文档 V0.6](./UI设计文档.md)
- [浏览器插件功能与技术设计文档 V0.5](./浏览器插件功能与技术设计文档.md)
- [产品决策记录](./产品决策记录.md)

第一版包含两个可联动的应用：

- apps/web：收藏职位工作台，负责持久化、搜索、查看和删除收藏职位。
- apps/extension：Chrome/Edge Manifest V3 插件，支持默认页面浮窗和可选侧边栏，负责识别 BOSS 直聘当前岗位、公司 Logo、收藏、匹配 Demo、手动录入和查看最近收藏。

## 本地启动

### 1. 启动工作台

环境要求：Node.js >= 22.13.0、npm、pnpm、Typst 和 Poppler（`pdftoppm`）。首次启动前安装依赖：

```bash
npm --prefix apps/web ci
pnpm --dir apps/resume-studio install --frozen-lockfile --ignore-scripts
```

完整安装与验证步骤见 [安装运行说明](./Agent安装运行说明.md)。`apps/resume-studio` 包含简历编辑器的完整源码，`apps/web/typst` 包含编译所需的模板包和字体。

首次运行后在项目根目录执行 `npm run dev`。它会同时启动工作台、简历工作台和本地 Typst 编译器；简历 PDF 由真实 `.typ` 源模板编译，不需要 Docker、TeX Live 或 XeLaTeX。

工作台默认运行在 http://localhost:3000。首次访问收藏接口时会自动初始化本地 D1 数据表。

### 2. 安装浏览器插件

1. Chrome 打开 chrome://extensions。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目的 apps/extension 目录。
5. 打开 BOSS 直聘职位详情页，点击浏览器工具栏中的“求职工作台”。

插件默认连接公开工作台 https://qiuzhi-job-workbench.eichornaskew.chatgpt.site。点击插件右上角头像可以切换到本地地址 http://localhost:3000。

## 第一版联动

BOSS 职位详情页 → 插件识别并预览岗位 → 用户确认收藏 → API 写入 D1 → 插件显示收藏成功和最近收藏 → Web 工作台在 3 秒内自动刷新岗位库。

当前匹配仍为前端 Demo，不进行真实模型识别。正式 AI 服务已确定使用 `deepseek-v4-flash`，由 Web 服务端统一调用；插件和浏览器前端不得保存 DeepSeek API Key。简历管理采用“列表 → 创建 → 编辑/预览”的流程。

后续产品范围包括五阶段岗位工作流、投递准备清单、三层面试问题树和对话式回答打磨；用户主动上传录音后的转写与 AI 复盘属于 P1。自动投递、自动打招呼以及未经授权读取招聘平台已读或招聘者信息不在产品范围内。
