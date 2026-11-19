@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ========================================================
echo   Wife Sold at Market - Automated Git Push
echo ========================================================

:: 1. Check if git is available
where git >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "GIT_CMD=git"
    goto :GIT_FOUND
)

if exist "C:\Program Files\Git\cmd\git.exe" (
    set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
    goto :GIT_FOUND
)

if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
    set "GIT_CMD=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
    goto :GIT_FOUND
)

echo [INFO] Git is not found on this machine.
echo [INFO] Installing Git via winget...
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements

if exist "C:\Program Files\Git\cmd\git.exe" (
    set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
    goto :GIT_FOUND
)

if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
    set "GIT_CMD=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
    goto :GIT_FOUND
)

where git >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "GIT_CMD=git"
    goto :GIT_FOUND
)

echo [ERROR] Git could not be installed automatically. Please install Git manually from https://git-scm.com/
pause
exit /b 1

:GIT_FOUND
echo [OK] Using Git: "%GIT_CMD%"

echo [1/5] Initializing Git repository...
"%GIT_CMD%" init
"%GIT_CMD%" branch -M main

echo [2/5] Setting remote origin...
"%GIT_CMD%" remote remove origin >nul 2>&1
"%GIT_CMD%" remote add origin https://github.com/surf4code/wife-sold-at-market.git

echo [3/5] Staging files (respecting .gitignore)...
"%GIT_CMD%" add .

echo [4/5] Repository status and committing...
"%GIT_CMD%" status --short
"%GIT_CMD%" commit -m "feat: Zack & Miko kinetic camera rig, cutaways, word lip-sync, zero frozen shots"

echo [5/5] Pushing to https://github.com/surf4code/wife-sold-at-market.git ...
"%GIT_CMD%" push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo   SUCCESS! Pushed to GitHub repository:
    echo   https://github.com/surf4code/wife-sold-at-market.git
    echo ========================================================
) else (
    echo.
    echo [NOTE] Push completed or requires GitHub authentication/login in the browser.
)

pause
