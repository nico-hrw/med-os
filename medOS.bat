@echo off
setlocal enabledelayedexpansion

:: ========================================================
:: medOS Yeti - Startskript
:: ========================================================

set "SCRIPT_DIR=%~dp0"

:: Automatische Ermittlung des medOS-Wurzelverzeichnisses
if exist "%SCRIPT_DIR%medos-yeti\apps\backend" (
    set "MEDOS_ROOT=%SCRIPT_DIR%medos-yeti"
) else if exist "%SCRIPT_DIR%apps\backend" (
    set "MEDOS_ROOT=%SCRIPT_DIR%"
) else if exist "%cd%\medos-yeti\apps\backend" (
    set "MEDOS_ROOT=%cd%\medos-yeti"
) else if exist "%cd%\apps\backend" (
    set "MEDOS_ROOT=%cd%"
) else (
    echo [FEHLER] medOS-Dateistruktur konnte nicht gefunden werden!
    echo Bitte stellen Sie sicher, dass das Skript im Projektverzeichnis ausgefuehrt wird.
    pause
    exit /b 1
)

set "BACKEND_DIR=%MEDOS_ROOT%\apps\backend"
set "FRONTEND_DIR=%MEDOS_ROOT%\apps\frontend"

:: Parameter pruefen
set "ACTION=%~1"

if "%ACTION%"=="" goto start_all
if /i "%ACTION%"=="-a" goto start_all
if /i "%ACTION%"=="/a" goto start_all
if /i "%ACTION%"=="--all" goto start_all
if /i "%ACTION%"=="all" goto start_all

if /i "%ACTION%"=="-b" goto start_backend
if /i "%ACTION%"=="/b" goto start_backend
if /i "%ACTION%"=="--backend" goto start_backend
if /i "%ACTION%"=="backend" goto start_backend

if /i "%ACTION%"=="-f" goto start_frontend
if /i "%ACTION%"=="/f" goto start_frontend
if /i "%ACTION%"=="--frontend" goto start_frontend
if /i "%ACTION%"=="frontend" goto start_frontend

if /i "%ACTION%"=="-h" goto show_help
if /i "%ACTION%"=="/h" goto show_help
if /i "%ACTION%"=="-?" goto show_help
if /i "%ACTION%"=="help" goto show_help
if /i "%ACTION%"=="--help" goto show_help

echo [FEHLER] Unbekannter Parameter: %ACTION%
echo.
goto show_help

:start_all
echo ========================================================
echo   Starte medOS: Backend und Frontend werden gestartet...
echo ========================================================
call :run_backend
timeout /t 2 /nobreak >nul
call :run_frontend
echo.
echo Beide Komponenten wurden in separaten Fenstern gestartet.
goto end

:start_backend
echo ========================================================
echo   Starte medOS Backend...
echo ========================================================
call :run_backend
echo Backend wurde im separaten Fenster gestartet.
goto end

:start_frontend
echo ========================================================
echo   Starte medOS Frontend...
echo ========================================================
call :run_frontend
echo Frontend wurde im separaten Fenster gestartet.
goto end

:run_backend
echo [OK] Backend wird gestartet (Port 4000)...
start "medOS - Backend" /d "%BACKEND_DIR%" cmd /k npm run dev
goto :eof

:run_frontend
echo [OK] Frontend wird gestartet (Vite Dev Server)...
start "medOS - Frontend" /d "%FRONTEND_DIR%" cmd /k npm run dev
goto :eof

:show_help
echo ========================================================
echo   medOS Yeti - Startskript Hilfe
echo ========================================================
echo.
echo Verwendung:
echo   medOS.bat [Option]
echo.
echo Optionen:
echo   -a, --all        Startet Frontend und Backend (Standardwert)
echo   -b, --backend    Startet nur das Backend (Kernel / Event-Server)
echo   -f, --frontend   Startet nur das Frontend (Vite)
echo   -h, --help       Zeigt diese Hilfe an
echo.
echo Beispiele:
echo   medOS.bat        Startet beides
echo   medOS.bat -a     Startet beides
echo   medOS.bat -b     Startet nur Backend
echo   medOS.bat -f     Startet nur Frontend
echo.
goto end

:end
endlocal
