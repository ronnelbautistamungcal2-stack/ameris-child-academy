# API Reference

This document outlines the REST API endpoints and their role-based access controls.

## Authentication

All endpoints (except `GET /api/health`) require a valid session or JWT token. Use `/api/auth/signin` to authenticate.

### Login

```
POST /api/auth/signin
Content-Type: application/json

{
  "email": "admin@demo.com",
  "password": "adminpass"
}
```

## Role-Based Access Control

- **ADMIN**: Full access to all endpoints.
- **TEACHER**: Can manage children, classes, and lessons in assigned centers.
- **COACH**: Can monitor and view children, lessons, and progress.
- **PARENT**: Can view only their own children and receive notifications.
- **SUBSCRIBER**: Access depends on subscription tier (not fully implemented yet).

## Endpoints

### Users

#### List all users

```
GET /api/users
Authorization: Required (ADMIN only)

Response: User[]
```

#### Get user by ID

```
GET /api/users/:id
Authorization: Required (own profile or ADMIN)

Response: User
```

#### Create user

```
POST /api/users
Authorization: Required (ADMIN only)
Content-Type: application/json

{
  "email": "teacher@example.com",
  "name": "John Teacher",
  "password": "securepass",
  "role": "TEACHER",
  "centerId": "center-uuid"
}

Response: User (201 Created)
```

#### Update user

```
PUT /api/users/:id
Authorization: Required (own profile or ADMIN)
Content-Type: application/json

{
  "name": "Updated Name",
  "role": "TEACHER"  // admin only
}

Response: User
```

#### Delete user

```
DELETE /api/users/:id
Authorization: Required (ADMIN only)

Response: 204 No Content
```

### Centers

#### List centers

```
GET /api/centers
Authorization: Required
Response: Center[] (filtered by user's centers if not ADMIN)
```

#### Get center by ID

```
GET /api/centers/:id
Authorization: Required (must have access)

Response: Center
```

#### Create center

```
POST /api/centers
Authorization: Required (ADMIN only)
Content-Type: application/json

{
  "name": "New Center",
  "address": "123 Main St"
}

Response: Center (201 Created)
```

#### Update center

```
PUT /api/centers/:id
Authorization: Required (ADMIN only)
Content-Type: application/json

{
  "name": "Updated Center Name",
  "address": "456 Oak Ave"
}

Response: Center
```

#### Delete center

```
DELETE /api/centers/:id
Authorization: Required (ADMIN only)

Response: 204 No Content
```

### Children

#### List children

```
GET /api/children?centerId=:centerId
Authorization: Required
Response: Child[] (parents see only their own children)
```

#### Get child by ID

```
GET /api/children/:id
Authorization: Required (parents must be owner)

Response: Child
```

#### Create child

```
POST /api/children
Authorization: Required (ADMIN, TEACHER)
Content-Type: application/json

{
  "firstName": "Emma",
  "lastName": "Smith",
  "birthDate": "2020-01-15",
  "centerId": "center-uuid",
  "classRoomId": "class-uuid",
  "parentId": "user-uuid"
}

Response: Child (201 Created)
```

#### Update child

```
PUT /api/children/:id
Authorization: Required (ADMIN, TEACHER)
Content-Type: application/json

{
  "firstName": "Emma",
  "lastName": "Johnson",
  "classRoomId": "new-class-uuid"
}

Response: Child
```

#### Delete child

```
DELETE /api/children/:id
Authorization: Required (ADMIN only)

Response: 204 No Content
```

### Classes

#### List classes

```
GET /api/classes?centerId=:centerId
Authorization: Required

Response: ClassRoom[]
```

#### Get class by ID

```
GET /api/classes/:id
Authorization: Required

Response: ClassRoom
```

#### Create class

```
POST /api/classes
Authorization: Required (ADMIN, TEACHER)
Content-Type: application/json

{
  "name": "Toddlers A",
  "centerId": "center-uuid"
}

Response: ClassRoom (201 Created)
```

#### Update class

```
PUT /api/classes/:id
Authorization: Required (ADMIN, TEACHER)
Content-Type: application/json

{
  "name": "Updated Class Name"
}

Response: ClassRoom
```

#### Delete class

```
DELETE /api/classes/:id
Authorization: Required (ADMIN only)

Response: 204 No Content
```

### Lessons

#### List lessons

```
GET /api/lessons?centerId=:centerId
Authorization: Required (ADMIN, TEACHER, COACH)

Response: Lesson[]
```

#### Get lesson by ID

```
GET /api/lessons/:id
Authorization: Required (ADMIN, TEACHER, COACH)

Response: Lesson
```

#### Create lesson

```
POST /api/lessons
Authorization: Required (ADMIN, TEACHER)
Content-Type: application/json

{
  "title": "Alphabet Learning",
  "description": "Learn ABC",
  "centerId": "center-uuid",
  "media": ["https://example.com/video.mp4"]
}

Response: Lesson (201 Created)
```

#### Update lesson

```
PUT /api/lessons/:id
Authorization: Required (ADMIN, TEACHER)
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description",
  "media": ["https://example.com/new-video.mp4"]
}

Response: Lesson
```

#### Delete lesson

```
DELETE /api/lessons/:id
Authorization: Required (ADMIN only)

Response: 204 No Content
```

### Health Check

#### Server status

```
GET /api/health

Response: {
  "status": "ok",
  "time": "2026-02-02T12:00:00.000Z"
}
```

### Activities

#### List activities

```
GET /api/activities?childId=:childId&type=DIAPER_CHANGE
Authorization: Required (ADMIN, TEACHER, COACH see all in center; PARENT sees own child)

Response: ActivityLog[]
```

Valid activity types:

- `DIAPER_CHANGE`
- `NAP`
- `BOTTLE`
- `MEAL`
- `SNACK`
- `ACTIVITY`
- `TASK_CHECKLIST`
- `BEHAVIOR`
- `OTHER`

#### Get activity by ID

```
GET /api/activities/:id
Authorization: Required

Response: ActivityLog
```

#### Create activity log

```
POST /api/activities
Authorization: Required (TEACHER, ADMIN)
Content-Type: application/json

{
  "childId": "child-uuid",
  "type": "DIAPER_CHANGE",
  "details": { "notes": "wet diaper" },
  "notes": "Extra notes",
  "createdAt": "2026-02-02T12:00:00Z"  // optional; only ADMIN can backdate
}

Response: ActivityLog (201 Created)
```

#### Delete activity

```
DELETE /api/activities/:id
Authorization: Required (ADMIN only)

Response: 204 No Content
```

### Progress

#### List progress records

```
GET /api/progress?childId=:childId
Authorization: Required (ADMIN, TEACHER, COACH; PARENT sees own child)

Response: Progress[]
```

#### Get progress by ID

```
GET /api/progress/:id
Authorization: Required

Response: Progress
```

#### Create progress

```
POST /api/progress
Authorization: Required (ADMIN, TEACHER)
Content-Type: application/json

{
  "childId": "child-uuid",
  "lessonId": "lesson-uuid",
  "status": "NOT_STARTED",
  "goalIndex": 1
}

Response: Progress (201 Created)
```

#### Update progress (with auto-progression)

```
PUT /api/progress/:id
Authorization: Required (ADMIN, TEACHER)
Content-Type: application/json

{
  "status": "PASSED",
  "achievedAt": "2026-02-02T12:00:00Z"
}

Response: Progress

Notes:
- Valid statuses: NOT_STARTED, IN_PROGRESS, COMPLETED, PASSED, FAILED
- When status = PASSED or COMPLETED, next goal (goalIndex + 1) auto-created
- Auto-progression prevents duplicates with unique constraint [childId, lessonId, goalIndex]
```

#### Delete progress

```
DELETE /api/progress/:id
Authorization: Required (ADMIN only)

Response: 204 No Content
```

### File Upload

#### Upload file

```
POST /api/upload
Authorization: Required (ADMIN, TEACHER)
Content-Type: application/json

{
  "file": "base64-encoded-file-content",
  "fileName": "document.pdf"
}

Response: {
  "fileName": "document_1675000000000.pdf",
  "url": "/uploads/document_1675000000000.pdf",
  "size": 12345,
  "uploadedAt": "2026-02-02T12:00:00.000Z"
}

Notes:
- Max file size: 50MB
- Files stored in public/uploads/
- Unique timestamp added to filename to prevent collisions
```

### Real-Time Updates (Socket.io)

Connect to socket server at `/` and join center room:

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:3000");
socket.emit("join-center", "center-uuid");

// Listen for activity logs
socket.on("activity:logged", (message) => {
  console.log("New activity:", message.data);
});

// Listen for progress updates
socket.on("progress:updated", (message) => {
  console.log("Progress updated:", message.data);
});

// Listen for compliance alerts
socket.on("compliance:alert", (message) => {
  console.log("Compliance alert:", message.data);
});

// On cleanup
socket.emit("leave-center", "center-uuid");
socket.disconnect();
```

Message format:

```json
{
  "type": "ACTIVITY_LOGGED",
  "data": {
    /* activity object */
  },
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

All errors follow this format:

```json
{
  "error": "Error message"
}
```

Common status codes:

- `200` - OK
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized (missing session)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `405` - Method Not Allowed
- `409` - Conflict (e.g., duplicate email)
