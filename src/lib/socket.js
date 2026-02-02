const { Server } = require("socket.io");

let io = null;

function getIoInstance() {
  return io;
}

function initializeSocket(server) {
  if (!io) {
    io = new Server(server, {
      cors: {
        origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
        credentials: true,
      },
    });

    io.on("connection", (socket) => {
      console.log(`[Socket] User connected: ${socket.id}`);

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

module.exports = {
  getIoInstance,
  initializeSocket,
  emitActivityLog,
  emitProgressUpdate,
  emitParentNotification,
  emitComplianceAlert,
};
