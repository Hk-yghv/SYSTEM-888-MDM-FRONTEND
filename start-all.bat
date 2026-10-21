@echo off
title SYSTEM MDM - Full Stack Launcher
echo ====================================================
echo  SYSTEM MDM - Backend + Frontend + Cloudflare Tunnel
echo ====================================================

REM ── Step 1: Start Backend (Port 5000) ──
echo [1/4] Starting MDM Backend on port 5000...
start "MDM Backend (Port 5000)" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 3 /nobreak >nul

REM ── Step 2: Start Frontend (Port 5173) ──
echo [2/4] Starting MDM Admin Frontend on port 5173...
start "MDM Admin Frontend (Port 5173)" cmd /k "cd /d %~dp0Admin && npm run dev"
timeout /t 3 /nobreak >nul

REM ── Step 3: Cloudflare Tunnel for Frontend ──
echo [3/4] Starting Cloudflare Tunnel for Frontend (systemmdm.houv.online)...
start "CF Tunnel - Frontend" cmd /k "cloudflared tunnel --hostname systemmdm.houv.online --url http://localhost:5173"
timeout /t 2 /nobreak >nul

REM ── Step 4: Cloudflare Tunnel for Backend API ──
echo [4/4] Starting Cloudflare Tunnel for Backend API (apisystemmdm.houv.online)...
start "CF Tunnel - Backend API" cmd /k "cloudflared tunnel --hostname apisystemmdm.houv.online --url http://localhost:5000"

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║  All services launched successfully!             ║
echo ╠══════════════════════════════════════════════════╣
echo ║  Local Frontend : http://localhost:5173          ║
echo ║  Local Backend  : http://localhost:5000          ║
echo ║  CF Frontend    : https://systemmdm.houv.online  ║
echo ║  CF Backend API : https://apisystemmdm.houv.online ║
echo ╚══════════════════════════════════════════════════╝
echo.
pause
