# Quick restart script - run as Administrator
$appName = "AmerisCchildAcademy"
$service = Get-Service $appName -ErrorAction SilentlyContinue

if ($service) {
    Write-Host "Stopping $appName..."
    Stop-Service $appName -Force
    Start-Sleep -Seconds 2

    Write-Host "Starting $appName..."
    Start-Service $appName
    Start-Sleep -Seconds 2

    $status = (Get-Service $appName).Status
    Write-Host "Service is now: $status" -ForegroundColor Green
} else {
    Write-Host "Service not found! Run setup-windows-service.ps1 first" -ForegroundColor Red
}
