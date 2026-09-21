@echo off
rem ============================================================================
rem  Gom Gom - choi tren Windows
rem  Bam dup file nay. Chi can may co Node.js, khong can cai them gi.
rem  Dung game: dong cua so nay, hoac bam Ctrl+C roi chon Y.
rem ============================================================================
chcp 65001 >nul 2>nul
setlocal
title Gom Gom
cd /d "%~dp0"

if "%~1"=="--open-browser" goto open_browser

echo.
echo   ====================================
echo    GOM GOM - dang chuan bi cho ban...
echo   ====================================
echo.

if not exist "server.mjs" (
  echo   [Loi] Khong thay file server.mjs.
  echo   Hay giu nguyen ca thu muc, dung tach rieng file bat ra cho khac.
  echo.
  pause
  exit /b 1
)
if not exist "game\index.html" (
  echo   [Loi] Khong thay thu muc game.
  echo   Hay giu nguyen ca thu muc, dung tach rieng file bat ra cho khac.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo   [Loi] May chua cai Node.js.
  echo   Tai ban LTS tai https://nodejs.org roi chay lai file nay.
  echo.
  pause
  exit /b 1
)

set "NODE_MAJOR=0"
for /f "tokens=1 delims=v." %%v in ('node -v 2^>nul') do set "NODE_MAJOR=%%v"
if %NODE_MAJOR% LSS 18 (
  echo   [Loi] Game can Node.js phien ban 18 tro len.
  for /f %%v in ('node -v') do echo   May dang dung %%v
  echo   Tai ban moi tai https://nodejs.org roi chay lai file nay.
  echo.
  pause
  exit /b 1
)
for /f %%v in ('node -v') do echo   Node.js %%v - OK
echo.
echo   Trinh duyet se tu bat sau vai giay.
echo   Giu cua so nay mo trong luc choi. Dong cua so la tat game.
echo.

start "Gom Gom - mo trinh duyet" /min "%~f0" --open-browser
node server.mjs

echo.
echo   Game da dung.
pause
exit /b 0

rem ============================================================================
:open_browser
rem Doi may chu len roi mo trinh duyet. Server tu doi cong khac neu 4400 ban,
rem nen thu lan luot tu 4400 den 4404.
where curl >nul 2>nul
if errorlevel 1 (
  ping -n 5 127.0.0.1 >nul 2>nul
  start "" "http://127.0.0.1:4400/"
  exit /b 0
)
for /l %%i in (1,1,60) do (
  for %%p in (4400 4401 4402 4403 4404) do (
    curl --silent --fail --max-time 1 --output nul "http://127.0.0.1:%%p/" >nul 2>nul
    if not errorlevel 1 (
      start "" "http://127.0.0.1:%%p/"
      exit /b 0
    )
  )
  ping -n 2 127.0.0.1 >nul 2>nul
)
exit /b 0
