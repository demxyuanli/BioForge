# PrivateTune Pro

PrivateTune Pro is a desktop client application for private large language model fine-tuning in the cloud. It enables users to transform their professional documents into private models without requiring local GPU hardware.

## Features

- **Knowledge Repository**: Upload and process documents (PDF, Word, Markdown, Images) with automatic OCR, text cleaning, and chunking
- **Smart Annotation Assistant**: Automatically generate instruction pairs and Q&A pairs using cloud models
- **Fine-tuning Engine**: Cloud-based fine-tuning support for Qwen3 series (DashScope) and DeepSeek-V3/R1 (Fireworks.ai/Together AI)
- **Privacy Center**: Encrypted API key storage, data desensitization, and audit logging

## Technology Stack

- **Frontend**: Tauri 2.0+ with React + TypeScript
- **Backend**: Python + FastAPI
- **Document Processing**: LangChain/LlamaIndex
- **API Integration**: LiteLLM
- **Database**: SQLite + Chroma (vector store)

## Setup

### Prerequisites

- Node.js and npm
- Python 3.8+
- Rust and Cargo
- Tesseract OCR (for image OCR support)

### Installation

1. Install frontend dependencies:
```bash
npm install
```

2. Install Python backend dependencies:
```bash
cd python-backend
pip install -r requirements.txt
```

3. Initialize database:
```bash
cd python-backend
python database/init_db.py
```

### Development

1. Start Python backend server:
```bash
cd python-backend
python main.py
```

2. In another terminal, start Tauri development server:
```bash
npm run tauri dev
```

## Project Structure

```
.
├── src/                    # React frontend
│   ├── components/         # UI components
│   └── App.tsx            # Main app component
├── src-tauri/             # Rust backend (Tauri)
│   └── src/
│       └── lib.rs         # Tauri commands
├── python-backend/         # Python backend service
│   ├── services/          # Business logic services
│   ├── database/         # Database models
│   ├── api/              # FastAPI routes
│   └── main.py           # Backend entry point
└── requirments.md         # Project requirements
```

## Building

To build the application:

```bash
npm run tauri build
```

The built application will be in `src-tauri/target/release/`.
