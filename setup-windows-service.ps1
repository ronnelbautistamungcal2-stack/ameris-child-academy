# Windows Service Setup for Ameris Child Academy (Node.js)
# Run as Administrator

# Configuration
$appName = "AmerisCchildAcademy"
$appPath = "d:\Rooche\ameris-child-academy"
$nodeExe = "C:\Program Files\nodejs\node.exe"  # Adjust if Node.js installed elsewhere
$startScript = "$appPath\server.js"  # or your main entry point
$port = 3000  # Adjust to your app's port

# Step 1: Download & extract NSSM if not present
$nssmPath = "$env:ProgramFiles\nssm\nssm.exe"
if (-not (Test-Path $nssmPath)) {
    Write-Host "Downloading NSSM from GitHub..."
    $nssmZip = "$env:Temp\nssm.zip"

    # Try GitHub releases first (more reliable)
    try {
        Invoke-WebRequest -Uri "https://github.com/nssm/nssm/releases/download/2.24/nssm-2.24-101-g897c7f7.zip" -OutFile $nssmZip -ErrorAction Stop
        Write-Host "Downloaded from GitHub" -ForegroundColor Green
    } catch {
        Write-Host "GitHub download failed, trying backup URL..." -ForegroundColor Yellow
        try {
            Invoke-WebRequest -Uri "https://files.nssm.cc/nssm/2.24/nssm-2.24-101-g897c7f7.zip" -OutFile $nssmZip -ErrorAction Stop
        } catch {
            Write-Host "ERROR: Cannot download NSSM. Please download manually from:" -ForegroundColor Red
            Write-Host "https://github.com/nssm/nssm/releases/download/2.24/nssm-2.24-101-g897c7f7.zip" -ForegroundColor Yellow
            Write-Host "Then extract to: $env:ProgramFiles\nssm" -ForegroundColor Yellow
            Exit 1
        }
    }

    Write-Host "Extracting NSSM..."
    Expand-Archive -Path $nssmZip -DestinationPath "$env:ProgramFiles" -Force
    Remove-Item $nssmZip
}

# Step 2: Remove existing service if it exists
if (Get-Service $appName -ErrorAction SilentlyContinue) {
    Write-Host "Removing existing service..."
    & $nssmPath remove $appName confirm
}

# Step 3: Create new Windows Service
Write-Host "Creating Windows Service: $appName"
& $nssmPath install $appName $nodeExe $startScript
& $nssmPath set $appName AppDirectory $appPath
& $nssmPath set $appName AppEnvironmentExtra "NODE_ENV=production`0PORT=$port"
& $nssmPath set $appName Start SERVICE_AUTO_START
& $nssmPath set $appName Type SERVICE_WIN32_OWN_PROCESS

# Step 4: Start the service
Write-Host "Starting service..."
Start-Service $appName

# Step 5: Verify
Start-Sleep -Seconds 2
$service = Get-Service $appName
Write-Host "Service Status: $($service.Status)"
Write-Host "Service created successfully! It will auto-start on system reboot."
