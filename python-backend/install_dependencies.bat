@echo off
REM Install Python dependencies for PrivateTune Pro Backend
REM This script handles Windows-specific installation issues

REM Change to script directory
cd /d "%~dp0"

echo Current directory: %CD%
echo Checking for requirements.txt...
if not exist "requirements.txt" (
    echo ERROR: requirements.txt not found in current directory!
    echo Please run this script from the python-backend directory.
    pause
    exit /b 1
)

echo Updating pip, setuptools, and wheel...
python -m pip install --upgrade pip setuptools wheel

echo.
echo Installing pandas (pre-built wheel)...
python -m pip install pandas --only-binary :all:

echo.
echo Installing other dependencies...
python -m pip install -r requirements.txt

echo.
echo Installation complete!
pause
