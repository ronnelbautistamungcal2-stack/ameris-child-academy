# PowerShell API Testing Commands

## Quick Reference

### 1. Test Health (No Auth Required)

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing | ConvertTo-Json
```

### 2. Login (Get Session Token)

```powershell
$body = @{
    email = "admin@demo.com"
    password = "adminpass"
} | ConvertTo-Json

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/auth/callback/credentials" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing

$response.Content | ConvertFrom-Json
```

### 3. List Users (Requires Auth)

```powershell
# First get token from login above
$token = "YOUR_JWT_TOKEN_HERE"

$headers = @{
    "Cookie" = "next-auth.session-token=$token"
    "Content-Type" = "application/json"
}

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/users" `
    -Method GET `
    -Headers $headers `
    -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

### 4. List Centers

```powershell
$token = "YOUR_JWT_TOKEN_HERE"

$headers = @{
    "Cookie" = "next-auth.session-token=$token"
}

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/centers" `
    -Method GET `
    -Headers $headers `
    -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

### 5. List Children

```powershell
$token = "YOUR_JWT_TOKEN_HERE"
$centerId = "YOUR_CENTER_ID"

$headers = @{
    "Cookie" = "next-auth.session-token=$token"
}

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/children?centerId=$centerId" `
    -Method GET `
    -Headers $headers `
    -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

### 6. Create Activity Log (No Backdating for Teachers)

```powershell
$token = "YOUR_JWT_TOKEN_HERE"

$body = @{
    childId = "CHILD_UUID_HERE"
    type = "DIAPER_CHANGE"
    details = @{ condition = "wet" }
    notes = "Diaper changed at 2:00 PM"
} | ConvertTo-Json

$headers = @{
    "Cookie" = "next-auth.session-token=$token"
    "Content-Type" = "application/json"
}

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/activities" `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

### 7. Create Progress Record

```powershell
$token = "YOUR_JWT_TOKEN_HERE"

$body = @{
    childId = "CHILD_UUID_HERE"
    lessonId = "LESSON_UUID_HERE"
    status = "NOT_STARTED"
    goalIndex = 1
} | ConvertTo-Json

$headers = @{
    "Cookie" = "next-auth.session-token=$token"
    "Content-Type" = "application/json"
}

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/progress" `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

### 8. Update Progress to COMPLETED (Auto-Progression)

```powershell
$token = "YOUR_JWT_TOKEN_HERE"
$progressId = "PROGRESS_UUID_HERE"

$body = @{
    status = "COMPLETED"
    achievedAt = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json

$headers = @{
    "Cookie" = "next-auth.session-token=$token"
    "Content-Type" = "application/json"
}

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/progress/$progressId" `
    -Method PUT `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json
# Next goal (goalIndex=2) should be auto-created!
```

### 9. Upload a File

```powershell
$token = "YOUR_JWT_TOKEN_HERE"
$filePath = "C:\path\to\your\file.jpg"

# Convert file to Base64
$fileContent = [System.IO.File]::ReadAllBytes($filePath)
$base64 = [Convert]::ToBase64String($fileContent)

$body = @{
    fileName = (Split-Path -Leaf $filePath)
    file = $base64
} | ConvertTo-Json

$headers = @{
    "Cookie" = "next-auth.session-token=$token"
    "Content-Type" = "application/json"
}

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/upload" `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

---

## Helper Function: Make API Calls Easy

Paste this into PowerShell profile to make testing easier:

```powershell
function Invoke-ApiCall {
    param(
        [string]$Method = "GET",
        [string]$Path,
        [object]$Body = $null,
        [string]$Token
    )

    $uri = "http://localhost:3000$Path"
    $headers = @{
        "Content-Type" = "application/json"
    }

    if ($Token) {
        $headers["Cookie"] = "next-auth.session-token=$Token"
    }

    $params = @{
        Uri = $uri
        Method = $Method
        Headers = $headers
        UseBasicParsing = $true
    }

    if ($Body) {
        $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
    }

    try {
        $response = Invoke-WebRequest @params
        return $response.Content | ConvertFrom-Json
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Usage:
# $users = Invoke-ApiCall -Method GET -Path "/api/v1/users" -Token $token
# $center = Invoke-ApiCall -Method POST -Path "/api/v1/centers" -Body @{name="New Center"} -Token $token
```

---

## Using Real curl (Not PowerShell Alias)

If you have Git Bash or real curl installed:

```bash
# Use curl.exe to use the real curl, not PowerShell's alias
curl.exe -X POST http://localhost:3000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"adminpass"}'
```

---

## Recommended: Use Postman or Insomnia

1. Download Postman: https://www.postman.com/downloads/
2. Create new collection
3. Add requests for each endpoint
4. Use environment variables for baseUrl and token
5. Much easier than command line!

---

## See Also

- TESTING_GUIDE.md — Full endpoint documentation
- TESTING.md — Original testing guide
- API.md — API reference
