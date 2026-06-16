# build-android.ps1 — run from repo root: .\build-android.ps1

$root = (Get-Item $PSScriptRoot).Parent.Parent.FullName

Write-Host "Syncing Expo config to native folders..." -ForegroundColor Yellow
Set-Location "$root/apps/mobile"
npx expo prebuild --clean --platform android

Set-Location "$root/apps/mobile/android"
.\gradlew.bat assembleDebug
$ok = $?
Set-Location $root

if (-not $ok -or -not (Test-Path "$root/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk")) {
    Write-Host "Build failed." -ForegroundColor Red
    exit 1
}

Write-Host "APK ready: apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk" -ForegroundColor Green
