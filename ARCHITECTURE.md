# Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js / React)                  │
│  (Dashboard, Mobile App, Parent Portal, Teacher Portal)          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                  ┌────────▼────────┐
                  │   NEXT.JS API   │
                  │  (Port 3000)    │
                  └────────┬────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐       ┌────▼─────┐    ┌─────▼──┐
    │ REST    │       │ Socket.io │    │ File   │
    │ Routes  │       │ Server    │    │ Upload │
    │ (18)    │       │ (Real-    │    │ (50MB) │
    │         │       │  time)    │    │        │
    └────┬────┘       └────┬──────┘    └──┬─────┘
         │                 │              │
         └─────────────────┼──────────────┘
                           │
                   ┌───────▼────────┐
                   │   Prisma ORM   │
                   │   (Query)      │
                   └───────┬────────┘
                           │
            ┌──────────────▼──────────────┐
            │     PostgreSQL DB           │
            │  (11 core + 5 new models)   │
            └─────────────────────────────┘
```

## Data Models Relationship

```
Center (1) ─────────────── (many) CenterUser
  │                           │
  ├─ User (admin)             └─ User (by role)
  ├─ ClassRoom (many)
  ├─ Child (many)         User ─────────── (1) Child (parent)
  ├─ Lesson (many)            │
  ├─ TaskChecklist (many)      ├─ AuthSession
  └─ Subscription              ├─ TeacherClass ─── ClassRoom
                               └─ RecordedActivity ─── ActivityLog

Child ────────── (many) Progress ─┐
  │                               ├─ Lesson
  ├─ ClassRoom                    │
  ├─ ActivityLog (recorded by User)
  └─ ChildTask ─── Task ─── TaskChecklist
```

## Request Flow

### Activity Logging Flow

```
Teacher/Admin POST /api/activities
    ↓
[getSession] validate auth
    ↓
[RBAC] check TEACHER or ADMIN role
    ↓
[Validation] prevent backdating (unless ADMIN)
    ↓
[Prisma] create ActivityLog with recordedById
    ↓
[Socket.io] emitActivityLog(centerId)
    ↓
[Broadcast] emit to center:CENTERID room
    ↓
Response: { id, childId, type, details, recordedBy, createdAt }
```

### Progress Auto-Progression Flow

```
Teacher/Admin PUT /api/progress/:id with status=PASSED
    ↓
[getSession] validate auth
    ↓
[Prisma] update progress.status = PASSED
    ↓
[Socket.io] emitProgressUpdate(centerId)
    ↓
[Auto-Check] if PASSED or COMPLETED:
   └─ Find if Goal N+1 exists
      └─ If not, create Progress { goalIndex: N+1, status: NOT_STARTED }
    ↓
[Broadcast] emit to center:CENTERID room
    ↓
Response: updated progress with next goal created
```

### File Upload Flow

```
Teacher/Admin POST /api/upload with base64 file
    ↓
[getSession] validate auth
    ↓
[RBAC] check TEACHER or ADMIN role
    ↓
[Decode] base64 → Buffer
    ↓
[Generate] unique filename: original_TIMESTAMP.ext
    ↓
[Write] to public/uploads/
    ↓
Response: { fileName, url: /uploads/..., size, uploadedAt }
```

### Real-Time Update Flow

```
Server creates ActivityLog → [Socket.io] emitActivityLog()
                                ↓
                        Find all connected clients
                                ↓
                        In room "center:CENTERID"
                                ↓
                   Broadcast event with activity data
                                ↓
Client receives 'activity:logged' event in real-time
                                ↓
React component updates with useActivityLogs() hook
```

## RBAC Matrix

```
Endpoint                 ADMIN  TEACHER  COACH  PARENT  SUBSCRIBER
─────────────────────────────────────────────────────────────────
GET /users                 ✓      ✗       ✗      ✗         ✗
POST /users                ✓      ✗       ✗      ✗         ✗
GET /centers               ✓      ✓†      ✓†     ✗         ✓†
POST /centers              ✓      ✗       ✗      ✗         ✗
GET /children              ✓      ✓       ✓      ✓◆        ✓†
POST /children             ✓      ✓       ✗      ✗         ✗
GET /activities            ✓      ✓       ✓      ✓◆        ✓†
POST /activities           ✓      ✓       ✗      ✗         ✗
GET /progress              ✓      ✓       ✓      ✓◆        ✓†
POST /progress             ✓      ✓       ✗      ✗         ✗
PUT /progress/:id          ✓      ✓       ✗      ✗         ✗
POST /upload               ✓      ✓       ✗      ✗         ✗
GET /lessons               ✓      ✓       ✓      ✗         ✓†
POST /lessons              ✓      ✓       ✗      ✗         ✗

Legend:
✓  = Full access
✗  = No access
†  = Only assigned centers
◆  = Only own child
```

## Authentication Flow

```
[Browser]
    │
    ├─ POST /api/auth/signin { email, password }
    │       ↓
    ├─ [NextAuth] validate credentials with bcrypt
    │       ↓
    ├─ Create JWT token { id, role, email }
    │       ↓
    ├─ Set secure session cookie
    │       ↓
[Client Session Store]
    │
    └─ All API requests include session
        ├─ Header: Cookie: next-auth.session-token=...
        └─ [getSession] retrieves user data from JWT
```

## Deployment Architecture (Recommended)

```
┌──────────────────────────────────────────────────────┐
│  CDN / Load Balancer (Cloudflare, AWS ALB)          │
└──────────────────────────────────────────────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
┌───▼──┐  ┌───▼──┐  ┌───▼──┐
│ App  │  │ App  │  │ App  │
│ i=1  │  │ i=2  │  │ i=3  │
└───┬──┘  └───┬──┘  └───┬──┘
    │         │         │
    │ Share: Database + Redis (for Socket.io)
    │         │
    └─────────┼─────────┘
              │
    ┌─────────▼──────────┐
    │ PostgreSQL (RDS)   │
    └────────────────────┘
              │
    ┌─────────▼──────────┐
    │ Redis (for Pub/Sub)│
    │ (Socket.io adapter)│
    └────────────────────┘
```

## Technology Stack

| Layer            | Technology         | Purpose            |
| ---------------- | ------------------ | ------------------ |
| **Frontend**     | React/Next.js      | Web & SSR          |
| **Mobile**       | React Native       | iOS/Android apps   |
| **Backend**      | Next.js API Routes | REST endpoints     |
| **Real-Time**    | Socket.io          | Live updates       |
| **Database**     | PostgreSQL         | Data persistence   |
| **ORM**          | Prisma             | Type-safe queries  |
| **Auth**         | NextAuth + JWT     | Session management |
| **File Storage** | Local/S3           | Media uploads      |
| **Deployment**   | Vercel/AWS/Docker  | Hosting            |

## Performance Considerations

- **Database indexes** on `childId`, `centerId`, `userId`
- **Socket.io rooms** reduce broadcast scope (center-specific)
- **Pagination** (optional) for list endpoints
- **Caching** (optional) for static lesson content
- **File compression** for uploads
- **CDN** for public uploads

---

**This architecture supports:**

- ✅ Multi-center scaling
- ✅ Real-time collaboration
- ✅ RBAC & data isolation
- ✅ Audit logging
- ✅ Horizontal scaling
- ✅ Load balancing
- ✅ Disaster recovery
