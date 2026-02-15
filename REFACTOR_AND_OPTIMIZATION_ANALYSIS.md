# BioForger / PrivateTune Pro – Refactor and Optimization Analysis

## 1. Project Overview

- **Product**: Desktop client for private LLM fine-tuning (knowledge base + annotation + cloud fine-tuning + evaluation).
- **Stack**: Tauri 2 + React + TypeScript (frontend), Python FastAPI (backend), SQLite + Chroma, Rust bridge (Tauri commands call backend via inline Python/requests to `127.0.0.1:8778`).

---

## 2. Architecture Summary

| Layer | Technology | Notes |
|-------|------------|--------|
| UI | React 19, TypeScript, Vite, i18n (en/zh) | Single App.tsx router; no React Router |
| Shell | Tauri 2 | Starts Python backend, proxies API via Rust commands that run inline Python scripts |
| Backend | FastAPI, Uvicorn | Single `api/routes.py`; no APIRouter split |
| Data | SQLite (SQLAlchemy), Chroma | Documents + directories + mount points + training set + jobs |
| AI | OpenAI-compatible (DeepSeek), LangChain, Chroma RAG | Annotation + RAG + placeholder fine-tuning |

**Data flow**: Frontend `invoke('tauri_command')` → Rust runs `python -c "requests.post('http://127.0.0.1:8778/...')"` → FastAPI handles request.

---

## 3. Critical Issues

### 3.1 Oversized Files (Refactor Required)

| File | Lines | Suggestion |
|------|--------|------------|
| `python-backend/api/routes.py` | **~2217** | Split into multiple routers (see 4.1). |
| `src-tauri/src/lib.rs` | **~2180** | Extract HTTP client + base URL; reduce inline Python scripts (see 4.2). |
| `src/components/DataCenter.tsx` | **~1528** | Split into subcomponents + custom hooks (see 4.3). |
| `src/components/KnowledgeBaseWorkspace.tsx` | **~1078** | Split views and hooks. |
| `src/components/FileResourcesWorkspace.tsx` | **~937** | Split by feature (mount points, file list, preview). |
| `src/components/ProductionTuning.tsx` | **~834** | Split tabs/panels. |
| `src/components/TrainingLab.tsx` | **~788** | Extract list/detail and API hooks. |

Rule of thumb used: single file &gt; 800 lines should be split; C++/Rust &gt; 1000 lines should be refactored.

### 3.2 Backend Port Hardcoded in Tauri Commands

- Backend port is resolved dynamically in `ensure_python_backend_running()` and written to config; Python is started with `PORT` and `BIOFORGER_BACKEND_PORT`.
- **Bug**: Each Tauri command embeds a Python script that calls `http://127.0.0.1:8778/...` (literal `8778`). If the app picks another port (e.g. 8779 because 8778 is in use), the backend runs on 8779 but all `invoke()` calls still hit 8778.
- **Fix**: Either (a) pass the resolved backend port into every command and use it in the Python snippet, or (b) use a single Rust HTTP client (e.g. `reqwest`) with a base URL read from config/env, and remove inline Python for HTTP.

### 3.3 Backend: Single Monolithic Router

- All routes live in `api/routes.py`: documents, directories, mount points, knowledge points, annotations, fine-tuning, training set, API keys, audit/desensitization logs, evaluation, chat, health.
- Drawbacks: hard to navigate, high merge conflict risk, difficult testing, no clear ownership by domain.

### 3.4 Backend: DB Session Handling

- Pattern: `db = get_db_session()` then `try/except/finally: db.close()`.
- No context manager or FastAPI dependency; easy to miss `db.close()` on some branches or in nested logic.
- Recommendation: Use a dependency like `def get_db(): ... yield ...` and inject it into route handlers so sessions are always closed.

### 3.5 Duplicate / Legacy Data Paths

- **Data Center**: DB-backed documents + directories; uploads and processing; knowledge points from RAG.
- **File Resources**: Mount points (OS paths) + file listing; preview/summary; no DB document record.
- Two “document” concepts and two UIs; some overlap (e.g. preview). Acceptable for product, but keep boundaries clear and avoid sharing logic that assumes a single “document” model.

### 3.6 Frontend: No Centralized Backend URL

- Frontend does not call `127.0.0.1` directly; it uses Tauri `invoke()`. So the port bug is only in Rust, not in the React app. After fixing Rust, no frontend change is needed for URL.

### 3.7 Fine-Tuning: Placeholder Implementation

- `FineTuningService.submit_finetuning_job` returns a placeholder job id; monitoring simulates progress. Real DashScope/Fireworks/Together integration is still to be implemented. Document this clearly and keep the interface stable for future real implementations.

---

## 4. Refactoring Recommendations

### 4.1 Python Backend: Split `api/routes.py`

- Create an `api/routers/` (or `api/routes/`) package and split by domain, e.g.:
  - `documents.py` – upload, list, delete, preview, summary, move.
  - `directories.py` – CRUD, move.
  - `mount_points.py` – mount point CRUD, files, file meta, preview, summary, recent annotated.
  - `knowledge_points.py` – list, create, batch delete, weight, excluded, keywords.
  - `annotations.py` – generate (and any future annotation APIs).
  - `finetuning.py` – estimate, submit, jobs, job status, job logs.
  - `training_set.py` – training items, training set (get/save).
  - `api_keys.py` – save, list (no raw key in response).
  - `evaluation.py` – generate.
  - `chat.py` – query.
  - `logs.py` – audit log, desensitization log.
  - `health.py` – health check; optional `models/local` here or in a small `models.py`.
- In `main.py`, include each router with a prefix if desired (e.g. `/documents`, `/mount-points`). Keep backward compatibility by preserving current URL paths (e.g. mount-points already use kebab-case).
- Use a single `get_db` dependency that yields a session and closes it; use it in all routes that touch the DB.

### 4.2 Tauri: Shrink `lib.rs` and Fix Port

- **Port**: Introduce a Tauri command or state that returns the “current backend base URL” (e.g. `http://127.0.0.1:{port}`) using the same `resolve_backend_port` / config used at startup. Have each HTTP-calling command receive the port or base URL (e.g. from app state) and use it in the HTTP call (either in Rust with `reqwest` or in the Python string).
- **Rust HTTP**: Prefer replacing inline Python scripts with `reqwest` in Rust where possible: one shared client, one base URL, easier error handling and no Python process per call. Keep Python only where logic is complex (e.g. file upload with multipart). This will significantly reduce `lib.rs` size and duplicate URL logic.
- **Structure**: Split commands into modules (e.g. `commands/documents.rs`, `commands/mount_points.rs`, `commands/finetuning.rs`) and register them in `lib.rs` so that `lib.rs` stays under a few hundred lines.

### 4.3 Frontend: Split Large Components

- **DataCenter.tsx** (~1528 lines):
  - Extract: directory tree, document list, KP list, KP detail, graph, upload/actions into separate components.
  - Extract hooks: e.g. `useDocuments`, `useKnowledgePoints`, `useDirectoryTree`, `useResizePanels` so the main component mainly composes.
- **KnowledgeBaseWorkspace.tsx**, **FileResourcesWorkspace.tsx**, **ProductionTuning.tsx**, **TrainingLab.tsx**: Apply the same idea: one component per major view or tab, plus shared hooks for data and side effects. Target each file under ~400 lines where practical.

### 4.4 Frontend: State and Data Fetching

- App.tsx holds `documents`, `jobs`, `logs`, `backendStarted`, `activeTab`, `settingsTab`, etc., and passes them down. Consider a small context or data layer for “app-wide” data (e.g. documents count, jobs, backend status) to avoid prop drilling and duplicate fetches (e.g. `loadSidebarData` every 10s is fine; ensure children don’t refetch the same list unnecessarily).
- Optional: Introduce a lightweight client (e.g. a single `api` object that wraps Tauri `invoke` and optional caching) so all backend access goes through one place and error/toast handling can be centralized.

### 4.5 i18n and Copy

- Project already uses `react-i18next` with `en` and `zh`. Ensure every user-visible string uses `t('key')` and keys live in `locales/en.json` and `locales/zh.json`. No hardcoded Chinese/English in components. If there are mixed languages, align them to the same key set.

### 4.6 Configuration and Environment

- **Backend**: Already uses `BIOFORGER_DB_PATH`, `BIOFORGER_DOCUMENTS_DIR`, `BIOFORGER_CONFIG_PATH`; `main.py` uses `PORT`. Document these in README and, if needed, in a small `env.example`.
- **Port**: After fixing Tauri to use the resolved port everywhere, document that the app may use a port other than 8778 when 8778 is busy, and that this port is stored in app config.

---

## 5. Optimization Suggestions

### 5.1 Backend

- **DB**: Use connection pooling if you add more concurrent usage; SQLite is single-writer, so keep writes short and avoid long transactions.
- **Chroma**: Reuse a single `RAGService`/Chroma client per process where possible instead of instantiating per request.
- **Preview cache**: Already uses file version (mtime/size) and a cache dir; ensure cache dir is on a fast disk and consider a simple size/age-based cleanup to avoid unbounded growth.
- **Background processing**: `process_document_background` is correct for upload; consider a small queue (e.g. in-process or Redis later) if you expect many concurrent uploads.

### 5.2 Frontend

- **Bundle**: Use dynamic imports for heavy views (DataCenter, KnowledgeBaseWorkspace, FileResourcesWorkspace, ProductionTuning, TrainingLab) so the initial bundle is smaller and tabs load on demand.
- **Lists**: For long knowledge point / document lists, virtualize (e.g. `react-window` or `@tanstack/react-virtual`) to keep DOM small.
- **Polling**: Sidebar refreshes every 10s; consider switching to a longer interval or refetch-on-focus only when the window is in background.

### 5.3 Tauri

- **Startup**: Already waits for health before returning; keep timeout and retries minimal so the UI doesn’t hang if Python is missing or broken.
- **Commands**: Moving HTTP to Rust will reduce process spawns and string escaping bugs; it’s the main performance and maintainability win.

---

## 6. Suggested Priority Order

1. **High**: Fix backend port in Tauri (use resolved port or Rust HTTP client with configurable base URL) so that when 8778 is busy the app still works.
2. **High**: Split `api/routes.py` into domain routers and introduce a DB session dependency.
3. **Medium**: Split `lib.rs` (commands + shared HTTP + port) and replace inline Python HTTP with Rust where feasible.
4. **Medium**: Split `DataCenter.tsx` and other 800+ line components into smaller components and hooks.
5. **Low**: Centralize app-wide state/context and optional API client; add lazy loading for big views; align all UI strings to i18n.

---

## 7. Summary Table

| Area | Issue | Action |
|------|--------|--------|
| Backend | Single 2200+ line routes file | Split into domain routers |
| Backend | Manual DB session, no dependency | Add `get_db()` dependency and use in all routes |
| Tauri | Port 8778 hardcoded in commands | Use resolved port or Rust HTTP with base URL |
| Tauri | 2180 line lib.rs, many Python snippets | Use reqwest in Rust; split command modules |
| Frontend | DataCenter 1528 lines | Split into components + hooks |
| Frontend | Other 800+ line workspace components | Split by view/tab and hooks |
| Frontend | i18n | Ensure all UI strings use t() and locale files |
| Product | Two document sources (Data Center vs File Resources) | Keep; document and avoid mixing models |
| Product | Fine-tuning placeholder | Document; keep API stable for real integration |

After refactors, run the full flow (wizard → storage → upload → process → annotations → training set → placeholder fine-tuning) and verify build (e.g. `npm run tauri build`) and backend (e.g. `python python-backend/main.py`).
