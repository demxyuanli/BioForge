#!/bin/bash
# Install Python dependencies for PrivateTune Pro Backend
# For Linux/macOS

# Change to script directory
cd "$(dirname "$0")"

echo "Current directory: $(pwd)"
echo "Checking for requirements.txt..."
if [ ! -f "requirements.txt" ]; then
    echo "ERROR: requirements.txt not found in current directory!"
    echo "Please run this script from the python-backend directory."
    exit 1
fi

echo "Updating pip, setuptools, and wheel..."
pip install --upgrade pip setuptools wheel

echo ""
echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "Installation complete!"
