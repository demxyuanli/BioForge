# Operation Manual

Complete guide from setup to evaluation. Read sections in order for first-time use.

This manual is divided into: (1) Quick Start, (2) Initial Setup, (3) Workspaces, (4) Recommended Workflow, (5) Phase Acceptance, (6) Failure Recovery, (7) Shortcuts, (8) Troubleshooting, (9) Data and Privacy.

---

## 1. Quick Start

### Five steps to get going

1. Run Setup Wizard (File > Open Setup Wizard): set documents directory and database path, then complete the wizard.
2. Configure model: open Settings (gear icon or View > Privacy Center), go to Models, add your cloud API key or ensure local Ollama is running.
3. Add sources: in File Resources add a mount point (folder), upload or place files, and wait for processing to finish.
4. Create training data: in Training Lab select knowledge points, choose skills if needed, then generate and review instruction-response pairs.
5. Fine-tune and evaluate: in Production Tuning submit a fine-tuning job; in Evaluation compare baseline vs tuned model with the same prompt.

---

## 2. Initial Setup (detailed)

### Environment and storage

- Use dedicated folders for documents and DB; avoid system directories. After saving, confirm paths in Settings.
- Cloud: save API key first, then pick provider and model. Local: start Ollama and confirm it is reachable before generating.
- Before adding files: ensure mount point path is readable, file types are supported (e.g. PDF, Word, Markdown), and names are stable for traceability.
- First run: try one document and one knowledge point batch; scale to bulk only after the pipeline works.

---

## 3. Workspaces

### What each workspace does

- **Dashboard**: Overview of documents, jobs, and quick links to recent items and activities.
- **File Resources**: Add or remove mount points, upload documents, view list and status, add notes, and open document preview or summary.
- **Knowledge Base**: Browse and edit knowledge points, set keywords, weights, and tags; manage the content used for retrieval and training.
- **Data Center**: Upload files, trigger parsing and knowledge extraction, and inspect generated knowledge points and keywords.
- **Training Lab**: Filter knowledge points, optionally select skills, generate instruction-response candidates, edit or delete annotations, and export JSONL for fine-tuning.
- **Production Tuning**: Select training data, estimate cost, submit fine-tuning jobs to your provider, and monitor status and logs.
- **Evaluation**: Define templates and variables, run the same prompt on baseline and tuned models, and compare outputs side by side.
- **Skills**: Define executable capabilities (how to do) and link Rules (constraints). Selected skills and their rules are injected into Training and Fine-tuning prompts.
- **Chat**: Ask questions with retrieval over your knowledge base; use it to validate that content and retrieval behave as expected.
- **Settings**: Storage paths, model and API key, privacy (API keys, desensitization, audit log), and context options.

### 3.1 Using Skills and Rules

- **Rules (Rules tab)**: Create rules with name, category, and content (must / must-not, naming, architecture). Rules are reusable across skills.
- **Skills (Skills tab)**: Create a skill with name, description, trigger conditions, steps, output description, and optional example; link one or more rules in "Linked rules".
- In Training Lab or Production Tuning, select the skills you want; the app injects those skills and their linked rules into the generation prompt.
- Inline rule on a skill is legacy; prefer linked rules so the same rule can be shared by multiple skills.

### 3.2 Settings and Privacy

- **General**: Storage paths and app preferences. **Models**: Cloud API key and model choice, or local Ollama.
- **Privacy tab**: Manage API keys, view desensitization log and audit log. Use View > Privacy Center to open Settings on the Privacy tab.
- **Context**: Adjust options that affect how the app uses model and knowledge in various workflows.

---

## 4. Recommended Workflow

### End-to-end sequence

1. **Document**: Add mount points and files; ensure each document is processed and appears in the list.
2. **Knowledge**: Review and curate knowledge points (remove noise, set weights/keywords); optionally use Data Center for bulk upload and processing.
3. **Annotation**: In Training Lab select points and skills, generate candidates, review quality, save valid instruction-response pairs.
4. **Fine-tuning**: In Production Tuning pick dataset, check cost, submit job, and track progress and logs.
5. **Evaluation**: Use the same prompt template for baseline and tuned model; compare and iterate.

---

## 5. Phase Acceptance Criteria

### When to consider each phase done

- **Documents**: Every file is processed and yields stable knowledge points.
- **Knowledge**: Core points kept, noise removed, keywords cover main terms.
- **Annotations**: Instruction and response match and are grounded in selected knowledge.
- **Fine-tuning**: Jobs are visible, logs are readable, failures have a clear cause.
- **Evaluation**: Under the same prompt, tuned output is better in structure, accuracy, or relevance.

---

## 6. Failure Recovery

### What to do when something fails

- **Processing fails**: Check file format and content; retry with a single document first.
- **Generation fails**: Relax filters, shorten prompts, and confirm model/API is working.
- **Fine-tuning fails**: Read job logs and provider errors; adjust parameters and resubmit.
- **Evaluation inconsistent**: Fix template and variables; run several comparisons before changing data.

---

## 7. Shortcuts

### Keyboard and UI

- **Alt+H** opens Help; choose Documentation or About.
- **Alt + letter** opens top menu (F/K/T/P/V/L/S/H).
- **Escape** closes the open dropdown.
- **Top-right language button** toggles English and Chinese.

---

## 8. Troubleshooting

### Common issues

- **Backend not available**: Use tray to start or restart the backend.
- **Model errors**: Check API key, endpoint, selected model, and network.
- **No annotations**: Loosen filters and ensure knowledge points exist and are selected.
- **Job stuck**: Open job details and logs to see provider-side errors.

---

## 9. Data and Privacy

### Best practices

- Restrict mount points to project-specific folders.
- Save API keys only via Settings so they are stored encrypted.
- Check audit and desensitization logs in Privacy Center regularly.
