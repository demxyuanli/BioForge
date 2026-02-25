# AiForger Pro Release Notes

## 1.0.1 (2025-02-25)

### Improvements

- **Frontend refactoring**
  - KnowledgeBaseWorkspace, FileResourcesWorkspace, ProductionTuning, and TrainingLab split into layout/data hooks and subcomponents; main files kept under ~400 lines each for maintainability.
  - DataCenter: extracted `useDataCenterDocuments`, `useDataCenterKnowledgePoints`, and shared utils (`dataCenterUtils.ts`).

- **Tauri**
  - `lib.rs` split into command modules (api_keys, logs, config, search, directories, mount_points, skills, rules, misc, storage, chat_history, evaluation, chat, backend_lifecycle, ollama, etc.); `lib.rs` reduced to mod/use, `run()`, and handler registration.
  - All backend HTTP calls remain in Rust (reqwest).

- **Backend**
  - Training, search, documents, knowledge_points, and finetuning routers now use FastAPI `Depends(get_db)` instead of manual session handling.

- **Splash screen**
  - Redesigned startup window with product name "AiForger Pro", progress bar animation, and dark theme.

### Technical

- `highlightKeywords` in `dataCenterUtils` now accepts an optional `keywordClassName` for reuse in KnowledgeBaseWorkspace.
- ProductionTuning and TrainingLab share layout/data hooks and subcomponents under `ProductionTuning/` and `TrainingLab/` directories.

---

## 1.0.0

- Initial release.
