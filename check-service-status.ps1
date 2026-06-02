# Check service status and logs
$appName = "AmerisCchildAcademy"
$service = Get-Service $appName -ErrorAction SilentlyContinue

Write-Host "=== Service Status ===" -ForegroundColor Cyan
if ($service) {
    Write-Host "Name: $($service.Name)"
    Write-Host "Status: $($service.Status)" -ForegroundColor Green
    Write-Host "Start Type: $(Get-Service $appName | Select-Object -ExpandProperty StartType)"
} else {
    Write-Host "Service not found!" -ForegroundColor Red
}

Write-Host "`n=== Recent Events ===" -ForegroundColor Cyan
Get-EventLog -LogName Application -Source nssm -Newest 10 -ErrorAction SilentlyContinue |
    Format-Table -Property TimeGenerated, Message -AutoSize

Write-Host "`nTo view full logs: eventvwr.msc" -ForegroundColor Yellow
