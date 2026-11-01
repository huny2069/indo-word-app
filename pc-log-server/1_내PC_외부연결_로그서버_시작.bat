@echo off
chcp 65001 >nul
title Inko Nana Pro - PC 글로벌 실시간 로그 백업 서버
cd /d "%~dp0\.."

echo ======================================================================
echo  [Inko Nana Pro] 내 컴퓨터(PC) 실시간 접속·활동 로그 백업 서버 시작
echo  - 전 세계(Vercel) 접속자의 IP, 국가, 로그인 시간, 모든 활동을 수신합니다.
echo  - 무료 Cloudflare HTTPS 보안 터널 생성 및 앱 자동 연동이 수행됩니다.
echo  - 모든 로그는 pc-log-server\logs 폴더(JSONL + 날짜별 엑셀 CSV)에 자동 백업됩니다.
echo ======================================================================
echo.

start "" "http://localhost:4000"
node "%~dp0server.cjs" --tunnel --publish

pause
