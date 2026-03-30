const PREF_KEY = "ameris.browser_notifications.enabled";

export function supportsBrowserNotifications() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

export function getBrowserNotificationPreference() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PREF_KEY) === "true";
}

export function disableBrowserNotifications() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREF_KEY, "false");
}

export async function enableBrowserNotifications() {
  if (!supportsBrowserNotifications()) return { enabled: false, reason: "unsupported" };

  const permission = await window.Notification.requestPermission();
  if (permission !== "granted") {
    disableBrowserNotifications();
    return { enabled: false, reason: permission };
  }

  window.localStorage.setItem(PREF_KEY, "true");
  return { enabled: true, reason: "granted" };
}

export async function showBrowserNotification(notification) {
  if (!supportsBrowserNotifications()) return false;
  if (!getBrowserNotificationPreference()) return false;
  if (window.Notification.permission !== "granted") return false;
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    return false;
  }

  const registration = await navigator.serviceWorker.ready.catch(() => null);
  const title = notification?.title || "Ameris Academy";
  const options = {
    body: notification?.body || "",
    tag: notification?.id || `ameris-${Date.now()}`,
    data: {
      link: notification?.link || "/dashboard",
      notificationId: notification?.id || null,
    },
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
  };

  if (registration?.showNotification) {
    await registration.showNotification(title, options);
    return true;
  }

  const nativeNotification = new window.Notification(title, options);
  nativeNotification.onclick = () => {
    window.focus();
    if (notification?.link) {
      window.location.assign(notification.link);
    }
  };
  return true;
}
