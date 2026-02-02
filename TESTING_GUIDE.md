# API & Database Testing Guide

## Prerequisites

✅ **Ensure PostgreSQL is running:**

```bash
# PostgreSQL must be on localhost:5433
# Database: ameris
# User: postgres
# Password: postgres
```

✅ **Dependencies installed:**

```bash
npm install
```

✅ **Prisma migrations applied:**

```bash
npm run prisma:migrate
```

---

## Quick Start: Testing Locally

### 1. Start the Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000` with Socket.io enabled.

### 2. Verify Server is Running

```bash
curl http://localhost:3000/api/health
```

**Expected Response:**

```json
{
  "status": "ok",
  "time": "2026-02-02T12:34:56.789Z"
}
```

---

## Testing Database & Data

### Check if Demo Data Exists

```bash
npm run prisma:studio
```

This opens Prisma Studio on `http://localhost:5555` - a graphical interface to view and modify database records.

**Or via CLI:**

```bash
npm run prisma:seed
```

This seeds demo data if needed:

- **Center:** Demo Center
- **Admin User:** admin@demo.com / password: adminpass
- **Sample Child:** Demo Child
- **Sample Classes & Lessons**

### View Database Records

```bash
npx prisma db execute --stdin < query.sql
```

Or use Prisma Studio (easier):

```bash
npm run prisma:studio
```

---

## Testing Authentication

### 1. Get Auth Session (Requires Login)

First, you need to authenticate. The app uses NextAuth with JWT tokens.

**Option A: Using curl with credentials:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo.com",
    "password": "adminpass"
  }'
```

**Option B: Use Postman or Insomnia**

- Import the API collection (see section below)
- Set up auth in your client

---

## Testing API Endpoints (V1 Structure)

All examples use `/api/v1/*` endpoints (original `/api/*` endpoints also work).

### Health Check (No Auth)

```bash
curl http://localhost:3000/api/v1/users
```

**Note:** Most endpoints require authentication!

---

## Complete API Testing Examples

### A. Users Endpoints

**List all users (Admin only):**

```bash
curl http://localhost:3000/api/v1/users \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN"
```

**Create a new user (Admin only):**

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN" \
  -d '{
    "email": "teacher@demo.com",
    "password": "teacherpass",
    "name": "John Teacher",
    "role": "TEACHER"
  }'
```

**Get user by ID:**

```bash
curl http://localhost:3000/api/v1/users/USER_ID \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN"
```

**Update user:**

```bash
curl -X PUT http://localhost:3000/api/v1/users/USER_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN" \
  -d '{
    "name": "Updated Name",
    "role": "COACH"
  }'
```

---

### B. Centers Endpoints

**List centers:**

```bash
curl http://localhost:3000/api/v1/centers \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN"
```

**Get center by ID:**

```bash
curl http://localhost:3000/api/v1/centers/CENTER_ID \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN"
```

**Create center (Admin only):**

```bash
curl -X POST http://localhost:3000/api/v1/centers \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN" \
  -d '{
    "name": "New Academy Center",
    "address": "123 Main St, City, State 12345"
  }'
```

---

### C. Children Endpoints

**List children:**

```bash
curl "http://localhost:3000/api/v1/children?centerId=CENTER_ID" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN"
```

**Create child:**

```bash
curl -X POST http://localhost:3000/api/v1/children \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "Emma",
    "lastName": "Smith",
    "birthDate": "2023-01-15",
    "centerId": "CENTER_ID",
    "classRoomId": "CLASS_ID",
    "parentId": "PARENT_USER_ID"
  }'
```

**Get child by ID:**

```bash
curl http://localhost:3000/api/v1/children/CHILD_ID \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN"
```

---

### D. Classes Endpoints

**List classes:**

```bash
curl "http://localhost:3000/api/v1/classes?centerId=CENTER_ID" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN"
```

**Create class:**

```bash
curl -X POST http://localhost:3000/api/v1/classes \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN" \
  -d '{
    "name": "Infant Room A",
    "centerId": "CENTER_ID"
  }'
```

---

### E. Lessons Endpoints

**List lessons:**

```bash
curl "http://localhost:3000/api/v1/lessons?centerId=CENTER_ID" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN"
```

**Create lesson:**

```bash
curl -X POST http://localhost:3000/api/v1/lessons \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN" \
  -d '{
    "title": "Colors Lesson",
    "description": "Learn primary colors",
    "centerId": "CENTER_ID",
    "media": []
  }'
```

---

### F. Activity Logs (Key Feature)

**Create activity log:**

```bash
curl -X POST http://localhost:3000/api/v1/activities \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN" \
  -d '{
    "childId": "CHILD_ID",
    "type": "DIAPER_CHANGE",
    "details": {"condition": "wet"},
    "notes": "Diaper changed at 2:00 PM"
  }'
```

**Get activities for child:**

```bash
curl "http://localhost:3000/api/v1/activities?childId=CHILD_ID" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN"
```

**Backdating Prevention Test:**

```bash
# This will FAIL for teachers (only admins can backdate)
curl -X POST http://localhost:3000/api/v1/activities \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=TEACHER_TOKEN" \
  -d '{
    "childId": "CHILD_ID",
    "type": "MEAL",
    "createdAt": "2026-02-01T10:00:00Z",
    "notes": "Breakfast"
  }'
# Response: 403 - "Teachers cannot backdate activity logs"
```

---

### G. Progress Tracking (Key Feature)

**Create progress record:**

```bash
curl -X POST http://localhost:3000/api/v1/progress \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN" \
  -d '{
    "childId": "CHILD_ID",
    "lessonId": "LESSON_ID",
    "status": "NOT_STARTED",
    "goalIndex": 1
  }'
```

**Get progress for child:**

```bash
curl "http://localhost:3000/api/v1/progress?childId=CHILD_ID" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN"
```

**Auto-Progression Test - Update to COMPLETED:**

```bash
curl -X PUT http://localhost:3000/api/v1/progress/PROGRESS_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN" \
  -d '{
    "status": "COMPLETED",
    "achievedAt": "2026-02-02T14:30:00Z"
  }'

# This automatically creates the next goal:
# {
#   "childId": "...",
#   "lessonId": "...",
#   "status": "NOT_STARTED",
#   "goalIndex": 2,
#   "previousGoalId": "PROGRESS_ID"
# }
```

---

### H. File Upload

**Upload a file (Base64 encoded):**

```bash
# First, encode your file to base64
# On Windows (PowerShell):
# [Convert]::ToBase64String([System.IO.File]::ReadAllBytes("C:\path\to\file.pdf"))

curl -X POST http://localhost:3000/api/v1/upload \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_JWT_TOKEN" \
  -d '{
    "fileName": "child-photo.jpg",
    "file": "BASE64_ENCODED_FILE_CONTENT_HERE"
  }'

# Response:
# {
#   "fileName": "child-photo_1675343200000.jpg",
#   "url": "/uploads/child-photo_1675343200000.jpg",
#   "size": 125432,
#   "uploadedAt": "2026-02-02T14:30:00Z"
# }
```

---

## Using Postman/Insomnia for Testing

### 1. Import the API Collection

Create a new collection in Postman with environment variables:

```json
{
  "baseUrl": "http://localhost:3000",
  "token": "YOUR_JWT_TOKEN"
}
```

### 2. Set Up Auth Pre-request Script

In Postman, go to collection settings and add:

```javascript
// Get token from login response
if (pm.response && pm.response.code === 200) {
  var jsonData = pm.response.json();
  pm.environment.set("token", jsonData.token);
}
```

### 3. Use {{token}} in Headers

For each request, add:

```
Cookie: next-auth.session-token={{token}}
```

---

## Testing Real-Time Notifications (Socket.io)

### Using WebSocket Client

**Install wscat:**

```bash
npm install -g wscat
```

**Connect to Socket.io server:**

```bash
wscat -c "http://localhost:3000"
```

**Listen for activity log updates:**

```javascript
// Server emits to room: center:CENTER_ID
// Subscribe in your client:
socket.on("activity:logged", (activity) => {
  console.log("New activity:", activity);
});
```

**Listen for progress updates:**

```javascript
socket.on("progress:updated", (progress) => {
  console.log("Progress updated:", progress);
});
```

---

## Common Testing Scenarios

### Scenario 1: Complete Child Progress Tracking Flow

1. Create a center (Admin)
2. Create a classroom in that center (Teacher)
3. Create a child in that classroom (Teacher)
4. Create a lesson (Teacher)
5. Create a progress record for child→lesson (Teacher)
6. Log activities for the child (Teacher)
7. Update progress status to COMPLETED (Teacher)
8. **Verify:** Next goal auto-created with goalIndex=2

### Scenario 2: Role-Based Access Control

1. Login as TEACHER
2. Try to create a user → Should fail (403)
3. Try to create a child → Should succeed (201)
4. Try to delete a center → Should fail (403)
5. **Verify:** RBAC working correctly

### Scenario 3: Backdating Prevention

1. Login as TEACHER
2. Create an activity with createdAt > 1 minute ago → Should fail (403)
3. Login as ADMIN
4. Create activity with createdAt > 1 minute ago → Should succeed (201)
5. **Verify:** Backdating prevention working

---

## Troubleshooting

### "Unauthorized" Response (401)

- **Cause:** Missing or invalid JWT token
- **Fix:** Ensure token is in Cookie header as `next-auth.session-token=TOKEN`

### "Forbidden" Response (403)

- **Cause:** Insufficient permissions for role
- **Fix:** Check your user's role in the database (ADMIN vs TEACHER vs PARENT)

### Database Connection Error

```bash
# Check PostgreSQL is running:
psql -U postgres -d ameris -h localhost -p 5433 -c "SELECT 1"
```

### Prisma Studio Won't Open

```bash
npm run prisma:studio
# If stuck, try:
npx prisma studio
```

---

## Next Steps

- Test each endpoint with real IDs from your database
- Use Postman collections for organized testing
- Implement automated tests (Jest + Supertest) for CI/CD
- Monitor Socket.io events in real-time using browser dev tools
