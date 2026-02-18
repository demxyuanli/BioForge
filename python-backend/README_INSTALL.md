# Python Backend Installation Guide

## Windows Installation

If you encounter compilation errors (especially with pandas), follow these steps:

### Method 1: Use Pre-built Wheels (Recommended)

```bash
# Update pip and build tools
python -m pip install --upgrade pip setuptools wheel

# Install pandas separately with pre-built wheel
python -m pip install pandas --only-binary :all:

# Install other dependencies
python -m pip install -r requirements.txt
```

Or use the provided batch script:
```bash
install_dependencies.bat
```

### Method 2: Use Conda (Alternative)

If pip installation continues to fail, consider using conda:

```bash
conda create -n aiforger python=3.11
conda activate aiforger
conda install pandas numpy
pip install -r requirements.txt
```

### Method 3: Install Dependencies One by One

If bulk installation fails, install critical dependencies first:

```bash
pip install fastapi uvicorn pydantic sqlalchemy
pip install pypdf2 python-docx pillow
pip install openai
pip install langchain langchain-community
pip install chromadb
```

## Linux/macOS Installation

```bash
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

Or use the provided shell script:
```bash
chmod +x install_dependencies.sh
./install_dependencies.sh
```

## Troubleshooting

### pandas compilation error
- Ensure you have Visual Studio Build Tools installed (Windows)
- Or use pre-built wheels: `pip install pandas --only-binary :all:`

### chromadb installation issues
- chromadb may require additional system dependencies
- On Windows, ensure Visual C++ Redistributable is installed

### Missing OCR support
- pytesseract requires Tesseract OCR binary
- Download from: https://github.com/UB-Mannheim/tesseract/wiki
