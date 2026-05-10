@echo off
echo Starting Alexus Desktop...
cd /d %~dp0
call .\venv\Scripts\activate
npm start
pause
