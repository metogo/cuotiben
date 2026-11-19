# 拾题 · 家庭错题本

React H5。家长可拍照圈题或粘贴老师发的题目，核对题干、参考答案和孩子原作答，选择讲解模型并按步展开提示。主动收录才计入错题本，独立重做后由家庭自评决定订正状态。题本使用当前浏览器的 IndexedDB，每次打开从实际存储读取。

## 本机运行

使用 Node 24。安装锁定依赖后启动网页。

```sh
npm ci
npm run dev -- --port 43872 --strictPort
```

在项目根目录的本地服务端环境设置 `REQUESTY_API_KEY`。默认网关为用户确认的 Requesty 全球入口。服务端限定模型、输入结构与输出长短，浏览器只与本站交互。密钥不会被打进 Vite 客户端。[Requesty 接入说明](https://docs.requesty.ai/quickstart)

豆包通过现有辅导作业服务处理。开发环境可用 `LEARNING_SERVICE_ORIGIN` 指向现有服务的本地实例，实例的 `PUBLIC_APP_ORIGIN` 须为实际访问的 H5 地址。本机联调端口分别为 43872 和 43873。保留服务本身的同意、发题和额度校验。实际拥有的服务端账号决定可用性。

题图只裁取本题选区。上传识别须在构建时配置已经确认的中文图片处理与留存说明 `VITE_RETENTION_NOTICE`。未配置时，选区留在当前设备，家长可以对照图输入题干再选任一模型做文字解析。老师提供的参考答案保存在本机，完整解法及订正对照页才展开。

## 预览和发布

Vercel 使用 Vite 构建及原生 Node 函数。临时匿名链接可验页面、粘贴和圈题。线上真实推理需要受管理的预览环境设置服务端密钥、控制试用访问，并由辅导作业服务认可预览来源。试用域名变化会产生新的浏览器存储空间。后续每用户每日 30 次的规则待跨模型统一实施。

## 验证

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

真实质量验收使用香港考评局三年级原卷。以下命令下载 PDF 到指定测试目录，题面与标准答案独立保存在验收端。网页不包含样题。准备需使用 curl 和 Poppler 的 pdftotext。运行 evaluate 会产生真实的 Requesty 推理费用。输出有各题答案、讲解、耗时和服务返回的费用；如只复测一个模型，在命令末尾追加其完整模型 ID。

```sh
python3 scripts/public-papers.py /tmp/shiti-papers
SHITI_PUBLIC_CASES=/tmp/shiti-papers/cases.json npm test
node --env-file=.env.local scripts/evaluate.mjs /tmp/shiti-papers/cases.json /tmp/shiti-results.json
```

需求、交互和独立任务详见[需求文档](家庭错题本-H5需求文档.md)、[交互设计](家庭错题本-H5交互设计.md)和[开发计划](docs/plans/2026-11-19-h5-development.md)。本轮实测数据见[模型验收](docs/qa/模型验收.md)。

手机流程可用本机的 Puppeteer 和 Chromium 运行。下列命令使用同一份公开 PDF，按原卷坐标实际圈第 4、6 题，用真实请求验两题收录、订正和刷新后回读。验收使用独立浏览器，本机用户的题本不参与测试。

```sh
pdftoppm -f 3 -l 3 -singlefile -r 140 -png /tmp/shiti-papers/math.pdf /tmp/shiti-papers/math-page-3
SHITI_PAPERS=/tmp/shiti-papers node scripts/browser-acceptance.cjs
```

可通过 `PUPPETEER_MODULE` 和 `CHROME_PATH` 指定已有测试工具的位置。
