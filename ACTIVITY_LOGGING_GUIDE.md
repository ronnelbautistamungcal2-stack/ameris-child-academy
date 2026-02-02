# Activity Logging - Complete Testing Guide

## What is Activity Logging?

Activity Logging tracks daily events for children:

- Diaper changes
- Meals
- Naps
- Activities
- Behavior
- Custom notes

**Key Feature:** Teachers CANNOT backdate logs (only admins can) — ensures data integrity.

---

## Quick Test

### 1. Get Demo Data IDs

Open Prisma Studio to find IDs:

```bash
npm run prisma:studio
```

Then navigate to:

- **Users** → Copy admin user ID
- **Centers** → Copy center ID
- **Children** → Copy child ID (or create one)

### 2. Test in PowerShell

**Create an Activity Log (No Backdating):**

```powershell
$token = "YOUR_JWT_TOKEN"  # Get from login
$childId = "CHILD_UUID"     # From Prisma Studio

$body = @{
    childId = $childId
    type = "DIAPER_CHANGE"
    details = @{ condition = "wet"; time = "2:00 PM" }
    notes = "Regular diaper change"
} | ConvertTo-Json

$headers = @{
    "Cookie" = "next-auth.session-token=$token"
    "Content-Type" = "application/json"
}

Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/activities" `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing | ConvertTo-Json
```

**Get All Activities for a Child:**

```powershell
$token = "YOUR_JWT_TOKEN"
$childId = "CHILD_UUID"

$headers = @{
    "Cookie" = "next-auth.session-token=$token"
}

Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/activities?childId=$childId" `
    -Method GET `
    -Headers $headers `
    -UseBasicParsing | ConvertTo-Json
```

---

## Activity Types

The system supports these activity types:

| Type             | Description            |
| ---------------- | ---------------------- |
| `DIAPER_CHANGE`  | Diaper maintenance     |
| `NAP`            | Sleep/nap time         |
| `BOTTLE`         | Bottle feeding         |
| `MEAL`           | Food/snack time        |
| `SNACK`          | Between-meal snack     |
| `ACTIVITY`       | Learning/play activity |
| `TASK_CHECKLIST` | Checklist completion   |
| `BEHAVIOR`       | Behavioral note        |
| `OTHER`          | Custom activity        |

---

## Feature 1: No Backdating for Teachers ✅

### Test: Teacher Cannot Backdate

**Setup:**

1. Login as TEACHER
2. Try to create activity with past timestamp

**Teacher Backdating Test:**

```powershell
$teacherToken = "TEACHER_JWT_TOKEN"
$childId = "CHILD_UUID"

# Try to log activity from 5 minutes ago
$body = @{
    childId = $childId
    type = "MEAL"
    createdAt = (Get-Date).AddMinutes(-5).ToUniversalTime().ToString("o")
    notes = "Lunch (backdated)"
} | ConvertTo-Json

$headers = @{
    "Cookie" = "next-auth.session-token=$teacherToken"
    "Content-Type" = "application/json"
}

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/activities" `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing `
    -ErrorAction SilentlyContinue

# Expected: 403 Forbidden
# Error: "Teachers cannot backdate activity logs"
$response.Content | ConvertFrom-Json | ConvertTo-Json
```

**Expected Response:**

```json
{
  "error": "Teachers cannot backdate activity logs"
}
```

### Test: Admin CAN Backdate

**Admin Backdating Test:**

```powershell
$adminToken = "ADMIN_JWT_TOKEN"
$childId = "CHILD_UUID"

# Admin logs activity from yesterday
$body = @{
    childId = $childId
    type = "MEAL"
    createdAt = (Get-Date).AddDays(-1).ToUniversalTime().ToString("o")
    notes = "Lunch (logged late)"
} | ConvertTo-Json

$headers = @{
    "Cookie" = "next-auth.session-token=$adminToken"
    "Content-Type" = "application/json"
}

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/activities" `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing

# Expected: 201 Created
$response.Content | ConvertFrom-Json | ConvertTo-Json
```

**Expected Response:**

```json
{
  "id": "activity-uuid",
  "childId": "child-uuid",
  "type": "MEAL",
  "notes": "Lunch (logged late)",
  "recordedById": "admin-uuid",
  "isBackdated": true,
  "createdAt": "2026-02-01T12:00:00Z"
}
```

---

## Feature 2: Audit Trail (recordedBy) ✅

Every activity logs **who** recorded it:

```powershell
# When you create an activity, it stores:
# - recordedById: The user's ID who logged it
# - isBackdated: Boolean flag if backdated
# - createdAt: Actual timestamp

# Get activity details including recorder info
$response | ConvertFrom-Json | Select-Object -Property @{
    Name = "Activity"
    Expression = { $_.notes }
}, @{
    Name = "RecordedBy"
    Expression = { $_.recordedById }
}, @{
    Name = "IsBackdated"
    Expression = { $_.isBackdated }
}
```

---

## Feature 3: Filter Activities ✅

### Filter by Child ID

```powershell
$childId = "CHILD_UUID"
$headers = @{ "Cookie" = "next-auth.session-token=$token" }

Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/activities?childId=$childId" `
    -Method GET `
    -Headers $headers `
    -UseBasicParsing | ConvertTo-Json
```

### Filter by Activity Type

```powershell
# Get all DIAPER_CHANGE activities for a child
$childId = "CHILD_UUID"
$type = "DIAPER_CHANGE"
$headers = @{ "Cookie" = "next-auth.session-token=$token" }

Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/activities?childId=$childId&type=$type" `
    -Method GET `
    -Headers $headers `
    -UseBasicParsing | ConvertTo-Json
```

### Filter by Multiple Types

```powershell
# Get all feeding-related activities (MEAL, BOTTLE, SNACK)
$childId = "CHILD_UUID"
$headers = @{ "Cookie" = "next-auth.session-token=$token" }

# Get all activities, then filter client-side
$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/activities?childId=$childId" `
    -Method GET `
    -Headers $headers `
    -UseBasicParsing

$activities = $response.Content | ConvertFrom-Json
$feedingTypes = @("MEAL", "BOTTLE", "SNACK")

$feeding = $activities | Where-Object { $_.type -in $feedingTypes }
$feeding | ConvertTo-Json
```

---

## Feature 4: Real-Time Notifications ✅

Activities broadcast via Socket.io in real-time.

### Test Real-Time Updates

**In Browser Console:**

```javascript
// Connect to Socket.io
const socket = io("http://localhost:3000");

// Join center room (get centerId from database)
socket.emit("join-center", "center-uuid-here");

// Listen for activity logs
socket.on("activity:logged", (activity) => {
  console.log("New activity logged:", activity);
  // {
  //   "type": "ACTIVITY_LOGGED",
  //   "data": { ...activity details... },
  //   "timestamp": "2026-02-02T..."
  // }
});

// When a teacher logs an activity, it appears instantly here!
```

**Test Event:**

1. Open browser console
2. Run above code
3. In another terminal, create an activity (see examples above)
4. Activity appears instantly in console!

---

## Complete Testing Workflow

### Step 1: Setup Demo Data

```bash
npm run prisma:seed
npm run prisma:studio
```

Copy IDs from database:

- Center ID
- Child ID
- Admin User ID
- Teacher User ID

### Step 2: Login as Teacher

```powershell
$teacherEmail = "teacher@demo.com"  # Or create one
$teacherPassword = "teacherpass"

$body = @{
    email = $teacherEmail
    password = $teacherPassword
} | ConvertTo-Json

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/auth/callback/credentials" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing `
    -ErrorAction SilentlyContinue

# Extract token from response
$teacherToken = $response.Headers['Set-Cookie'] |
    Select-String 'next-auth.session-token=([^;]+)' |
    ForEach-Object { $_.Matches.Groups[1].Value }

Write-Host "Teacher Token: $teacherToken"
```

### Step 3: Create Current Activity (No Backdate)

```powershell
$body = @{
    childId = "CHILD_UUID"
    type = "MEAL"
    details = @{ meal = "breakfast"; time = "8:30 AM" }
    notes = "Ate oatmeal and fruit"
} | ConvertTo-Json

$headers = @{
    "Cookie" = "next-auth.session-token=$teacherToken"
    "Content-Type" = "application/json"
}

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/activities" `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing

Write-Host "Activity Created:" -ForegroundColor Green
$response.Content | ConvertFrom-Json | ConvertTo-Json
```

### Step 4: Verify Teacher Cannot Backdate

```powershell
# Try to log past activity as teacher
$body = @{
    childId = "CHILD_UUID"
    type = "NAP"
    createdAt = (Get-Date).AddHours(-2).ToUniversalTime().ToString("o")
    notes = "Afternoon nap"
} | ConvertTo-Json

$headers = @{
    "Cookie" = "next-auth.session-token=$teacherToken"
    "Content-Type" = "application/json"
}

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/activities" `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing `
    -ErrorAction SilentlyContinue

Write-Host "Response:" -ForegroundColor Yellow
$response.Content | ConvertFrom-Json | ConvertTo-Json
# Should show: "Teachers cannot backdate activity logs"
```

### Step 5: View All Activities

```powershell
$headers = @{ "Cookie" = "next-auth.session-token=$teacherToken" }

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/activities?childId=CHILD_UUID" `
    -Method GET `
    -Headers $headers `
    -UseBasicParsing

Write-Host "All Activities:" -ForegroundColor Green
($response.Content | ConvertFrom-Json) | ForEach-Object {
    [PSCustomObject]@{
        Type = $_.type
        Notes = $_.notes
        RecordedBy = $_.recordedBy.name
        IsBackdated = $_.isBackdated
        CreatedAt = $_.createdAt
    }
} | ConvertTo-Json
```

### Step 6: Login as Admin & Test Backdating

```powershell
# Same login as teacher, but use admin@demo.com
$adminToken = "ADMIN_JWT_TOKEN"

# Admin can backdate
$body = @{
    childId = "CHILD_UUID"
    type = "DIAPER_CHANGE"
    createdAt = (Get-Date).AddDays(-1).ToUniversalTime().ToString("o")
    details = @{ condition = "wet" }
    notes = "Morning diaper change (logged late)"
} | ConvertTo-Json

$headers = @{
    "Cookie" = "next-auth.session-token=$adminToken"
    "Content-Type" = "application/json"
}

$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/activities" `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing

Write-Host "Admin Backdated Activity:" -ForegroundColor Green
$response.Content | ConvertFrom-Json | ConvertTo-Json
# Should succeed with isBackdated=true
```

---

## Database Schema

```prisma
model ActivityLog {
  id            String   @id @default(cuid())
  childId       String
  child         Child    @relation(fields: [childId], references: [id], onDelete: Cascade)

  type          ActivityType  // DIAPER_CHANGE, MEAL, NAP, etc
  details       Json?         // Optional structured data
  notes         String?       // Text notes

  recordedById  String        // Who logged it (audit trail)
  recordedBy    User    @relation(fields: [recordedById], references: [id])

  isBackdated   Boolean @default(false)  // Did admin backdate it?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum ActivityType {
  DIAPER_CHANGE
  NAP
  BOTTLE
  MEAL
  SNACK
  ACTIVITY
  TASK_CHECKLIST
  BEHAVIOR
  OTHER
}
```

---

## Common Use Cases

### Use Case 1: Daily Summary Report

```powershell
# Get all activities for a child today
$childId = "CHILD_UUID"
$today = (Get-Date).Date

$headers = @{ "Cookie" = "next-auth.session-token=$token" }
$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/activities?childId=$childId" `
    -Method GET `
    -Headers $headers `
    -UseBasicParsing

$activities = $response.Content | ConvertFrom-Json
$today_activities = $activities | Where-Object {
    ([datetime]$_.createdAt).Date -eq $today
}

$today_activities | Group-Object type | ForEach-Object {
    [PSCustomObject]@{
        Activity = $_.Name
        Count = $_.Count
    }
}
```

### Use Case 2: Compliance Check (No Gaps)

```powershell
# Check if required activities are logged (e.g., meals)
$childId = "CHILD_UUID"
$requiredTypes = @("MEAL", "NAP")

$headers = @{ "Cookie" = "next-auth.session-token=$token" }
$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/activities?childId=$childId" `
    -Method GET `
    -Headers $headers `
    -UseBasicParsing

$activities = $response.Content | ConvertFrom-Json
$logged = $activities.type | Select-Object -Unique

$missing = $requiredTypes | Where-Object { $_ -notin $logged }

if ($missing) {
    Write-Host "Missing activities: $($missing -join ', ')" -ForegroundColor Yellow
} else {
    Write-Host "All required activities logged!" -ForegroundColor Green
}
```

### Use Case 3: Parent Notification

When activity is logged, emit to parent:

```javascript
// In Socket.io handler
socket.emit("join-center", centerId);

socket.on("activity:logged", (activity) => {
  // Check if logged activity is important
  if (["DIAPER_CHANGE", "MEAL", "BEHAVIOR"].includes(activity.type)) {
    // Send push notification to parent
    sendNotificationToParent(activity.childId, {
      title: `${activity.type} logged for ${childName}`,
      message: activity.notes,
    });
  }
});
```

---

## Endpoints Reference

| Method   | Endpoint                              | Description                                |
| -------- | ------------------------------------- | ------------------------------------------ |
| `GET`    | `/api/v1/activities?childId=X`        | List activities for child                  |
| `GET`    | `/api/v1/activities?childId=X&type=Y` | Filter by type                             |
| `POST`   | `/api/v1/activities`                  | Create activity (no backdate for teachers) |
| `GET`    | `/api/v1/activities/[id]`             | Get single activity                        |
| `DELETE` | `/api/v1/activities/[id]`             | Delete activity (admin only)               |

---

## Summary

✅ **Activity Logging Features:**

1. **No Backdating for Teachers** — Only admins can log past activities
2. **Audit Trail** — Track who logged each activity (recordedBy)
3. **Filtering** — By child, type, date range
4. **Real-Time** — Socket.io broadcasts to center rooms
5. **Rich Details** — Structured JSON for activity metadata
6. **Compliance** — Mark if activity was backdated (audit)

**Key Test:** Teacher logs recent activity ✅ | Teacher tries to backdate → 403 ❌ | Admin backdates → Success ✅
