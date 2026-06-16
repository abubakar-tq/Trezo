# start-metro.ps1 — run from repo root: .\start-metro.ps1

$devices = adb devices | Select-String "device$" | ForEach-Object { ($_ -split "\s+")[0] }
if ($devices) {
    foreach ($dev in $devices) {
        Write-Host "Configuring Metro proxy for $dev..." -ForegroundColor Cyan
        adb -s $dev reverse tcp:8081 tcp:8081
    }
}

$root = (Get-Item $PSScriptRoot).Parent.Parent.FullName
Set-Location "$root/apps/mobile"
npx expo start --dev-client
