@echo off
cd /d "%~dp0"
echo Stop tauri dev and Python backend first, then press any key...
pause >nul
cd python-backend
python reset_data.py %*
pause
