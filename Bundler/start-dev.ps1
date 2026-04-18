# Get the current WiFi/Local IP Address
$currentIp = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Wi-Fi' -or $_.InterfaceAlias -match 'Ethernet' } | Select-Object -ExpandProperty IPAddress -First 1

if (-not $currentIp) {
    Write-Host "❌ Could not detect local IP. Please check your WiFi connection." -ForegroundColor Red
    exit
}

Write-Host "🚀 Detected Local IP: $currentIp" -ForegroundColor Cyan
Write-Host "🛠️ Starting Bundler with this IP..." -ForegroundColor Gray

# Set environment variable for this session
$env:PUBLIC_RPC_IP = $currentIp

# Start Docker Compose with the IP injected
docker-compose up
