@echo off
title SYSTEM MDM - Multi-Backend & AI Starter
echo ====================================================
echo Starting All SYSTEM MDM Backends & AI Services...
echo ====================================================

start "MDM Backend (Port 5000)" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 2 /nobreak >nul

start "MDM Backend 1 (Port 5001 - Contracts & Payments)" cmd /k "cd /d %~dp0backend1 && npm run dev"
timeout /t 2 /nobreak >nul

start "MDM Backend 2 (Port 5002 - Wallpaper, Lostphone, History)" cmd /k "cd /d %~dp0backend2 && npm run dev"
timeout /t 2 /nobreak >nul

start "MDM Backend 3 (Port 5003 - Python AI Assistant)" cmd /k "cd /d %~dp0backend3 && python -m uvicorn server:app --host 0.0.0.0 --port 5003 --reload"
timeout /t 2 /nobreak >nul

start "MDM Admin Frontend" cmd /k "cd /d %~dp0Admin && npm run dev"

echo All services launched!
pause
