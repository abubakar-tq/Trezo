# install-release-android.ps1 — run from repo root: .\scripts\windows-helpers\install-release-android.ps1

$root = (Get-Item $PSScriptRoot).Parent.Parent.FullName
$targetApk = "$root/apps/mobile/android/app/build/outputs/apk/release/app-release.apk"

if (-not (Test-Path $targetApk)) {
    Write-Host "No Release APK found. Please run build-release-android.ps1 first." -ForegroundColor Red
    exit 1
}

$devices = adb devices | Select-String "device$" | ForEach-Object { ($_ -split "\s+")[0] }

if (-not $devices) {
    Write-Host "No Android devices connected." -ForegroundColor Red
    exit 1
}

foreach ($dev in $devices) {
    Write-Host "Installing Release APK on $dev..." -ForegroundColor Cyan
    adb -s $dev install -r $targetApk
    Write-Host "Done: $dev" -ForegroundColor Green
}
