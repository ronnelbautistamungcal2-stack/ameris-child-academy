import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import Link from "next/link";

export default function Dashboard() {
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
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <span style={{ color: "#666" }}>
              {session?.user?.name || session?.user?.email}
              <br />
              <small style={{ color: "#999" }}>
                Role: {session?.user?.role}
              </small>
            </span>
            <button
              onClick={() => signOut({ redirect: "/login" })}
              style={{
                padding: "8px 16px",
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 1200, margin: "2rem auto", padding: "0 20px" }}>
        <div
          style={{
            background: "white",
            padding: 24,
            borderRadius: 8,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <h2>Welcome, {session?.user?.name || "User"}!</h2>
          <p style={{ color: "#666", marginBottom: "2rem" }}>
            You are logged in as <strong>{session?.user?.email}</strong> with
            role <strong>{session?.user?.role}</strong>
          </p>

          {/* Navigation Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginTop: "2rem",
            }}
          >
            <NavCard
              title="Activities"
              description="Log and view child activities"
              href="/activities"
              icon="📋"
            />
            <NavCard
              title="Children"
              description="Manage enrolled children"
              href="/children"
              icon="👶"
            />
            <NavCard
              title="Progress"
              description="Track learning progress"
              href="/progress"
              icon="📈"
            />
            <NavCard
              title="Settings"
              description="Account and preferences"
              href="/settings"
              icon="⚙️"
            />
          </div>

          {/* Session Info */}
          <div
            style={{
              marginTop: "3rem",
              padding: "1rem",
              background: "#f0f9ff",
              borderRadius: 4,
              borderLeft: "4px solid #2563eb",
            }}
          >
            <p style={{ margin: 0, fontSize: 14, color: "#0369a1" }}>
              <strong>Session Token:</strong>{" "}
              {session?.user?.id?.substring(0, 12)}...
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavCard({ title, description, href, icon }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          padding: 20,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          cursor: "pointer",
          transition: "all 0.2s",
          background: "white",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = "#2563eb";
          e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = "#e5e7eb";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
        <h3 style={{ margin: "0 0 4px 0", fontSize: 18 }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 14, color: "#666" }}>{description}</p>
      </div>
    </Link>
  );
}
