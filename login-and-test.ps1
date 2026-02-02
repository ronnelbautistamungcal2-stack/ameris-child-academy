# Complete Login and Activity Logging Test Script
# Note: NextAuth's /callback/credentials returns HTML redirect, not JSON.
# We POST form data, then query /api/auth/session to get JWT token.

Write-Host "Step 1: Attempting login via NextAuth..." -ForegroundColor Cyan

# 1a) POST form-encoded credentials to /callback/credentials
$body = "email=admin@demo.com&password=adminpass"
$headers = @{ "Content-Type" = "application/x-www-form-urlencoded" }

try {
    $response = Invoke-WebRequest `
        -Uri "http://localhost:3000/api/auth/callback/credentials" `
        -Method POST `
        -Body $body `
        -Headers $headers `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "Login POST succeeded (Status $($response.StatusCode))" -ForegroundColor Green
    
    # Extract token from Set-Cookie header
    $cookieHeader = $response.Headers['Set-Cookie']
    if ($cookieHeader) {
        $tokenMatch = $cookieHeader | Select-String 'next-auth.session-token=([^;]+)'
        if ($tokenMatch) {
            $token = $tokenMatch.Matches[0].Groups[1].Value
            Write-Host "JWT Token extracted: $($token.Substring(0, 20))..." -ForegroundColor Green
            
            # Store token for later use
            $global:authToken = $token
        } else {
            Write-Host "Could not extract token from Set-Cookie header" -ForegroundColor Yellow
            Write-Host "Set-Cookie header: $cookieHeader" -ForegroundColor Yellow
        }
    } else {
        Write-Host "No user in session - login may have failed" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Failed to fetch session: $_" -ForegroundColor Yellow
}


# Step 2: Get list of children to use in activity logging test
Write-Host "`nStep 2: Fetching children list..." -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest `
        -Uri "http://localhost:3000/api/v1/children" `
        -Method GET `
        -UseBasicParsing `
        -ErrorAction Stop
    
    $children = $response.Content | ConvertFrom-Json
    if ($children -is [array]) {
        Write-Host "Found $($children.Count) children" -ForegroundColor Green
        if ($children.Count -gt 0) {
            $firstChild = $children[0]
            Write-Host "First child: $($firstChild.name) (ID: $($firstChild.id))" -ForegroundColor Green
            $global:childId = $firstChild.id
        }
    } else {
        Write-Host "Found 1 child: $($children.name) (ID: $($children.id))" -ForegroundColor Green
        $global:childId = $children.id
    }
} catch {
    Write-Host "Failed to fetch children: $_" -ForegroundColor Yellow
}

# Step 3: Test activity logging (current time - should succeed for teacher)
if ($global:childId -and $global:sessionData) {
    Write-Host "`nStep 3: Testing activity logging (current timestamp)..." -ForegroundColor Cyan
    
    $activityBody = ConvertTo-Json @{
        childId = $global:childId
        type = "MEAL"
        details = @{ meal = "lunch"; time = "12:00 PM" }
        notes = "Test activity logged now"
    }
    
    try {
        $activityResponse = Invoke-WebRequest `
            -Uri "http://localhost:3000/api/v1/activities" `
            -Method POST `
            -Body $activityBody `
            -Headers @{ "Content-Type" = "application/json" } `
            -UseBasicParsing `
            -ErrorAction Stop
        
        $activity = $activityResponse.Content | ConvertFrom-Json
        Write-Host "Activity created: $($activity.id)" -ForegroundColor Green
        Write-Host "  Type: $($activity.type)" -ForegroundColor Green
        Write-Host "  Notes: $($activity.notes)" -ForegroundColor Green
        $global:activityId = $activity.id
    } catch {
        Write-Host "Failed to create activity: $_" -ForegroundColor Yellow
    }
}

Write-Host "`nTest setup complete!" -ForegroundColor Cyan
if ($global:sessionData) {
    Write-Host "  User: $($global:sessionData.user.email) (Role: $($global:sessionData.user.role))" -ForegroundColor Gray
}
if ($global:childId) {
    Write-Host "  Child ID: $($global:childId)" -ForegroundColor Gray
}
if ($global:activityId) {
    Write-Host "  Activity ID: $($global:activityId)" -ForegroundColor Gray
}
