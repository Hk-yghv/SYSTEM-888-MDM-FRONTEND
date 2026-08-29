@echo off
title SYSTEM MDM - Backend & AI Starter
echo ====================================================
echo Starting SYSTEM MDM Backend & AI Services...
echo ====================================================

start "MDM Main Backend (Port 5000)" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 2 /nobreak >nul

start "MDM Backend AI Service (Port 5003)" cmd /k "cd /d %~dp0backend3 && python -m uvicorn server:app --host 0.0.0.0 --port 5003 --reload"
timeout /t 2 /nobreak >nul

start "MDM Admin Frontend" cmd /k "cd /d %~dp0Admin && npm run dev"

echo All services launched!
pause
