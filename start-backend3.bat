@echo off
title SYSTEM MDM - Backend 3 (Python AI Service)
echo ====================================================
echo Starting SYSTEM MDM Backend 3 (Python AI Service) on port 5003...
echo ====================================================
cd /d %~dp0backend3
python -m uvicorn server:app --host 0.0.0.0 --port 5003 --reload
pause
