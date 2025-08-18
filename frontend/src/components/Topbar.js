import React from "react";

function Topbar({ user, onLogout }) {
  return (
    <div style={{
      background: "#2563eb",
      padding: "12px 20px",
      color: "white",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}>
      <h2 style={{ margin: 0 }}>Report Portal</h2>
      <div>
        <span style={{ marginRight: "15px" }}>
          {user.role.toUpperCase()} – {user.email}
        </span>
        <button 
          onClick={onLogout} 
          style={{
            background: "#1e40af",
            padding: "6px 12px",
            borderRadius: "6px",
            border: "none",
            color: "white",
            cursor: "pointer"
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default Topbar;
