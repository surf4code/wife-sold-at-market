Set-Location -Path $PSScriptRoot
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Wife Sold at Market - Automated Git Push" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Check if git is available
$gitCmd = $null
if (Get-Command git -ErrorAction SilentlyContinue) {
    $gitCmd = "git"
} elseif (Test-Path "C:\Program Files\Git\cmd\git.exe") {
    $gitCmd = "C:\Program Files\Git\cmd\git.exe"
} elseif (Test-Path "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe") {
    $gitCmd = "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
} else {
    Write-Host "[INFO] Git not found. Attempting install via winget..." -ForegroundColor Yellow
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
    if (Test-Path "C:\Program Files\Git\cmd\git.exe") {
        $gitCmd = "C:\Program Files\Git\cmd\git.exe"
    } elseif (Test-Path "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe") {
        $gitCmd = "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
    }
}

if (-not $gitCmd) {
    Write-Host "[ERROR] Git is not installed. Please install Git manually from https://git-scm.com/" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Using Git: $gitCmd" -ForegroundColor Green
& $gitCmd init
& $gitCmd branch -M main
try { & $gitCmd remote remove origin } catch {}
& $gitCmd remote add origin https://github.com/surf4code/wife-sold-at-market.git
& $gitCmd add .
& $gitCmd status --short
& $gitCmd commit -m "feat: Zack & Miko kinetic camera rig, cutaways, word lip-sync, zero frozen shots"
Write-Host "Pushing to https://github.com/surf4code/wife-sold-at-market.git..." -ForegroundColor Cyan
& $gitCmd push -u origin main
Write-Host "Done!" -ForegroundColor Green
