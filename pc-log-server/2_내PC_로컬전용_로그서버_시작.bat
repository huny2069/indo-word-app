@echo off
chcp 65001 >nul
title Inko Nana Pro - PC 로컬 로그 백업 서버 (Port 4000)
cd /d "%~dp0\.."

echo ======================================================================
echo  [Inko Nana Pro] 내 컴퓨터(PC) 로컬 로그 백업 서버 시작 (Port 4000)
echo  - 로컬 대시보드: http://localhost:4000
echo  - 백업 폴더: pc-log-server\logs
echo ======================================================================
echo.

start "" "http://localhost:4000"
node "%~dp0server.cjs"

pause
