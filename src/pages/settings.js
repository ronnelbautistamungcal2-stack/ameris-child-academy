import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") return <p>Loading...</p>;

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      {/* Header */}
      <header
        style={{
          background: "white",
          borderBottom: "1px solid #e5e7eb",
          padding: "1rem",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 24 }}>Ameris Child Academy</h1>
          <Link
            href="/dashboard"
            style={{ color: "#2563eb", textDecoration: "none" }}
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 20px" }}>
        <div
          style={{
            background: "white",
            padding: 24,
            borderRadius: 8,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <h2>Account Settings</h2>

          <div style={{ marginTop: "2rem" }}>
            <h3>Profile Information</h3>
            <div
              style={{
                background: "#f9fafb",
                padding: 16,
                borderRadius: 4,
                marginTop: 12,
              }}
            >
              <p>
                <strong>Name:</strong> {session?.user?.name || "Not set"}
              </p>
              <p>
                <strong>Email:</strong> {session?.user?.email}
              </p>
              <p>
                <strong>Role:</strong> {session?.user?.role}
              </p>
              <p>
                <strong>User ID:</strong>{" "}
                <code
                  style={{
                    background: "#f0f0f0",
                    padding: "2px 6px",
                    borderRadius: 2,
                  }}
                >
                  {session?.user?.id}
                </code>
              </p>
            </div>
          </div>

          <div
            style={{
              marginTop: "2rem",
              paddingTop: "2rem",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <h3 style={{ color: "#dc2626" }}>Danger Zone</h3>
            <button
              style={{
                padding: "8px 16px",
                background: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Delete Account
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
