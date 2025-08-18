import React, { useEffect, useState } from "react";
import ReportView from "./ReportView";

function ClientDashboard({ onLogout, email: propEmail }) {
  const [projects, setProjects] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);

  // prefer prop email (in case parent passes it), else read stored user
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("rp_user") || "null");
    } catch {
      return null;
    }
  })();
  const email = propEmail || (storedUser && storedUser.email) || "";

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem("rp_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`https://qsl-services-report-backend.vercel.app//projects?email=${email}`, { headers });
      const data = await res.json();
      if (res.ok) setProjects(data);
      else console.error("Error fetching:", data.error || data);
    } catch (err) {
      console.error("Error fetching projects", err);
    }
  };

  useEffect(() => {
    if (email) fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const handleFollowUp = async (projectId, f) => {
    if (!f) return;
    const formData = new FormData();
    formData.append("file", f);
    formData.append("email", email);

    const res = await fetch(
      `https://qsl-services-report-backend.vercel.app//project/${projectId}/add-report`,
      {
        method: "POST",
        body: formData,
      }
    );
    const data = await res.json();
    if (res.ok) {
      alert("Follow-up uploaded!");
      fetchProjects();
    } else {
      alert(data.error || "Failed to upload follow-up");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("rp_token");
    localStorage.removeItem("rp_user");
    if (typeof onLogout === "function") onLogout();
  };

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "10px" }}>
        Client Dashboard
      </h2>
      <p style={{ textAlign: "center", marginBottom: "20px" }}>
        Welcome, <strong>{email}</strong>
      </p>
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <button
          onClick={() => { fetchProjects(); }}
          style={{
            background: "#5bc0de",
            color: "white",
            border: "none",
            padding: "8px 12px",
            borderRadius: "5px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          Refresh Data
        </button>
        <button
          onClick={handleLogout}
          style={{
            background: "#d9534f",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      {/* Projects Section */}
      {projects.map((p) => (
        <div
          key={p.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: "6px",
            margin: "15px 0",
            padding: "15px",
            background: "#fafafa",
          }}
        >
          <h3 style={{ marginBottom: "10px" }}>{p.title}</h3>

          <input
            type="file"
            onChange={(e) => handleFollowUp(p.id, e.target.files[0])}
            style={{ marginBottom: "10px" }}
          />

          <ul style={{ listStyle: "none", padding: 0 }}>
            {p.reports.map((r) => (
              <li
                key={r.id}
                style={{
                  marginBottom: "8px",
                  padding: "8px",
                  background: "#fff",
                  borderRadius: "4px",
                  border: "1px solid #eee",
                }}
              >
                {r.name} (v{r.version}){" "}
                <a
                  href={`https://qsl-services-report-backend.vercel.app/${r.download_url}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    marginLeft: "10px",
                    color: "#0275d8",
                    textDecoration: "none",
                  }}
                >
                  Download
                </a>
                <button
                  onClick={() => setSelectedReport(r)}
                  style={{
                    background: "#5bc0de",
                    color: "white",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    marginLeft: "10px",
                    cursor: "pointer",
                  }}
                >
                  View
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Report Viewer */}
      {selectedReport && (
        <div style={{ marginTop: "20px" }}>
          <ReportView report={selectedReport} email={email} />
          <button
            onClick={() => setSelectedReport(null)}
            style={{
              background: "#d9534f",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "5px",
              cursor: "pointer",
              marginTop: "10px",
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default ClientDashboard;
