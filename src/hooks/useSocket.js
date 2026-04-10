import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

export function useSocket(centerId) {
  const socketRef = useRef(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!centerId) return;

    // Initialize socket connection
    socketRef.current = io("/", {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current.on("connect", () => {
      console.log("[Socket] Connected, joining center:", centerId);
      socketRef.current.emit("join-center", centerId);
      connectedRef.current = true;
    });

    socketRef.current.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      connectedRef.current = false;
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave-center", centerId);
        socketRef.current.disconnect();
      }
    };
  }, [centerId]);

  return socketRef.current;
}

/**
 * Hook to join user-specific room for notifications and messages.
 * Uses useState so consumers re-render when the socket is ready.
 */
export function useUserSocket(userId) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!userId) return;

    const s = io("/", {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    s.on("connect", () => {
      s.emit("join-user", userId);
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [userId]);

  return socket;
}

/**
 * Hook to listen for activity logs
 */
export function useActivityLogs(callback) {
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io("/");

    socketRef.current.on("activity:logged", (message) => {
      if (callback) callback(message.data);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [callback]);
}

/**
 * Hook to listen for progress updates
 */
export function useProgressUpdates(centerId, callback) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!centerId) return;

    socketRef.current = io("/");

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-center", centerId);
    });

    socketRef.current.on("progress:updated", (message) => {
      if (callback) callback(message.data);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave-center", centerId);
        socketRef.current.disconnect();
      }
    };
  }, [centerId, callback]);
}

/**
 * Hook to listen for new notifications (real-time)
 */
export function useNotifications(socket, callback) {
  useEffect(() => {
    if (!socket) return;
    const handler = (message) => {
      if (callback) callback(message.data);
    };
    socket.on("notification:new", handler);
    return () => socket.off("notification:new", handler);
  }, [socket, callback]);
}

/**
 * Hook to listen for new messages (real-time)
 */
export function useNewMessages(socket, callback) {
  useEffect(() => {
    if (!socket) return;
    const handler = (message) => {
      if (callback) callback(message.data);
    };
    socket.on("message:new", handler);
    return () => socket.off("message:new", handler);
  }, [socket, callback]);
}
