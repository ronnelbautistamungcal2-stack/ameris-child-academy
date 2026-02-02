# JWT Token & Login Testing Guide

## How Authentication Works

Your app uses **NextAuth.js** with JWT tokens. Here's the flow:

1. **POST** credentials to login endpoint
2. **Receive** JWT token in response
3. **Include** token in Cookie header for subsequent requests
4. **Token** validates your identity and role (ADMIN, TEACHER, PARENT, etc.)

---

## Quick Login Test

### Method 1: Simple Login & Get Token (Recommended)

```powershell
# 1. Define credentials
$email = "admin@demo.com"
$password = "adminpass"

# 2. Create request body
$body = @{
    email = $email
    password = $password
} | ConvertTo-Json

# 3. Send login request
$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/auth/callback/credentials" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing `
    -ErrorAction SilentlyContinue

# 4. Extract JWT token from response headers
if ($response.Headers['Set-Cookie']) {
    $tokenMatch = $response.Headers['Set-Cookie'] |
        Select-String 'next-auth.session-token=([^;]+)'

    if ($tokenMatch) {
        $token = $tokenMatch.Matches[0].Groups[1].Value
        Write-Host "✅ Login Successful!" -ForegroundColor Green
        Write-Host "Token: $token" -ForegroundColor Cyan
    } else {
        Write-Host "❌ No token found in response" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Login failed" -ForegroundColor Red
    $response.Content | ConvertFrom-Json
}
```

**Output Example:**

```
✅ Login Successful!
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

---

## Method 2: Store Token in Variable for Reuse

```powershell
# Function to login and store token
function Get-AuthToken {
    param(
        [string]$Email = "admin@demo.com",
        [string]$Password = "adminpass"
    )

    $body = @{
        email = $Email
        password = $Password
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest `
            -Uri "http://localhost:3000/api/auth/callback/credentials" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -UseBasicParsing `
            -ErrorAction Stop

        $tokenMatch = $response.Headers['Set-Cookie'] |
            Select-String 'next-auth.session-token=([^;]+)'

        if ($tokenMatch) {
            return $tokenMatch.Matches[0].Groups[1].Value
        } else {
            Write-Host "❌ Failed to extract token" -ForegroundColor Red
            return $null
        }
    } catch {
        Write-Host "❌ Login failed: $_" -ForegroundColor Red
        return $null
    }
}

# Usage:
$adminToken = Get-AuthToken -Email "admin@demo.com" -Password "adminpass"
$teacherToken = Get-AuthToken -Email "teacher@demo.com" -Password "teacherpass"

# Now use tokens in requests
Write-Host "Admin Token: $adminToken"
Write-Host "Teacher Token: $teacherToken"
```

---

## Method 3: Complete Login + API Call Example

```powershell
# 1. Login
Write-Host "Logging in as admin..." -ForegroundColor Yellow

$loginBody = @{
    email = "admin@demo.com"
    password = "adminpass"
} | ConvertTo-Json

$loginResponse = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/auth/callback/credentials" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginBody `
    -UseBasicParsing `
    -ErrorAction SilentlyContinue

$token = $loginResponse.Headers['Set-Cookie'] |
    Select-String 'next-auth.session-token=([^;]+)' |
    ForEach-Object { $_.Matches[0].Groups[1].Value }

Write-Host "✅ Got token: $($token.Substring(0, 20))..." -ForegroundColor Green

# 2. Use token to get users
Write-Host ""
Write-Host "Fetching users list..." -ForegroundColor Yellow

$headers = @{
    "Cookie" = "next-auth.session-token=$token"
    "Content-Type" = "application/json"
}

$apiResponse = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/users" `
    -Method GET `
    -Headers $headers `
    -UseBasicParsing

Write-Host "✅ Got response:" -ForegroundColor Green
$apiResponse.Content | ConvertFrom-Json | ConvertTo-Json -Depth 2
```

---

## Method 4: Test Different User Roles

```powershell
# Create a script to test login with different roles

$users = @(
    @{ email = "admin@demo.com"; password = "adminpass"; role = "ADMIN" },
    @{ email = "teacher@demo.com"; password = "teacherpass"; role = "TEACHER" },
    @{ email = "parent@demo.com"; password = "parentpass"; role = "PARENT" }
)

foreach ($user in $users) {
    Write-Host ""
    Write-Host "Testing login for: $($user.role)" -ForegroundColor Cyan

    $body = @{
        email = $user.email
        password = $user.password
    } | ConvertTo-Json

    $response = Invoke-WebRequest `
        -Uri "http://localhost:3000/api/auth/callback/credentials" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -UseBasicParsing `
        -ErrorAction SilentlyContinue

    if ($response.StatusCode -eq 200) {
        $token = $response.Headers['Set-Cookie'] |
            Select-String 'next-auth.session-token=([^;]+)' |
            ForEach-Object { $_.Matches[0].Groups[1].Value }

        Write-Host "✅ Login successful" -ForegroundColor Green
        Write-Host "   Token: $($token.Substring(0, 20))..." -ForegroundColor Gray

        # Store token in variable based on role
        switch ($user.role) {
            "ADMIN" { $adminToken = $token }
            "TEACHER" { $teacherToken = $token }
            "PARENT" { $parentToken = $token }
        }
    } else {
        Write-Host "❌ Login failed" -ForegroundColor Red
    }
}

# Now you have tokens for all roles
Write-Host ""
Write-Host "Available tokens:" -ForegroundColor Yellow
Write-Host "  ADMIN:   $($adminToken.Substring(0, 20))..."
Write-Host "  TEACHER: $($teacherToken.Substring(0, 20))..."
Write-Host "  PARENT:  $($parentToken.Substring(0, 20))..."
```

---

## Troubleshooting Login Issues

### Issue: "Invalid credentials"

```powershell
# Check if demo data is seeded
npm run prisma:seed

# Then try login again
```

### Issue: "Cannot find token in response"

```powershell
# Check the full response
$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/auth/callback/credentials" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing

# Print all headers
Write-Host "Headers:" -ForegroundColor Yellow
$response.Headers | ForEach-Object {
    Write-Host "$($_.Key): $($_.Value)"
}

# Print response body
Write-Host ""
Write-Host "Body:" -ForegroundColor Yellow
$response.Content
```

### Issue: "401 Unauthorized"

```powershell
# Server might not be running
npm run dev

# Or database connection failed
# Check PostgreSQL is running on localhost:5433
psql -U postgres -d ameris -h localhost -p 5433 -c "SELECT 1"
```

---

## Using Token in Requests

### Example 1: List Users (Admin Only)

```powershell
# Get admin token first
$token = Get-AuthToken "admin@demo.com" "adminpass"

# Use token in request
$headers = @{
    "Cookie" = "next-auth.session-token=$token"
}

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/users" `
    -Method GET `
    -Headers $headers `
    -UseBasicParsing

$response.Content | ConvertFrom-Json | ForEach-Object {
    [PSCustomObject]@{
        ID = $_.id
        Name = $_.name
        Email = $_.email
        Role = $_.role
    }
} | Format-Table
```

### Example 2: Create Child (Teacher)

```powershell
# Get teacher token
$token = Get-AuthToken "teacher@demo.com" "teacherpass"

# Prepare request
$body = @{
    firstName = "Emma"
    lastName = "Smith"
    birthDate = "2023-06-15"
    centerId = "CENTER_ID_HERE"
    classRoomId = "CLASS_ID_HERE"
    parentId = "PARENT_ID_HERE"
} | ConvertTo-Json

$headers = @{
    "Cookie" = "next-auth.session-token=$token"
    "Content-Type" = "application/json"
}

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/children" `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing

Write-Host "Child created:" -ForegroundColor Green
$response.Content | ConvertFrom-Json | ConvertTo-Json
```

### Example 3: Log Activity

```powershell
# Get teacher token
$token = Get-AuthToken "teacher@demo.com" "teacherpass"

# Log an activity
$body = @{
    childId = "CHILD_ID_HERE"
    type = "MEAL"
    notes = "Breakfast - oatmeal and fruit"
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

Write-Host "Activity logged:" -ForegroundColor Green
$response.Content | ConvertFrom-Json | ConvertTo-Json
```

---

## Understanding JWT Token Structure

A JWT token has 3 parts separated by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ
.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**Part 1: Header** (encoded JSON)

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Part 2: Payload** (encoded JSON) — Contains your data

```json
{
  "sub": "1234567890",
  "name": "John Doe",
  "role": "ADMIN",
  "id": "user-uuid",
  "iat": 1516239022
}
```

**Part 3: Signature** — Cryptographic signature to verify token

### Decode JWT Token in PowerShell

```powershell
function Decode-JwtToken {
    param(
        [string]$Token
    )

    # Split token into parts
    $parts = $Token.Split('.')

    # Decode payload (part 2)
    $payload = $parts[1]

    # Add padding if needed
    $padLength = 4 - ($payload.Length % 4)
    if ($padLength -ne 4) {
        $payload += '=' * $padLength
    }

    # Decode from Base64
    $decoded = [System.Text.Encoding]::UTF8.GetString(
        [System.Convert]::FromBase64String($payload)
    )

    # Parse JSON
    return $decoded | ConvertFrom-Json
}

# Usage:
$token = Get-AuthToken "admin@demo.com" "adminpass"
$claims = Decode-JwtToken $token

Write-Host "Token Claims:" -ForegroundColor Yellow
Write-Host "  ID: $($claims.id)"
Write-Host "  Name: $($claims.name)"
Write-Host "  Role: $($claims.role)"
Write-Host "  Expires: $((Get-Date).AddSeconds($claims.exp - (Get-Date -UFormat %s)))"
```

---

## Demo Users

These are seeded in the database:

| Email              | Password      | Role    |
| ------------------ | ------------- | ------- |
| `admin@demo.com`   | `adminpass`   | ADMIN   |
| `teacher@demo.com` | `teacherpass` | TEACHER |
| `parent@demo.com`  | `parentpass`  | PARENT  |

To create more users:

```powershell
# Get admin token
$token = Get-AuthToken "admin@demo.com" "adminpass"

# Create new user
$body = @{
    email = "coach@demo.com"
    password = "coachpass"
    name = "Sarah Coach"
    role = "COACH"
} | ConvertTo-Json

$headers = @{
    "Cookie" = "next-auth.session-token=$token"
    "Content-Type" = "application/json"
}

Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/users" `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing
```

---

## Quick Reference

**Login Endpoint:**

```
POST /api/auth/callback/credentials
Content-Type: application/json

{
  "email": "admin@demo.com",
  "password": "adminpass"
}
```

**Token Location:** `Set-Cookie` header → `next-auth.session-token=TOKEN_VALUE`

**Use Token:** Include in Cookie header of subsequent requests

```
Cookie: next-auth.session-token=YOUR_TOKEN_HERE
```

**Token Expiration:** 30 days (configurable in NextAuth config)

**Refresh:** Automatically refreshed when making authenticated requests

---

## Next Steps

1. ✅ Run `npm run dev` to start server
2. ✅ Use Method 1 above to login and get token
3. ✅ Copy token value
4. ✅ Use token in other API requests
5. ✅ See ACTIVITY_LOGGING_GUIDE.md for testing activity endpoints
6. ✅ See POWERSHELL_TESTING_COMMANDS.md for more examples
