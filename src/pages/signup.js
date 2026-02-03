import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // Create user via API
      const createRes = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          role: "PARENT", // Default role for new signups
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        setError(err.error || "Failed to create account");
        setLoading(false);
        return;
      }

      // Auto-login after signup
      const signInRes = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      setLoading(false);

      if (signInRes && !signInRes.error) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    } catch (err) {
      setError(err.message || "An error occurred");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "4rem auto",
        padding: 20,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ textAlign: "center", marginBottom: "2rem" }}>
        Ameris Child Academy
      </h1>
      <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        Create Account
      </h2>

      {error && (
        <div
          style={{
            padding: 12,
            background: "#fee2e2",
            color: "#dc2626",
            borderRadius: 4,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 4,
              boxSizing: "border-box",
            }}
            placeholder="Jane Doe"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 4,
              boxSizing: "border-box",
            }}
            placeholder="jane@example.com"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 4,
              boxSizing: "border-box",
            }}
            placeholder="••••••••"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 4,
              boxSizing: "border-box",
            }}
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            background: loading ? "#ccc" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 16,
            fontWeight: 500,
            marginBottom: 16,
          }}
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </form>

      <p style={{ textAlign: "center", color: "#666" }}>
        Already have an account?{" "}
        <Link
          href="/login"
          style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
