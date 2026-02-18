# AiForger Pro Python Backend

Python backend service for AiForger Pro application.

## Quick Start

### Windows

1. Navigate to this directory:
   ```bash
   cd python-backend
   ```

2. Run the installation script:
   ```bash
   install_dependencies.bat
   ```

   Or manually:
   ```bash
   python -m pip install --upgrade pip setuptools wheel
   python -m pip install pandas --only-binary :all:
   python -m pip install -r requirements.txt
   ```

3. Initialize the database:
   ```bash
   python database/init_db.py
   ```

4. Start the server:
   ```bash
   python main.py
   ```

The server will start on `http://127.0.0.1:8000`

### Linux/macOS

1. Navigate to this directory:
   ```bash
   cd python-backend
   ```

2. Run the installation script:
   ```bash
   chmod +x install_dependencies.sh
   ./install_dependencies.sh
   ```

3. Initialize the database:
   ```bash
   python database/init_db.py
   ```

4. Start the server:
   ```bash
   python main.py
   ```

## API Endpoints

- `GET /health` - Health check
- `POST /documents/upload` - Upload and process document
- `GET /documents` - List all documents
- `POST /annotations/generate` - Generate instruction pairs
- `POST /finetuning/estimate` - Estimate fine-tuning cost
- `POST /finetuning/submit` - Submit fine-tuning job
- `GET /finetuning/jobs` - List fine-tuning jobs
- `GET /finetuning/jobs/{job_id}/logs` - Get job logs
- `GET /finetuning/jobs/{job_id}/status` - Get job status
- `POST /desensitize` - Desensitize text

## Troubleshooting

### pandas compilation error
Install pandas separately with pre-built wheel:
```bash
python -m pip install pandas --only-binary :all:
```

### chromadb installation issues
Install chromadb separately:
```bash
python -m pip install chromadb
```

### Missing dependencies
If some dependencies fail to install, try installing them individually:
```bash
python -m pip install <package-name>
```
