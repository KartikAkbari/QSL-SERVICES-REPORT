import React, { useState } from "react";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");

  // helper to store user + token
  const saveAuth = (user, token) => {
    try {
      localStorage.setItem("rp_user", JSON.stringify(user));
      if (token) localStorage.setItem("rp_token", token);
    } catch (e) {
      console.warn("Failed to persist auth", e);
    }
  };

  const handleSubmitEmail = async () => {
    // simple admin detection: admin emails are in example.com domain in your app
    if (email.endsWith("@example.com")) {
      setIsAdmin(true); // show password form
      return;
    }

    // Client flow → request OTP
    try {
      const res = await fetch("https://qsl-services-report-backend.vercel.app//generate-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.status === 200) {
        setOtpSent(true);
        alert("OTP sent! Check your email.");
      } else {
        alert(data.error || "Something went wrong");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to request OTP");
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("https://qsl-services-report-backend.vercel.app//verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        // save token + user locally for persistence
        saveAuth(data.user, data.token);
        if (typeof onLogin === "function") onLogin("client", email);
      } else {
        alert(data.error || "Invalid OTP");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to verify OTP");
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("https://qsl-services-report-backend.vercel.app//admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        saveAuth(data.user, data.token);
        if (typeof onLogin === "function") onLogin("admin", email);
      } else {
        alert(data.error || "Invalid credentials");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to login");
    }
  };

  return (
    <div className="container" style={{ maxWidth: "420px", margin: "40px auto", padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ textAlign: "center" }}>Login</h2>

      {/* Step 1: Email input */}
      {!otpSent && !isAdmin && (
        <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }}
          />
          <button onClick={handleSubmitEmail} style={{ padding: "10px", borderRadius: "6px", background: "#0275d8", color: "white", border: "none" }}>
            Continue
          </button>
        </div>
      )}

      {/* Client OTP form */}
      {otpSent && (
        <form onSubmit={handleVerifyOtp} style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
          <input
            type="text"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }}
          />
          <button type="submit" style={{ padding: "10px", borderRadius: "6px", background: "#28a745", color: "white", border: "none" }}>
            Verify OTP
          </button>
        </form>
      )}

      {/* Admin password form */}
      {isAdmin && (
        <form onSubmit={handleAdminLogin} style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }}
          />
          <button type="submit" style={{ padding: "10px", borderRadius: "6px", background: "#6f42c1", color: "white", border: "none" }}>
            Login as Admin
          </button>
        </form>
      )}
    </div>
  );
}

export default Login;
