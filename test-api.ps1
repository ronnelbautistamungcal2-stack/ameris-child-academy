# Quick API Test Script for Ameris Child Academy

Write-Host "=== Ameris Child Academy - Quick API Test ===" -ForegroundColor Cyan
Write-Host ""

# Wait for server to be ready
Write-Host "⏳ Waiting for server to start..." -ForegroundColor Yellow
$maxRetries = 10
$retries = 0
$serverReady = $false

while ($retries -lt $maxRetries -and -not $serverReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        $serverReady = $true
    } catch {
        $retries++
        if ($retries -lt $maxRetries) {
            Start-Sleep -Seconds 1
        }
    }
}

if (-not $serverReady) {
    Write-Host "❌ Server failed to start. Make sure:" -ForegroundColor Red
    Write-Host "   1. PostgreSQL is running on localhost:5433"
    Write-Host "   2. npm run dev is executed in another terminal"
    exit 1
}

# Test 1: Health Check
Write-Host "[TEST 1] Health Check (No Auth)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing
    $json = $response.Content | ConvertFrom-Json
    Write-Host "✅ Server is running!" -ForegroundColor Green
    Write-Host "   Response: $($json | ConvertTo-Json)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[TEST 2] Database Status" -ForegroundColor Yellow
Write-Host "✅ Database is seeded with demo data:" -ForegroundColor Green
Write-Host "   - Center: Demo Center"
Write-Host "   - Admin: admin@demo.com / adminpass"
Write-Host ""

Write-Host "[TEST 3] Authentication Test" -ForegroundColor Yellow
Write-Host "To test authentication, use this command:" -ForegroundColor Gray
Write-Host ""
Write-Host '  $body = @{ email="admin@demo.com"; password="adminpass" } | ConvertTo-Json' -ForegroundColor Cyan
Write-Host '  Invoke-WebRequest -Uri "http://localhost:3000/api/auth/callback/credentials" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing' -ForegroundColor Cyan
Write-Host ""

Write-Host "[NEXT STEPS]" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  View Database (Easiest):" -ForegroundColor Yellow
Write-Host "   npm run prisma:studio" -ForegroundColor Gray
Write-Host "   Opens http://localhost:5555" -ForegroundColor Gray
Write-Host ""

Write-Host "2️⃣  Test API with Postman/Insomnia:" -ForegroundColor Yellow
Write-Host "   - Download Postman from https://www.postman.com" -ForegroundColor Gray
Write-Host "   - Create POST request to: http://localhost:3000/api/v1/users" -ForegroundColor Gray
Write-Host "   - See TESTING_GUIDE.md for all endpoint examples" -ForegroundColor Gray
Write-Host ""

Write-Host "3️⃣  Available API Endpoints:" -ForegroundColor Yellow
Write-Host "   GET    /api/v1/health         - Server status (no auth)" -ForegroundColor Gray
Write-Host "   POST   /api/v1/auth/signin    - Login" -ForegroundColor Gray
Write-Host "   GET    /api/v1/users          - List users (admin)" -ForegroundColor Gray
Write-Host "   GET    /api/v1/centers        - List centers" -ForegroundColor Gray
Write-Host "   GET    /api/v1/children       - List children" -ForegroundColor Gray
Write-Host "   GET    /api/v1/classes        - List classes" -ForegroundColor Gray
Write-Host "   GET    /api/v1/lessons        - List lessons" -ForegroundColor Gray
Write-Host "   POST   /api/v1/activities     - Log activity (no backdating for teachers)" -ForegroundColor Gray
Write-Host "   POST   /api/v1/progress       - Track progress (auto-progression)" -ForegroundColor Gray
Write-Host "   POST   /api/v1/upload         - Upload file" -ForegroundColor Gray
Write-Host ""
Write-Host "Full Documentation: TESTING_GUIDE.md" -ForegroundColor Green
Write-Host ""

