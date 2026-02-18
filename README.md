# BioForger

BioForger（应用名称：AiForger Pro）是一款将 **RAG（检索增强生成）** 与 **专业微调** 结合在一起的桌面工具。其核心用途是：管理本地专业知识与文档，并基于这些知识对大语言模型进行微调，最终通过 **模板** 生成符合领域规范的专业文本内容。无需自备本地 GPU，数据与 API 密钥均可由用户自行掌控。

**English:** BioForger (app name: AiForger Pro) is a desktop tool that combines **RAG (Retrieval-Augmented Generation)** and **professional fine-tuning**. It manages local professional knowledge and documents, fine-tunes LLMs with that knowledge, and generates domain-standard professional text via **templates**. No local GPU required; data and API keys stay under your control.

与仅做检索或仅做微调的工具不同，BioForger 将“知识入库 → 检索增强 → 微调训练 → 模板化输出”串联为一条流水线，适合需要**私有化、领域化**写作能力的团队：知识资产留在本地或自选云端，模型可基于自有数据微调，生成内容的口径与格式由模板统一约束，便于合规与品控。

**English:** Unlike tools that only do retrieval or only fine-tuning, BioForger chains “knowledge ingestion → RAG → fine-tuning → template-based output” into one pipeline. It targets teams that need **private, domain-specific** writing: knowledge stays local or on your chosen cloud; models are fine-tuned on your data; output format and tone are constrained by templates for compliance and quality control.

---

## 项目概述

BioForger 面向需要将 **自有专业资料**（如手册、报告、标准、问答集等）转化为 **私有、领域化写作助手** 的团队与个人。典型使用场景包括：企业知识库与内部文档的统一管理、行业规范与模板的沉淀、以及基于这些材料训练出只服务于本机构的大模型，再通过预设模板生成报告、摘要、表单等专业文本。

**English:** BioForger is for teams and individuals who want to turn **their own professional materials** (manuals, reports, standards, Q&A sets, etc.) into a **private, domain-specific writing assistant**. Typical use cases: unified management of enterprise knowledge and internal docs, curation of industry norms and templates, and training a model that serves only your organization, then generating reports, summaries, and forms via predefined templates.

**适用对象与场景**

**English: Target users and scenarios**

- 企业或机构希望把内部制度、技术文档、历史报告等整理成可检索的知识库，并让大模型在回答或起草文稿时“引用”这些材料，而不是泛化生成。
- **English:** Organizations that want to build a searchable knowledge base from internal policies, technical docs, and historical reports, and have the LLM “cite” these materials when answering or drafting, instead of generic generation.

- 需要输出固定格式文档（如周报、评审意见、合规说明）的岗位，希望模型在学会领域术语与结构后，按模板填空或扩写，减少重复劳动并统一文风。
- **English:** Roles that produce fixed-format documents (e.g. weekly reports, review comments, compliance notes) and want the model to fill or expand templates after learning domain terms and structure, reducing repetition and keeping style consistent.

- 对数据出境或第三方 API 有顾虑的团队，希望文档与标注数据留在本地，仅将“微调任务”提交到自选的云厂商，并在本地或自有环境中调用微调后的模型。
- **English:** Teams concerned about data leaving the region (数据出境) or third-party APIs prefer to keep documents and annotations local, submit only the “fine-tuning job” to a chosen cloud provider, and run the fine-tuned model locally or in their own environment.

**整体流程分为三步：**

**English: The workflow is in three steps:**

1. **管理本地知识与文档**  
   在应用内导入并整理 PDF、Word、Markdown、图片等格式的文档；对文档进行文本提取与清洗（含 OCR）、分块，并构建结构化知识库。支持目录与挂载点管理，便于对接现有文件体系。知识库既为后续检索（RAG）提供数据源，也为从文档中抽取或生成训练样本提供基础。

   **English:** Import and organize PDF, Word, Markdown, Images; extract and clean text (including OCR), chunk them, and build a structured knowledge base. Directory and mount-point support lets you plug into existing file systems. The knowledge base feeds both RAG retrieval and training sample extraction/generation.

2. **RAG + 专业微调**  
   基于知识库进行检索（RAG），为问答与写作提供依据；同时利用智能标注助手整理出指令对与问答对，形成微调训练集。将微调任务提交到云端（如 Qwen3、DeepSeek-V3/R1 等），使模型学习你的领域知识与表述习惯。RAG 与微调可单独使用，也可组合使用：例如先用 RAG 做即时检索增强，再定期用新文档微调一版专用模型，两者互补。

   **English:** Use the knowledge base for RAG to ground Q&A and writing; use the annotation assistant to build instruction/Q&A pairs and training sets. Submit fine-tuning jobs to the cloud (e.g. Qwen3, DeepSeek-V3/R1) so the model learns your domain. RAG and fine-tuning can be used alone or together (e.g. RAG for immediate retrieval, periodic fine-tuning with new docs for a dedicated model).

3. **按模板生成专业内容**  
   使用微调后的模型（或直接结合 RAG）配合 **模板**，在领域内按统一格式生成报告、摘要、说明等专业文本，保证风格与术语一致。模板可约束输出结构、必填项与示例，降低幻觉并提高可用性。

   **English:** Use the fine-tuned model (or RAG) with **templates** to produce reports, summaries, and other professional text in a consistent format. Templates constrain structure, required fields, and examples to reduce hallucination and improve usability.

数据与 API 密钥均由用户自行掌控；后端可本地运行，微调可选用指定的云端 API，便于在合规与成本之间做平衡。

**English:** Data and API keys stay under your control; the backend runs locally and fine-tuning uses your chosen cloud APIs, balancing compliance and cost.

---

## 工作流程

**主流程示意**  
**English: Main flow**

```
本地文档 → 导入与分块 → 知识库（RAG）
                              ↓
指令/问答对 ← 标注助手（云端模型）
                              ↓
云端微调（Qwen3 / DeepSeek-V3/R1 等）
                              ↓
微调模型 + 模板 → 专业文本生成
```

```
Local docs → Ingest & chunk → Knowledge base (RAG)
                                        ↓
Instruction/Q&A pairs ← Annotation assistant (cloud model)
                                        ↓
Cloud fine-tuning (Qwen3 / DeepSeek-V3/R1, etc.)
                                        ↓
Fine-tuned model + templates → Professional text generation
```

**各阶段简要说明**

**English: Stage summary**

- **导入与分块**：文档上传后经解析（PDF/Word/MD 等）、可选 OCR（图片）、文本清洗与分块，写入 SQLite 并可选同步到向量库（Chroma），供全文与语义检索。
- **English:** Documents are parsed, optionally OCR’d, cleaned, and chunked; stored in SQLite and optionally synced to Chroma for full-text and semantic search.

- **知识库（RAG）**：用户或应用在问答/写作时，可先根据问题或上下文检索相关片段，再将片段与问题一并交给模型，实现“检索增强”的生成，减少编造。
- **English:** At query or writing time, retrieve relevant chunks from the knowledge base and pass them with the question to the model for retrieval-augmented generation, reducing fabrication.

- **标注与训练集**：从知识库或人工撰写中产生“问题/指令 + 期望回答”的配对，由智能标注助手辅助扩充；训练集在应用内持久化，可多次用于微调或版本对比。
- **English:** Build “question/instruction + expected answer” pairs from the knowledge base or manual input, with the annotation assistant; training sets are persisted in-app for repeated fine-tuning and versioning.

- **云端微调**：将训练集提交到所选的云厂商（如阿里 DashScope、Fireworks.ai、Together AI 等），训练得到适配你领域的模型；训练完成后可在应用内配置调用该模型。
- **English:** Submit training sets to your chosen cloud provider (e.g. DashScope, Fireworks.ai, Together AI) to train a domain-adapted model; then configure the app to call that model.

- **模板与生成**：在界面中选用或编辑模板，指定结构、占位符与示例；生成时由微调模型（或 RAG）按模板输出报告、摘要等，保证格式统一。
- **English:** Select or edit templates (structure, placeholders, examples) in the UI; generation uses the fine-tuned model or RAG to output reports and summaries in a consistent format.

流程中“标注”与“微调”为可选：若仅需检索增强，可只使用知识库 + RAG；若需更强领域表现，再引入微调与模板。

**English:** Annotation and fine-tuning are optional: use only knowledge base + RAG for retrieval-augmented use; add fine-tuning and templates when you need stronger domain performance.

---

## 功能特性

### 本地知识与文档管理

- 支持上传并整理 **PDF、Word、Markdown、图片** 等格式；支持对图片类文档进行 **OCR** 识别，并可选文本清洗与去噪。
- **English:** Upload and organize PDF, Word, Markdown, images; OCR for image-based docs; optional text cleaning and denoising.

- 文档经 **分块** 后存入本地数据库，并可同步到向量库（Chroma），便于按语义检索；同时支持 **全文检索**，适合精确关键词查找。
- **English:** Chunked documents are stored locally and optionally in Chroma for semantic search; full-text search is also supported for keyword lookup.

- 支持 **目录与挂载点** 管理：可将本地或网络盘上的某一路径挂载为文档来源，便于对接现有文件体系或批量导入，无需逐一手动上传。
- **English:** Directory and mount-point support: mount a local or network path as a document source for bulk import without manual uploads.

- 适用于构建企业知识库、项目文档集、规范与模板库等，为后续 RAG 与微调提供统一数据基础。
- **English:** Suited for enterprise knowledge bases, project doc sets, and standards/template libraries as a single data foundation for RAG and fine-tuning.

### RAG 知识库

- 基于已导入文档 **构建并查询** 知识库：检索时可结合关键词与向量相似度，返回与问题或主题相关的片段。
- **English:** Build and query a knowledge base from imported docs; retrieval combines keywords and vector similarity to return relevant chunks.

- 既可用于 **检索增强式问答**（用户提问时先检索再生成），也可作为 **微调训练数据的来源**：从检索结果或文档中抽取或生成指令/问答对，使模型学习领域表述与结构。
- **English:** Use for retrieval-augmented Q&A (retrieve then generate) or as a source of training data: extract or generate instruction/Q&A pairs for fine-tuning domain style and structure.

- 知识库数据存于本地（SQLite + Chroma），不依赖外网即可完成检索与展示，适合内网或离线环境。
- **English:** Knowledge base data is stored locally (SQLite + Chroma); retrieval works without internet, suitable for air-gapped or offline environments.

### 标注与训练集

- 提供 **智能标注助手**（基于云端大模型）自动或半自动生成 **指令对** 与 **问答对**：可从文档片段、知识库检索结果或用户输入中生成“问题/指令 + 标准回答”，用于微调训练。
- **English:** A smart annotation assistant (cloud LLM) generates instruction and Q&A pairs from doc chunks, retrieval results, or user input for fine-tuning.

- 支持将标注结果 **保存为训练集** 并统一管理：可按项目或版本命名，便于多次微调、对比效果或回滚；训练集在应用内持久化，无需单独导出即可提交到云端微调任务。
- **English:** Save annotations as training sets and manage them by project or version; training sets are persisted in-app and can be submitted to cloud fine-tuning without separate export.

- 适合在已有知识库基础上快速扩充高质量训练样本，降低人工标注成本。
- **English:** Helps scale high-quality training data from an existing knowledge base with less manual labeling.

### 专业微调

- 支持向云端提交 **微调任务**，例如 **Qwen3**（通过阿里云 DashScope）、**DeepSeek-V3/R1**（通过 Fireworks.ai 或 Together AI）；使用自有知识训练出 **领域专用模型**，再在应用内通过模板或对话调用。
- **English:** Submit fine-tuning jobs to the cloud (e.g. Qwen3 via DashScope, DeepSeek-V3/R1 via Fireworks.ai or Together AI) to train a domain-specific model, then call it from the app via templates or chat.

- 微调流程在应用内可完成：选择训练集、选择基座与云厂商、提交任务、等待完成、配置新模型端点；无需在云控制台反复切换，适合定期迭代与多版本管理。
- **English:** Full fine-tuning flow in-app: choose training set, base model, and provider; submit; wait for completion; configure the new model endpoint—no need to switch between cloud consoles; good for iterative and multi-version management.

- 训练数据与 API 密钥由用户自行配置与保管；仅将训练任务与必要参数提交到所选云厂商，便于满足数据与合规要求。
- **English:** Training data and API keys are configured and held by the user; only job and necessary parameters are sent to the chosen provider for data and compliance.

### 基于模板的专业内容生成

- 使用微调后的模型（或 RAG）配合 **预设模板**，按统一格式生成报告、摘要、表单等专业文本：模板可定义标题、小节、必填项与示例，减少重复劳动并 **保持输出风格一致**。
- **English:** Use the fine-tuned model (or RAG) with **preset templates** to generate reports, summaries, and forms in a consistent format; templates define title, sections, required fields, and examples for consistent style.

- 适合周报、评审意见、合规说明、技术说明等需要固定结构的文档；可先在小范围试用模板与模型，再推广到团队。
- **English:** Suited for fixed-structure docs (weekly reports, review comments, compliance notes, technical specs); pilot templates and models before rolling out to the team.

### 隐私与安全

- **API 密钥加密存储**：在应用内配置的云厂商 API 密钥经加密后保存，降低泄露风险。
- **English:** API keys are stored encrypted in the app to reduce exposure.

- **可配置的数据脱敏与审计日志**：可根据需要开启或扩展审计能力，便于追溯谁在何时使用了哪些能力。
- **English:** Configurable data masking and audit logging for traceability of who used what and when.

- **后端可完全在本地运行**：文档、知识库与业务逻辑均可在本机或内网完成；仅微调与部分推理依赖云端时，可自选厂商与区域。
- **English:** Backend can run entirely locally; only fine-tuning and optional inference need the cloud, with your choice of provider and region.

- **桌面端采用 Tauri 构建**：可将 Python 后端与前端一起打包为单一桌面应用（含后端 exe），便于在内网或离线环境中分发与部署，无需单独安装 Python 或 Node。
- **English:** Desktop app is built with Tauri; the Python backend can be bundled as a single app (including backend exe) for distribution without installing Python or Node.

---

## 技术栈

| 层级     | 技术 | 说明 |
|----------|------|------|
| 桌面壳   | Tauri 2.x (Rust) | 提供跨平台窗口、系统集成与后端进程管理；通过 HTTP 与本地 Python 后端通信。 |
| 前端     | React + TypeScript + Vite | 界面与交互；Vite 负责开发热更新与生产构建。 |
| 后端     | Python 3 + FastAPI | 文档解析、知识库、RAG、标注、微调提交与训练集管理等 API；可独立部署或打包为 exe。 |
| 文档处理 | LangChain / LlamaIndex | 文档加载、分块与向量化等；与后端服务协同完成知识库构建与检索。 |
| 数据库   | SQLite + Chroma | SQLite 存元数据与业务数据；Chroma 作向量库，支持语义检索。 |
| API      | LiteLLM、OpenAI 兼容接口 | 统一对接多种云厂商与本地模型（如 Ollama），便于切换推理与微调端点。 |

**English:** Desktop: Tauri 2.x (Rust)—windows, system integration, backend process management, HTTP to local Python. Frontend: React + TypeScript + Vite. Backend: Python 3 + FastAPI—doc parsing, knowledge base, RAG, annotation, fine-tuning, training sets; deployable or packaged as exe. Document: LangChain / LlamaIndex. DB: SQLite + Chroma (vector store). API: LiteLLM, OpenAI-compatible for multiple providers and local models (e.g. Ollama).

前端与后端通过 **HTTP（本地端口）** 通信；桌面端负责启动/停止后端进程、解析配置中的端口与资源路径，并将用户操作转发到后端 API。构建时可将后端打包为单文件 exe，随 Tauri 应用一起分发。

**English:** Frontend and backend communicate over HTTP on a local port; the desktop shell starts/stops the backend, reads config (port, paths), and forwards user actions to the backend API. The backend can be built as a single exe and shipped with the Tauri app.

---

## 环境要求

- **Node.js 与 npm**  
  用于前端开发及 Tauri 桌面壳的构建。建议使用当前 LTS 版本；安装后可在终端执行 `node -v` 与 `npm -v` 确认。

  **English:** Required for frontend and Tauri build. Use current LTS; verify with `node -v` and `npm -v`.

- **Python 3.8+**  
  用于运行后端服务；建议使用 **3.10 及以上**版本以保证依赖兼容（部分库如 LangChain/Chroma 在新版 Python 下表现更稳定）。请确保 `python` 与 `pip` 在系统 PATH 中可用。

  **English:** Required for backend; 3.10+ recommended for dependency compatibility. Ensure `python` and `pip` are on PATH.

- **Rust 与 Cargo**  
  Tauri 基于 Rust，构建桌面应用前需安装 Rust 工具链。可参考 [rustup](https://rustup.rs/) 官方指引安装；安装后执行 `cargo -v` 确认。

  **English:** Required for Tauri. Install via [rustup](https://rustup.rs/); verify with `cargo -v`.

- **Tesseract OCR**（可选）  
  若需对 **图片类文档** 做文字识别，请在本机安装 Tesseract 并在系统路径中可用；后端通过 `pytesseract` 调用。未安装时，图片文档将无法提取文字，仅可作附件或需手动录入。

  **English:** Optional; required for image OCR. Backend uses `pytesseract`; without Tesseract on PATH, image text cannot be extracted.

- **PyInstaller**（可选）  
  仅当需要将 Python 后端 **打包为独立 exe** 并随桌面应用分发时才需要。可通过 `pip install pyinstaller` 安装；若只做开发或后端单独部署，可不安装。

  **English:** Optional; required only to bundle the backend as a standalone exe. Install with `pip install pyinstaller`.

**建议**：首次构建前在仓库根目录依次执行 `npm install`、`cd python-backend && pip install -r requirements.txt`，并完成数据库初始化（见下节），再执行 Tauri 构建，可减少因依赖缺失导致的构建失败。

**English:** Before first build, run `npm install`, then `cd python-backend && pip install -r requirements.txt`, initialize the database (see below), then run the Tauri build to avoid dependency-related failures.

---

## 编译构建

### 1. 安装前端依赖

在仓库根目录执行：

**English: From repo root run:**

```bash
npm install
```

若需使用国内镜像，可配置 npm 或使用 `npm install --registry=...`；安装完成后会生成 `node_modules` 与锁文件。

**English:** Use a private registry if needed (e.g. `npm install --registry=...`); this creates `node_modules` and lock file.

### 2. 安装 Python 后端依赖

进入后端目录并安装依赖后返回根目录：

**English: Install backend dependencies then return to root:**

```bash
cd python-backend
pip install -r requirements.txt
cd ..
```

建议在虚拟环境中执行（如 `python -m venv .venv` 再激活），避免与系统 Python 冲突。若某依赖安装失败，可先单独安装其前置（如部分库要求 `pandas`），再重试。

**English:** Prefer a venv (`python -m venv .venv` then activate). If a dependency fails, install its prerequisites (e.g. `pandas`) first if needed, then retry.

### 3. 初始化数据库

数据库初始化脚本需在 **`python-backend/database`** 目录下执行，以便正确解析模块路径（脚本内使用 `from models import init_database`，依赖当前工作目录为 `database`）。在仓库根目录下操作时，可按以下方式进入该目录并执行：

**English:** The init script must be run from **`python-backend/database`** so `from models import init_database` resolves. From repo root:

Windows：

```bash
cd python-backend\database
python init_db.py
cd ..\..
```

类 Unix 系统：

```bash
cd python-backend/database && python init_db.py && cd ../..
```

执行成功后，会在 `python-backend` 下生成 **`aiforger.db`**（或你在配置中指定的路径）。若该文件已存在，`init_database` 会按现有模型创建缺失表，一般不会清空已有数据；若需从头重建，请先备份或删除旧库文件后再执行。

**English:** This creates **`aiforger.db`** under `python-backend` (or your configured path). If the file exists, missing tables are created without wiping data; to rebuild from scratch, backup or remove the old DB first.

### 4. 构建应用

打包前若需清理本机测试数据（会备份后删除仓库内 `aiforger.db`/`privatetune.db` 并将 `bioforger-config.json` 重置为仅含 `backendPort`），可先执行：`npm run clean:test-data`，再按下列步骤构建。

**English:** Before packaging, to clean local test data (backup then remove in-repo `aiforger.db`/`privatetune.db` and reset `bioforger-config.json` to default), run: `npm run clean:test-data`, then build as below.

分两种方式：

**English: Two build modes:**

- **仅前端 + Tauri（不打包后端）**  
  只构建桌面壳与前端资源，后端需在本机单独运行（例如在 `python-backend` 下执行 `python main.py`）。适合开发或后端常驻运行的场景。命令为：

  **English:** Desktop + frontend only; run backend separately (`python main.py` in `python-backend`). Good for development.

```bash
npm run build
npm run tauri build
```

- **完整构建（前端 + Tauri + 后端 exe）**  
  先使用 PyInstaller 将 Python 后端打成单文件 exe（生成在 `python-backend/dist/aiforger-backend.exe`），再由 Tauri 将该 exe 打包进桌面应用，实现“双击即用”。可分步执行：

  **English:** Full build: PyInstaller produces `python-backend/dist/aiforger-backend.exe`, then Tauri bundles it for a single “double-click” app.

```bash
npm run build
npm run build:backend
npm run tauri build
```

也可直接执行 `npm run tauri build`：Tauri 的 `beforeBuildCommand` 会依次执行 `npm run build` 与 `npm run build:backend`。若本机未安装 PyInstaller 或打包失败，可先完成前两步构建，再单独运行后端。

**English:** Or run `npm run tauri build` alone (beforeBuildCommand runs the above). If PyInstaller is missing or fails, build the first two steps and run the backend separately.

**构建产物**：位于 `src-tauri/target/release/` 下（Windows 下例如 **`aiforger-pro.exe`**）。若为完整构建，后端 exe 等资源会出现在该目录或已安装应用的 resources 中；首次运行时会根据配置或端口占用情况启动后端进程。

**English:** Output is under `src-tauri/target/release/` (e.g. **`aiforger-pro.exe`** on Windows). With full build, the backend exe is in that directory or in the app’s resources; backend is started on first run based on config or port availability.

**常见问题**：若 Tauri 构建报错与 Rust/Node 相关，可检查 Rust 与 Node 版本是否符合要求；若后端打包失败，可查看 `python-backend/build` 下日志，或先在本机直接运行 `python main.py` 确认后端无报错后再打包。

**English:** If Tauri build fails, check Rust and Node versions. If backend packaging fails, check `python-backend/build` logs or run `python main.py` locally to confirm the backend runs before packaging.

---

## 运行

### 开发模式

**English: Development**

1. **启动 Python 后端**  
   在仓库根目录下执行：

   **English: From repo root:**

```bash
cd python-backend
python main.py
```

后端默认监听 **`http://127.0.0.1:8778`**。若需更换端口，可设置环境变量 `PORT`（例如 Windows 下 `set PORT=9000`，类 Unix 下 `PORT=9000 python main.py`）。若端口被占用，会提示“Port already in use”并退出，请关闭占用进程或换端口。

**English:** Backend listens on **`http://127.0.0.1:8778`** by default. Set `PORT` to change (e.g. Windows `set PORT=9000`, Unix `PORT=9000 python main.py`). If the port is in use, the process exits; free the port or use another.

2. **启动 Tauri 开发客户端**  
   另开一个终端，在仓库根目录执行：

   **English: In another terminal, from repo root:**

```bash
npm run tauri dev
```

前端由 Vite 提供热更新；应用会通过配置中的后端端口（见下方“配置与运行规则”）连接本地后端。若后端未启动或端口不一致，界面中与后端交互的功能会报错，请先确认后端已启动且端口与配置一致（默认 8778）。

**English:** Vite serves the frontend with HMR; the app connects to the backend on the configured port (see Configuration). If the backend is down or the port is wrong, backend-related features will fail—ensure the backend is up and the port matches (default 8778).

3. **健康检查**  
   后端启动后可在浏览器访问 `http://127.0.0.1:8778/health`，若返回 `{"status":"ok"}` 表示后端正常。

**English:** After starting the backend, open `http://127.0.0.1:8778/health` in a browser; `{"status":"ok"}` means it’s running.

### 正式运行（已构建应用）

**English: Production (built app)**

- **已打包后端**  
  直接运行构建出的 Tauri 可执行文件即可；应用会自动启动同捆的 `aiforger-backend.exe`（通常从同目录或 resources 中查找），无需单独开后端进程。若杀毒软件拦截，需放行该 exe 或整个应用目录。

  **English:** Run the Tauri executable; it will start the bundled `aiforger-backend.exe`. If antivirus blocks it, allow the exe or app directory.

- **未打包后端**  
  需先在本机启动后端（同上，在 `python-backend` 下执行 `python main.py`），再运行桌面可执行文件（例如 Windows 下 `src-tauri\target\release\aiforger-pro.exe`）。此时后端与桌面端需使用同一端口（默认 8778，或与 `bioforger-config.json` 中 `backendPort` 一致）。

  **English:** Start the backend first (`python main.py` in `python-backend`), then run the desktop exe (e.g. `src-tauri\target\release\aiforger-pro.exe` on Windows). Backend and desktop must use the same port (default 8778 or `backendPort` in config).

---

## 配置与运行规则

- **后端端口**  
  默认端口为 **8778**。可通过环境变量 **`BIOFORGER_BACKEND_PORT`** 覆盖，或在配置文件 **`bioforger-config.json`** 中设置 **`backendPort`**。桌面端与后端必须使用同一端口，否则前端无法连接；若使用自动端口（见下“端口占用”），两端会通过配置文件同步端口。

  **English:** Default port **8778**. Override with **`BIOFORGER_BACKEND_PORT`** or **`backendPort`** in **`bioforger-config.json`**. Desktop and backend must use the same port; auto port (see below) is synced via config.

- **配置文件 bioforger-config.json**  
  可配置项包括：**`backendPort`**（后端 HTTP 端口）、**`dbPath`**（SQLite 数据库文件完整路径，如 `aiforger.db`）、**`documentsDir`**（默认文档根目录，用于上传与挂载的默认路径）。  
  桌面端从 **应用配置目录** 读取该文件（例如 Windows 下为 `%APPDATA%\com.aiforger.pro\`）；后端则从环境变量 **`BIOFORGER_CONFIG_PATH`** 指定路径读取，若未设置则使用 **`python-backend/bioforger-config.json`**。  
  若首次运行由桌面端创建配置（例如自动选择端口），可能只在应用配置目录下生成；后端若需共用，需将 `dbPath`、`documentsDir` 等同步到后端可读路径，或设置 `BIOFORGER_CONFIG_PATH` 指向同一文件。

  **English:** Keys: **`backendPort`**, **`dbPath`** (full path to SQLite file), **`documentsDir`** (default doc root). Desktop reads from app config dir (e.g. Windows `%APPDATA%\com.aiforger.pro\`); backend reads from **`BIOFORGER_CONFIG_PATH`** or **`python-backend/bioforger-config.json`**. If the desktop creates the config first (e.g. auto port), the backend may need the same file via `BIOFORGER_CONFIG_PATH` or a copy with matching `dbPath`/`documentsDir`.

- **数据库路径**  
  后端使用环境变量 **`BIOFORGER_DB_PATH`** 作为数据库路径；若未设置，则使用配置文件中的 **`dbPath`**，或默认 **`python-backend/aiforger.db`**（兼容旧的 `python-backend/privatetune.db`）。请确保运行用户对该路径具备读写权限；若将数据库放在网络盘或同步目录，需注意并发与锁，建议单进程使用。

  **English:** Backend uses **`BIOFORGER_DB_PATH`** or config **`dbPath`** or default **`python-backend/aiforger.db`** (compatible with legacy `python-backend/privatetune.db`). Ensure write access; avoid network or sync folders for the DB if possible; single process recommended.

- **单实例**  
  应用通过单实例插件限制同一用户仅能打开一个主窗口；重复启动时会激活已有窗口而非再开新进程，避免多进程同时写同一数据库或配置造成冲突。

  **English:** Single-instance: only one main window per user; relaunch activates the existing window to avoid duplicate processes and DB/config conflicts.

- **端口占用**  
  若默认端口 8778 已被占用，应用可能会在 **8779–8978** 范围内自动选取可用端口，并将结果写入 **`bioforger-config.json`** 的 `backendPort`。此时启动后端时需通过环境变量 **`PORT`** 或 **`BIOFORGER_BACKEND_PORT`** 指定相同端口，否则前端无法连接。建议在固定端口场景下主动在配置中设置 `backendPort`，避免自动切换导致前后端不一致。

  **English:** If 8778 is busy, the app may pick a port in **8779–8978** and write it to **`bioforger-config.json`**. Start the backend with the same **`PORT`** or **`BIOFORGER_BACKEND_PORT`**. For a fixed port, set **`backendPort`** in config explicitly.

---

## 项目结构

```
.
├── src/                      # React 前端
│   ├── components/           # UI 组件（布局、列表、表单、设置等）
│   ├── i18n/                 # 国际化文案（如中文、英文）
│   └── App.tsx               # 根组件与路由
├── src-tauri/                # Tauri 桌面壳
│   ├── src/
│   │   ├── lib.rs             # Tauri 命令注册、后端进程启动/停止
│   │   ├── backend_url.rs     # 后端端口与 URL 解析、配置读写
│   │   └── commands/         # 对 Python 后端的 HTTP 封装（文档、标注、微调等）
│   └── tauri.conf.json        # Tauri 构建与打包配置
├── python-backend/
│   ├── main.py               # FastAPI 入口（独立运行）
│   ├── backend_gui_host.py   # PyInstaller 打包入口（无控制台窗口）
│   ├── api/                  # 路由、中间件、DB 依赖注入
│   ├── database/              # 模型定义、init_database、init_db.py
│   ├── services/              # 文档解析、RAG、标注、微调等业务逻辑
│   ├── requirements.txt
│   ├── dist/                 # PyInstaller 输出（如 aiforger-backend.exe）
│   └── aiforger.db           # SQLite 库（由 init_db 创建；兼容旧的 privatetune.db）
└── package.json              # npm 脚本（dev、build、tauri、build:backend）
```

**English:** `src/`: React frontend (components, i18n, App). `src-tauri/`: Tauri shell (lib.rs, backend_url.rs, commands, tauri.conf.json). `python-backend/`: FastAPI app (main.py, backend_gui_host.py), api, database, services, requirements.txt, dist (exe), aiforger.db (legacy privatetune.db). Root: package.json.

**扩展与二次开发**：前端可修改 `src` 下组件与路由；后端可扩展 `api` 下路由与 `services` 下业务；数据库模型在 `python-backend/database/models.py`，新增表或字段后需在迁移或初始化逻辑中体现。Tauri 侧新增命令需在 `lib.rs` 与对应 `commands` 模块中注册并实现 HTTP 转发。

**English:** Extend: edit components/routes in `src`; add routes in `api` and logic in `services`; update models in `python-backend/database/models.py` and migrations/init; register new Tauri commands in `lib.rs` and `commands`, and implement HTTP forwarding.

---

## 可选：API 密钥与外部服务

- **云端微调**  
  在应用的 **隐私/API 设置** 中配置各云厂商的 API 密钥，例如 **DashScope（Qwen）**、**Fireworks.ai**、**Together AI** 等，以便提交微调任务并拉取模型。密钥经加密后保存于本地；仅在与对应厂商通信时使用，不上传到其他第三方。各厂商计费与配额请以厂商文档为准；建议先在测试环境或小规模数据上验证流程与成本。

  **English:** In the app’s privacy/API settings, configure API keys for DashScope (Qwen), Fireworks.ai, Together AI, etc., for fine-tuning and model access. Keys are stored encrypted locally and used only when talking to that provider. Check each provider’s pricing and quotas; test with small data first.

- **Ollama**  
  若希望使用 **本地模型** 进行推理或标注，可在设置中配置 Ollama 的 base URL（例如 `http://localhost:11434`）。应用会通过 OpenAI 兼容接口与之通信；需先在本机安装并启动 Ollama，并拉取所需模型。本地模型适合内网或对数据不出境有要求的场景，推理速度与效果取决于本机配置与模型大小。

  **English:** To use a **local model** (e.g. via Ollama), set the Ollama base URL in settings (e.g. `http://localhost:11434`). The app uses the OpenAI-compatible API; install and run Ollama and pull the model locally. Suited for air-gapped or data-sovereignty needs; performance depends on hardware and model size.

---

## 许可与命名

- 本仓库名称：**BioForger**
- 应用产品名称：**AiForger Pro**，在 **`src-tauri/tauri.conf.json`**（如 `productName`、窗口标题）与 **`package.json`** 中均有体现。安装包或关于界面中的名称以 Tauri 配置为准；对外宣传或文档中可同时使用 BioForger 与 AiForger Pro 以区分仓库与产品名。

**English:** Repository name: **BioForger**. App product name: **AiForger Pro** (see `src-tauri/tauri.conf.json` and `package.json`). Use both names as needed to distinguish repo vs. product in docs and marketing.
