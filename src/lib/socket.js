const { Server } = require("socket.io");

let io = null;

function getIoInstance() {
  return io;
}

function isAllowedSocketOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const requestHost = String(
      req.headers["x-forwarded-host"] || req.headers.host || "",
    ).toLowerCase();

    if (!requestHost) return true;
    return originUrl.host.toLowerCase() === requestHost;
  } catch {
    return false;
  }
}

function initializeSocket(server) {
  if (!io) {
    io = new Server(server, {
      cors: {
        origin: true,
        credentials: true,
      },
      allowRequest: (req, callback) => {
        callback(null, isAllowedSocketOrigin(req));
      },
    });

    io.on("connection", (socket) => {
      console.log(`[Socket] User connected: ${socket.id}`);

      // Join user-specific room for notifications/messages
      socket.on("join-user", (userId) => {
        socket.join(`user:${userId}`);
        console.log(`[Socket] ${socket.id} joined user:${userId}`);
      });

      // Join center room
      socket.on("join-center", (centerId) => {
        socket.join(`center:${centerId}`);
        console.log(`[Socket] ${socket.id} joined center:${centerId}`);
      });

      // Leave center room
      socket.on("leave-center", (centerId) => {
        socket.leave(`center:${centerId}`);
        console.log(`[Socket] ${socket.id} left center:${centerId}`);
      });

      // Disconnect
      socket.on("disconnect", () => {
        console.log(`[Socket] User disconnected: ${socket.id}`);
      });
    });
  }
  return io;
}

/**
 * Emit activity log to all users in a center
 */
function emitActivityLog(centerId, activity) {
  if (io) {
    io.to(`center:${centerId}`).emit("activity:logged", {
      type: "ACTIVITY_LOGGED",
      data: activity,
      timestamp: new Date(),
    });
  }
}

/**
 * Emit progress update to center
 */
function emitProgressUpdate(centerId, progress) {
  if (io) {
    io.to(`center:${centerId}`).emit("progress:updated", {
      type: "PROGRESS_UPDATED",
      data: progress,
      timestamp: new Date(),
    });
  }
}

/**
 * Emit notification to parents of a child
 */
function emitParentNotification(parentId, notification) {
  if (io) {
    io.to(`parent:${parentId}`).emit("notification", {
      type: "NOTIFICATION",
      data: notification,
      timestamp: new Date(),
    });
  }
}

/**
 * Emit compliance alert (missed logs, etc.)
 */
function emitComplianceAlert(centerId, alert) {
  if (io) {
    io.to(`center:${centerId}`).emit("compliance:alert", {
      type: "COMPLIANCE_ALERT",
      data: alert,
      timestamp: new Date(),
    });
  }
}

/**
 * Emit new message to all participants in a thread
 */
function emitNewMessage(participantUserIds, message) {
  if (io) {
    for (const uid of participantUserIds) {
      io.to(`user:${uid}`).emit("message:new", {
        type: "MESSAGE_NEW",
        data: message,
        timestamp: new Date(),
      });
    }
  }
}

/**
 * Emit notification to a specific user
 */
function emitNotification(userId, notification) {
  if (io) {
    io.to(`user:${userId}`).emit("notification:new", {
      type: "NOTIFICATION_NEW",
      data: notification,
      timestamp: new Date(),
    });
  }
}

module.exports = {
  getIoInstance,
  initializeSocket,
  emitActivityLog,
  emitProgressUpdate,
  emitParentNotification,
  emitComplianceAlert,
  emitNewMessage,
  emitNotification,
};
