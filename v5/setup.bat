@echo off
echo ================================================
echo    ALEXUS V5 - Setup Script
echo ================================================
echo.

REM Check if Node.js is installed
echo [1/5] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)
echo    Node.js: OK

REM Check if Python is installed
echo [2/5] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed!
    echo Please install Python from: https://www.python.org/
    pause
    exit /b 1
)
echo    Python: OK

REM Install Node dependencies
echo [3/5] Installing Node packages...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install Node packages!
    pause
    exit /b 1
)
echo    Node packages: OK

REM Install Python dependencies
echo [4/5] Installing Python packages...
pip install flask flask-cors SpeechRecognition gtts pygame pyaudio
if %errorlevel% neq 0 (
    echo WARNING: Some Python packages may have failed to install
    echo If pyaudio fails, try: pip install pipwin && pipwin install pyaudio
    pause
)
echo    Python packages: OK

REM Create assets folder if it doesn't exist
echo [5/5] Creating assets folder...
if not exist "assets" mkdir assets
echo    Assets folder: OK

echo.
echo ================================================
echo    Setup Complete!
echo ================================================
echo.
echo Next steps:
echo 1. Create icon files in assets/ folder:
echo    - icon.png (256x256)
echo    - tray-icon.png (32x32)
echo.
echo    OR run: python create_icons.py
echo.
echo 2. Start ALEXUS: npm start
echo.
echo ================================================
pause