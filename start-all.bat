@echo off
title SYSTEM MDM - Backend & Admin Starter
echo ====================================================
echo Starting SYSTEM MDM Backend & Admin Services...
echo ====================================================

start "MDM Main Backend (Port 5000)" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 2 /nobreak >nul

start "MDM Admin Frontend" cmd /k "cd /d %~dp0Admin && npm run dev"

echo All services launched!
pause
