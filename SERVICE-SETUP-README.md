# Ameris Child Academy - Windows Service Setup

## Quick Start (Run on BOTH servers)

### Initial Setup (One-time)
1. **Open PowerShell as Administrator**
2. **Run:** `.\setup-windows-service.ps1`
3. **Wait for success message** - service will auto-start

### Restart Service (Anytime)
- **Run:** `.\restart-service.ps1` (as Administrator)

### Check Status
- **Run:** `.\check-service-status.ps1` (as Administrator)

---

## What This Does

✅ **Auto-starts Node.js app on system reboot** - no manual intervention needed  
✅ **Monitors the process** - restarts if it crashes  
✅ **Easy restart** - just run the restart script  
✅ **Logs all errors** - check Windows Event Viewer for troubleshooting  

---

## Configuration Before Running Setup

Edit `setup-windows-service.ps1` and verify:

```powershell
$nodeExe = "C:\Program Files\nodejs\node.exe"  # Node.js installation path
$startScript = "$appPath\server.js"             # Your app's entry point
$port = 3000                                     # Port your app runs on
```

**Find Node.js path:**
```powershell
Get-Command node  # Shows Node.js location
```

---

## For the Other Machine

1. Copy these files to the other machine
2. Follow the same "Quick Start" steps
3. Adjust paths if needed (different Node.js installation location)

---

## Troubleshooting

**Service won't start?**
- Check Event Viewer: `eventvwr.msc` → Application → Look for errors
- Verify Node.js is installed: `node --version`
- Check app entry point exists: `server.js` or `package.json` main field

**Website still not loading?**
```powershell
# Check if service is running
Get-Service AmerisCchildAcademy

# Check if port is listening
netstat -ano | findstr :3000

# Test connection locally
curl http://localhost:3000
```

**Need to uninstall service?**
```powershell
nssm remove AmerisCchildAcademy confirm
```

---

## Quick Commands Reference

```powershell
# Restart service
.\restart-service.ps1

# Check status
.\check-service-status.ps1

# View service in Services.msc
services.msc

# View application logs
eventvwr.msc
```

---

## Service Details

- **Service Name:** `AmerisCchildAcademy`
- **Runs as:** Local System account
- **Auto-start:** Enabled on system boot
- **Process Manager:** NSSM (Non-Sucking Service Manager)
