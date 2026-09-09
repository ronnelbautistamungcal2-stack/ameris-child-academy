/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

const nextConfig = {
  reactStrictMode: true,
  distDir: isDev ? ".next-dev" : ".next-build",
  outputFileTracing: false,
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },

  async redirects() {
    return [
      // Retired parent pages: notification settings moved into Account Settings and
      // permissions moved into a tab on Forms & Renewals.
      {
        source: "/parent/notification-settings",
        destination: "/settings",
        permanent: false,
      },
      {
        source: "/parent/permissions",
        destination: "/parent/forms",
        permanent: false,
      },
      // Admin pages that moved to the coach section during the navigation
      // rework. Kept so existing links, bookmarks, and notification
      // deep-links keep working.
      { source: "/admin/teachers", destination: "/coach/teachers", permanent: false },
      {
        source: "/admin/teachers/:id",
        destination: "/coach/teachers/:id",
        permanent: false,
      },
      {
        source: "/admin/staff-management",
        destination: "/coach/staff-management",
        permanent: false,
      },
      {
        source: "/admin/classes",
        destination: "/coach/classes",
        permanent: false,
      },
      {
        source: "/admin/progress",
        destination: "/coach/progress",
        permanent: false,
      },
      {
        source: "/admin/activity-overrides",
        destination: "/coach/activity-overrides",
        permanent: false,
      },
      {
        source: "/admin/supply-lists",
        destination: "/coach/supply-lists",
        permanent: false,
      },
      {
        source: "/admin/shifts",
        destination: "/coach/shifts",
        permanent: false,
      },
      {
        source: "/admin/permission-policies",
        destination: "/coach/permission-policies",
        permanent: false,
      },
      {
        source: "/admin/feeding-plans-report",
        destination: "/coach/feeding-plans-report",
        permanent: false,
      },
      {
        source: "/admin/carpool-report",
        destination: "/coach/carpool-report",
        permanent: false,
      },
      // The combined teacher Reports page split into separate student and class
      // reports. Send stale links to the student report, which carries most of
      // what the old page showed.
      {
        source: "/teacher/reports",
        destination: "/teacher/student-performance-report",
        permanent: false,
      },
      // Progress Archive was retired; send stale links to Data Archive.
      {
        source: "/admin/progress-archive",
        destination: "/admin/data-archive",
        permanent: false,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(self), payment=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
