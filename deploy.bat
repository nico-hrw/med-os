@echo off
chcp 65001 >nul
setlocal

echo ========================================================
echo   medOS Yeti - Deploy to go-tide.app
echo ========================================================
echo.

set "SCRIPT_DIR=%~dp0"
if exist "%SCRIPT_DIR%apps\backend" (
    cd /d "%SCRIPT_DIR%"
) else if exist "%SCRIPT_DIR%medos-yeti\apps\backend" (
    cd /d "%SCRIPT_DIR%medos-yeti"
)

echo [1/3] Pruefe Git Status...
git status --short

echo.
set /p COMMIT_MSG="Commit-Nachricht eingeben (Enter fuer Standard 'deploy: update'): "
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=deploy: update"

git add .
git commit -m "%COMMIT_MSG%" 2>nul
echo [2/3] Pushe nach GitHub (origin main)...
git push origin main
if %errorlevel% neq 0 (
    echo [FEHLER] Git Push fehlgeschlagen!
    pause
    exit /b %errorlevel%
)

echo.
echo [3/3] Aktualisiere Server via SSH (root@go-tide.app)...
ssh -t root@go-tide.app "cd ~/yeti && chmod +x yeti.sh && ./yeti.sh -a"

echo.
echo ========================================================
echo   Deploy abgeschlossen! https://go-tide.app/yeti/
echo ========================================================
pause
endlocal
