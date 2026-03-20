# Ameris Child Academy — Backend (Next.js + Prisma)

This repository contains the backend scaffold for the Ameris Child Academy platform.

Quick start (local):

1. Create a PostgreSQL database and set `DATABASE_URL` in your `.env` file.

2. Install dependencies:

```bash
npm install
```

3. Generate Prisma client and run migrations:

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
```

4. Run Next.js in development:

```bash
npm run dev
```

The custom server binds to `0.0.0.0` by default, so other devices on the same network can open the app at `http://<this-device-ip>:3000`. If Windows Firewall prompts for Node.js access, allow it on your private network.

For local/LAN clones, leave `NEXTAUTH_URL` unset and keep `AUTH_TRUST_HOST=true` so authentication uses the current machine's host automatically. Only set `NEXTAUTH_URL` / `NEXT_PUBLIC_SITE_URL` when you want one fixed public URL or domain.

## What's Included

### Core Files

- `package.json` — scripts and dependencies
- `prisma/schema.prisma` — data models with enums (ActivityType, ProgressStatus)
- `prisma/seed.js` — demo data (Demo Center + admin@demo.com)
- `.env` — database and auth config
- `server.js` — custom HTTP server with Socket.io integration

### Authentication

- `src/pages/api/auth/[...nextauth].js` — NextAuth credentials provider
- `src/lib/auth.js` — session & RBAC helpers

### API Endpoints with RBAC

- `GET /api/health` — health check (no auth required)

**Users**

- `GET /api/users` — list all (ADMIN only)
- `POST /api/users` — create user (ADMIN only)
- `GET /api/users/:id` — get user (own profile or ADMIN)
- `PUT /api/users/:id` — update (own or ADMIN)
- `DELETE /api/users/:id` — delete (ADMIN only)

**Centers**

- `GET /api/centers` — list (filtered by user's centers)
- `POST /api/centers` — create (ADMIN only)
- `GET /api/centers/:id` — get details (must have access)
- `PUT /api/centers/:id` — update (ADMIN only)
- `DELETE /api/centers/:id` — delete (ADMIN only)

**Children**

- `GET /api/children` — list (filtered by role)
- `POST /api/children` — create (ADMIN, TEACHER)
- `GET /api/children/:id` — get details (parent sees only own child)
- `PUT /api/children/:id` — update (ADMIN, TEACHER)
- `DELETE /api/children/:id` — delete (ADMIN only)

**Classes**

- `GET /api/classes` — list (by centerId query param)
- `POST /api/classes` — create (ADMIN, TEACHER)
- `GET /api/classes/:id` — get details
- `PUT /api/classes/:id` — update (ADMIN, TEACHER)
- `DELETE /api/classes/:id` — delete (ADMIN only)

**Lessons**

- `GET /api/lessons` — list (ADMIN, TEACHER, COACH)
- `POST /api/lessons` — create (ADMIN, TEACHER)
- `GET /api/lessons/:id` — get details
- `PUT /api/lessons/:id` — update (ADMIN, TEACHER)
- `DELETE /api/lessons/:id` — delete (ADMIN only)

**Activity Logging** (NEW)

- `GET /api/activities` — list logs (filtered by childId & type)
- `POST /api/activities` — create log (TEACHER, ADMIN; no backdating for teachers)
- `GET /api/activities/:id` — get log
- `DELETE /api/activities/:id` — delete log (ADMIN only)

**Progress Tracking** (NEW)

- `GET /api/progress` — list progress (by childId)
- `POST /api/progress` — create progress record (ADMIN, TEACHER)
- `GET /api/progress/:id` — get progress details
- `PUT /api/progress/:id` — update (auto-progression on PASSED/COMPLETED)
- `DELETE /api/progress/:id` — delete (ADMIN only)

**File Upload** (NEW)

- `POST /api/upload` — upload media/documents (base64; max 50MB)
  - Response: `{ fileName, url, size, uploadedAt }`
  - Files stored in `public/uploads/`

### Real-Time Updates (Socket.io) (NEW)

- `join-center` — join room for center updates
- `leave-center` — leave room
- `activity:logged` — activity log events
- `progress:updated` — progress update events
- `compliance:alert` — missed compliance alerts

**Client hooks** in `src/hooks/useSocket.js`:

- `useSocket(centerId)` — connect to center room
- `useActivityLogs(callback)` — listen for new activities
- `useProgressUpdates(callback)` — listen for progress changes

See [API.md](API.md) for full endpoint details.

## Demo Credentials

```
Email: admin@demo.com
Password: adminpass
```

## Documentation

- [API.md](API.md) — Full endpoint reference with request/response examples
- [FEATURES_COMPLETED.md](FEATURES_COMPLETED.md) — Implementation details for all features
- [TESTING.md](TESTING.md) — Testing commands and client examples

## Completed Features

✅ **Activity Logging** — Track daily activities (diaper changes, meals, naps, etc.)  
✅ **Progress Tracking** — Goal-based progression with auto-advancement  
✅ **File Upload** — Media upload to `public/uploads/`  
✅ **Real-Time Updates** — Socket.io for live activity/progress notifications  
✅ **Role-Based Access Control** — ADMIN, TEACHER, COACH, PARENT, SUBSCRIBER  
✅ **Multi-Center Support** — One instance serves multiple childcare centers

## Next Steps

1. **Build Frontend** — React/Next.js dashboard, React Native apps
2. **Implement Task Checklists** — Daily task templates with policy links
3. **Add Behavior Plans** — Customizable behavior tracking and correction lessons
4. **Reporting & Analytics** — Progress reports, behavior trends, teacher performance
5. **Subscription Management** — Tiered feature access for external daycares
6. **Email/SMS Notifications** — Send alerts to parents and staff
7. **Tests** — Jest/Vitest test suite
8. **Deployment** — Docker, Vercel, AWS, or Azure
