@echo off
title Heartbeat Duet - One-Click Launcher
echo [System] Checking for Python environment...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [Warning] Python was not found in your system PATH.
    echo [Info] Opening index.html directly via default browser...
    start "" "index.html"
) else (
    echo [System] Starting local server on http://localhost:8000...
    start "" "http://localhost:8000"
    python -m http.server 8000
)
pause
