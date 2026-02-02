# Quick Start: Testing the Backend

## Prerequisites

1. **Database Running:**

   ```bash
   # Ensure PostgreSQL is running on localhost:5433
   # Database: ameris
   # User: postgres
   # Password: postgres
   ```

2. **Environment:**

   ```bash
   # .env file already configured
   # DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ameris
   ```

3. **Dependencies Installed:**
   ```bash
   npm install
   ```

## Running the Server

```bash
npm run dev
```

This starts the custom Node.js HTTP server with Socket.io on `http://localhost:3000`

## Testing the API

### 1. Health Check (No Auth Required)

```bash
curl http://localhost:3000/api/health
```

**Response:**

```json
{
  "status": "ok",
  "time": "2026-02-02T12:34:56.789Z"
}
```

### 2. Create Demo Data (Optional)

The database already has demo data from the seed:

- **Center:** Demo Center
- **Admin User:** admin@demo.com / adminpass

To add more seed data:

```bash
npm run prisma:seed
```

### 3. Activity Logging

**Create an Activity Log:**

```bash
curl -X POST http://localhost:3000/api/activities \
  -H "Content-Type: application/json" \
  -d '{
    "childId": "CHILD_UUID_HERE",
    "type": "DIAPER_CHANGE",
    "details": {"condition": "wet"},
    "notes": "Diaper changed at 2pm"
  }'
```

Replace `CHILD_UUID_HERE` with an actual child ID from your database.

**Get Activities for a Child:**

```bash
curl http://localhost:3000/api/activities?childId=CHILD_UUID_HERE
```

**Get All Activities of a Type:**

```bash
curl http://localhost:3000/api/activities?type=MEAL
```

### 4. Progress Tracking

**Create Progress Record:**

```bash
curl -X POST http://localhost:3000/api/progress \
  -H "Content-Type: application/json" \
  -d '{
    "childId": "CHILD_UUID_HERE",
    "lessonId": "LESSON_UUID_HERE",
    "status": "IN_PROGRESS"
  }'
```

**Get Progress for a Child:**

```bash
curl http://localhost:3000/api/progress?childId=CHILD_UUID_HERE
```

**Update Progress (Triggers Auto-Progression):**

```bash
curl -X PUT http://localhost:3000/api/progress/PROGRESS_UUID_HERE \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PASSED",
    "achievedAt": "2026-02-02T12:00:00Z"
  }'
```

This will automatically create the next goal (goalIndex + 1) if it doesn't exist.

### 5. File Upload

**Upload a File:**

```bash
# First, create a base64-encoded file (example with a text file)
echo "This is a test file" | base64

# Then POST to upload
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "file": "VGhpcyBpcyBhIHRlc3QgZmlsZQo=",
    "fileName": "test.txt"
  }'
```

**Response:**

```json
{
  "fileName": "test_1675123456789.txt",
  "url": "/uploads/test_1675123456789.txt",
  "size": 19,
  "uploadedAt": "2026-02-02T12:34:56.789Z"
}
```

## Real-Time Updates with Socket.io

### Client Example (JavaScript)

```javascript
import io from "socket.io-client";

// Connect to socket server
const socket = io("http://localhost:3000");

// Join a center room
socket.emit("join-center", "DEMO_CENTER_UUID");

// Listen for activity logs
socket.on("activity:logged", (message) => {
  console.log("New activity:", message);
  // {
  //   "type": "ACTIVITY_LOGGED",
  //   "data": { activity object },
  //   "timestamp": "2026-02-02T12:34:56.789Z"
  // }
});

// Listen for progress updates
socket.on("progress:updated", (message) => {
  console.log("Progress updated:", message);
  // {
  //   "type": "PROGRESS_UPDATED",
  //   "data": { progress object },
  //   "timestamp": "2026-02-02T12:34:56.789Z"
  // }
});

// When done, leave and disconnect
socket.emit("leave-center", "DEMO_CENTER_UUID");
socket.disconnect();
```

### React Hook Example

```javascript
import {
  useSocket,
  useActivityLogs,
  useProgressUpdates,
} from "@/hooks/useSocket";

export default function Dashboard() {
  const centerId = "DEMO_CENTER_UUID";
  const socket = useSocket(centerId);

  const handleActivityLogged = (activity) => {
    console.log("Activity logged:", activity);
  };

  const handleProgressUpdated = (progress) => {
    console.log("Progress updated:", progress);
  };

  useActivityLogs(handleActivityLogged);
  useProgressUpdates(handleProgressUpdated);

  return (
    <div>
      <h1>Live Updates Enabled</h1>
      <p>Open browser console to see real-time events</p>
    </div>
  );
}
```

## Finding UUIDs in Database

Use Prisma Studio to browse and copy UUIDs:

```bash
npx prisma studio
```

This opens a GUI at `http://localhost:5555` where you can:

- View all records in tables
- Copy UUIDs
- Create test data
- Edit/delete records

## Common Issues

### Issue: Cannot connect to database

**Solution:**

- Ensure PostgreSQL is running on localhost:5433
- Check DATABASE_URL in .env
- Run migrations: `npx prisma migrate dev`

### Issue: "Module not found" errors

**Solution:**

- Clear .next cache: `rm -r .next`
- Reinstall: `npm install`
- Regenerate Prisma: `npx prisma generate`

### Issue: Socket.io not connecting

**Solution:**

- Ensure server is running: `npm run dev`
- Check browser console for connection errors
- Verify `NEXTAUTH_URL` in .env matches client origin

### Issue: File uploads not working

**Solution:**

- Ensure `public/uploads/` directory exists
- Check file size (max 50MB)
- Verify base64 encoding is valid

## Next: Build Frontend

Once backend is stable, you can build:

1. **Next.js Frontend** (React SSR)
2. **React Native Apps** (iOS/Android)
3. **Admin Dashboard**
4. **Parent Mobile App**
5. **Teacher Portal**

All will connect to this backend API with Socket.io for real-time updates!
