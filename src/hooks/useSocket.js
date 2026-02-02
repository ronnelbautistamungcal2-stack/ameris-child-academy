import { useEffect, useRef } from "react";
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
export function useProgressUpdates(callback) {
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io("/");

    socketRef.current.on("progress:updated", (message) => {
      if (callback) callback(message.data);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [callback]);
}
