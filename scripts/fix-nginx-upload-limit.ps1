# Raises nginx's request size limit so lesson and form uploads are not
# refused with "413 Request Entity Too Large".
#
# nginx's default client_max_body_size is 1 MB. The app sends uploads as
# base64 JSON (about a third larger than the file), so anything over roughly
# 750 KB was rejected by nginx before it reached the app. The app itself
# accepts requests up to 40 MB and files up to 25 MB.
#
# Run in an Administrator PowerShell on the server:
#   powershell -ExecutionPolicy Bypass -File scripts\fix-nginx-upload-limit.ps1
# It backs up nginx.conf, adds client_max_body_size to the http block (which
# covers every server block), tests the config, and reloads nginx. If the
# test fails it restores the backup and changes nothing.

param(
  [string]$NginxDir = "C:\nginx",
  [string]$Limit = "50m"
)

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw "Run this from an Administrator PowerShell." }

$conf = Join-Path $NginxDir "conf\nginx.conf"
$exe = Join-Path $NginxDir "nginx.exe"
if (-not (Test-Path $conf)) { throw "nginx.conf not found at $conf" }
if (-not (Test-Path $exe)) { throw "nginx.exe not found at $exe" }

$text = Get-Content -Raw -Path $conf
if ($text -match '(?m)^\s*client_max_body_size\s+') {
  Write-Host "client_max_body_size is already set:" -ForegroundColor Yellow
  Select-String -Path $conf -Pattern 'client_max_body_size' | ForEach-Object { Write-Host "  line $($_.LineNumber): $($_.Line.Trim())" }
  Write-Host "Nothing changed. Edit it by hand if it is below $Limit."
  exit 0
}

$httpBlock = [regex]'(?m)^(\s*)http\s*\{[^\r\n]*\r?\n'
$match = $httpBlock.Match($text)
if (-not $match.Success) { throw "Could not find the 'http {' block in $conf. Add 'client_max_body_size $Limit;' by hand." }

$backup = "$conf.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -Path $conf -Destination $backup
Write-Host "Backed up nginx.conf to $backup"

$indent = $match.Groups[1].Value + "    "
$line = "${indent}# Uploads are base64 JSON; nginx's 1 MB default refused them (413).`r`n${indent}client_max_body_size $Limit;`r`n"
$updated = $text.Insert($match.Index + $match.Length, $line)
# Write without a BOM: nginx cannot parse a config that starts with one.
[System.IO.File]::WriteAllText($conf, $updated, (New-Object System.Text.UTF8Encoding($false)))

Push-Location $NginxDir
try {
  & $exe -t 2>&1 | ForEach-Object { Write-Host "  $_" }
  if ($LASTEXITCODE -ne 0) {
    Copy-Item -Path $backup -Destination $conf -Force
    throw "nginx -t failed, so the original nginx.conf was restored. Nothing was reloaded."
  }
  & $exe -s reload
  if ($LASTEXITCODE -ne 0) { throw "nginx -s reload failed. The new config is in place; reload nginx by hand." }
} finally {
  Pop-Location
}

Write-Host "Done: client_max_body_size $Limit is set and nginx was reloaded." -ForegroundColor Green
