# build-release-android.ps1 — run from repo root: .\scripts\windows-helpers\build-release-android.ps1

$root = (Get-Item $PSScriptRoot).Parent.Parent.FullName

Write-Host "Syncing Expo config to native folders..." -ForegroundColor Yellow
Set-Location "$root/apps/mobile"
npx expo prebuild --clean --platform android

Write-Host "Building Release APK..." -ForegroundColor Yellow
Set-Location "$root/apps/mobile/android"
.\gradlew.bat assembleRelease
$ok = $?
Set-Location $root

$APK = "$root/apps/mobile/android/app/build/outputs/apk/release/app-release.apk"

if (-not $ok -or -not (Test-Path $APK)) {
    Write-Host "Release build failed." -ForegroundColor Red
    exit 1
}

Write-Host "Release APK ready: $APK" -ForegroundColor Green
