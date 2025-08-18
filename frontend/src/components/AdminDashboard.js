import React, { useEffect, useState } from "react";
import ReportView from "./ReportView";

function AdminDashboard({ onLogout }) {
  const [projects, setProjects] = useState([]);
  const [file, setFile] = useState(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [uploadClientId, setUploadClientId] = useState("");
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [editClientId, setEditClientId] = useState(null);
  const [editEmail, setEditEmail] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [projectSearch, setProjectSearch] = useState("");

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("rp_user") || "null");
    } catch {
      return null;
    }
  })();
  const email = (storedUser && storedUser.email) || "admin@example.com";

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem("rp_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`https://qsl-services-report-backend.vercel.app//projects?email=${email}`, { headers });
      const data = await res.json();
      if (res.ok) setProjects(data);
      else alert(data.error || "Failed to fetch projects");
    } catch (err) {
      console.error(err);
      alert("Error fetching projects");
    }
  };

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem("rp_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch("https://qsl-services-report-backend.vercel.app//admin/clients", { headers });
      const data = await res.json();
      if (res.ok || Array.isArray(data)) setClients(data);
      else alert(data.error || "Failed to fetch clients");
    } catch (err) {
      console.error(err);
      alert("Error fetching clients");
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!file || !uploadClientId || !projectTitle) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("email", email);
    formData.append("client_id", uploadClientId);
    formData.append("title", projectTitle);

    const res = await fetch("https://qsl-services-report-backend.vercel.app//admin/create-project", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (res.ok) {
      alert("Project created!");
      setProjects((prev) => [data.project, ...prev]);
      setFile(null);
      setUploadClientId("");
      setProjectTitle("");
    } else {
      alert(data.error || "Failed to create project");
    }
  };

  const handleFollowUp = async (projectId, f) => {
    if (!f) return;
    const formData = new FormData();
    formData.append("file", f);
    formData.append("email", email);

    const res = await fetch(`https://qsl-services-report-backend.vercel.app//project/${projectId}/add-report`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (res.ok) {
      alert("Follow-up added!");
      fetchProjects();
    } else {
      alert(data.error || "Failed to upload follow-up");
    }
  };

  const addClient = async (e) => {
    e.preventDefault();
    const res = await fetch("https://qsl-services-report-backend.vercel.app//admin/add-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newClientEmail }),
    });
    const data = await res.json();
    if (res.ok) {
      setClients((prev) => [data.client, ...prev]);
      setNewClientEmail("");
    } else alert(data.error || "Failed to add client");
  };

  const updateClient = async (id) => {
    const res = await fetch(`https://qsl-services-report-backend.vercel.app//admin/update-client/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: editEmail }),
    });
    const data = await res.json();
    if (res.ok) {
      setClients((prev) =>
        prev.map((c) => (c.id === id ? { ...c, email: editEmail } : c))
      );
      setEditClientId(null);
      setEditEmail("");
    } else alert(data.error || "Failed to update client");
  };

  const deleteClient = async (id) => {
    if (!window.confirm("Delete this client?")) return;
    const res = await fetch(`https://qsl-services-report-backend.vercel.app//admin/delete-client/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      setClients((prev) => prev.filter((c) => c.id !== id));
    } else alert(data.error || "Failed to delete client");
  };

  const toggleClient = async (id) => {
    const res = await fetch(`https://qsl-services-report-backend.vercel.app//admin/toggle-client/${id}`, { method: "PATCH" });
    const data = await res.json();
    if (res.ok) {
      setClients((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: c.status === "active" ? "inactive" : "active" } : c
        )
      );
    } else alert(data.error || "Failed to toggle client");
  };

  const handleLogout = () => {
    localStorage.removeItem("rp_token");
    localStorage.removeItem("rp_user");
    if (typeof onLogout === "function") onLogout();
  };

  const filteredClients = clients.filter((c) =>
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredProjects = projects.filter(
    (p) =>
      (p.title || "").toLowerCase().includes(projectSearch.toLowerCase()) ||
      (p.client_email || "").toLowerCase().includes(projectSearch.toLowerCase()) ||
      (p.reports || []).some((r) =>
        (r.name || "").toLowerCase().includes(projectSearch.toLowerCase())
      )
  );

  const containerStyle = {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "15px",
    fontFamily: "Arial, sans-serif",
  };

  const cardStyle = {
    border: "1px solid #ccc",
    padding: "15px",
    borderRadius: "8px",
    marginBottom: "20px",
  };

  const flexWrapStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  };

  const inputStyle = {
    flex: "1 1 200px",
    padding: "8px",
    minWidth: "120px",
  };

  const buttonStyle = {
    padding: "8px 16px",
    borderRadius: "5px",
    border: "none",
    cursor: "pointer",
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Admin Dashboard</h2>

      <div style={{ ...flexWrapStyle, justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <strong>{email}</strong>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => { fetchProjects(); fetchClients(); }}
            style={{ ...buttonStyle, background: "#5bc0de", color: "white" }}
          >
            Refresh Data
          </button>
          <button
            onClick={handleLogout}
            style={{ ...buttonStyle, background: "#d9534f", color: "white" }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Create Project */}
      <div style={cardStyle}>
        <h3>Create New Project</h3>
        <form onSubmit={handleCreateProject} style={flexWrapStyle}>
          <input
            type="text"
            placeholder="Project title"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            required
            style={inputStyle}
          />
          <input type="file" onChange={(e) => setFile(e.target.files[0])} required style={{ flex: "1 1 150px" }} />
          <select
            value={uploadClientId}
            onChange={(e) => setUploadClientId(e.target.value)}
            required
            style={{ flex: "1 1 150px", padding: "8px" }}
          >
            <option value="">-- Select Client --</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.email}
              </option>
            ))}
          </select>
          <button
            type="submit"
            style={{ ...buttonStyle, background: "#0275d8", color: "white" }}
          >
            Create Project
          </button>
        </form>
      </div>

      {/* Add Client */}
      <div style={cardStyle}>
        <h3>Add Client</h3>
        <form onSubmit={addClient} style={flexWrapStyle}>
          <input
            type="email"
            placeholder="Enter client email"
            value={newClientEmail}
            onChange={(e) => setNewClientEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <button type="submit" style={{ ...buttonStyle, background: "#5cb85c", color: "white" }}>
            Add
          </button>
        </form>
      </div>

      {/* Clients List */}
      <div style={cardStyle}>
        <h3>Registered Clients</h3>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "10px",
            border: "1px solid #ddd",
            borderRadius: "4px",
          }}
        />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f2f2f2" }}>
                <th style={{ padding: "10px", border: "1px solid #ddd" }}>Email</th>
                <th style={{ padding: "10px", border: "1px solid #ddd" }}>Status</th>
                <th style={{ padding: "10px", border: "1px solid #ddd" }}>Added At</th>
                <th style={{ padding: "10px", border: "1px solid #ddd" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((c) => (
                <tr key={c.id}>
                  <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                    {editClientId === c.id ? (
                      <input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        style={{ padding: "6px", width: "100%" }}
                      />
                    ) : (
                      c.email
                    )}
                  </td>
                  <td style={{ padding: "10px", border: "1px solid #ddd" }}>{c.status}</td>
                  <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                    {new Date(c.added_at).toLocaleString()}
                  </td>
                  <td style={{ padding: "10px", border: "1px solid #ddd", minWidth: "200px" }}>
                    {editClientId === c.id ? (
                      <>
                        <button
                          onClick={() => updateClient(c.id)}
                          style={{ background: "#5bc0de", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", marginRight: "5px" }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditClientId(null)}
                          style={{ background: "#777", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px" }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditClientId(c.id);
                            setEditEmail(c.email);
                          }}
                          style={{ background: "#f0ad4e", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", marginRight: "5px" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleClient(c.id)}
                          style={{
                            background: c.status === "active" ? "#d9534f" : "#5cb85c",
                            color: "white",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            marginRight: "5px",
                          }}
                        >
                          {c.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => deleteClient(c.id)}
                          style={{ background: "#d9534f", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px" }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Projects */}
      <div style={cardStyle}>
        <h3>Projects</h3>
        <input
          type="text"
          placeholder="Search projects or reports..."
          value={projectSearch}
          onChange={(e) => setProjectSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "10px",
            border: "1px solid #ddd",
            borderRadius: "4px",
          }}
        />
        {filteredProjects.length === 0 ? (
          <p style={{ textAlign: "center", marginTop: "10px", color: "red" }}>No project found</p>
        ) : (
          filteredProjects.map((p) => (
            <div key={p.id} style={{ border: "1px solid #ddd", borderRadius: "6px", margin: "10px 0", padding: "10px", background: "#fafafa" }}>
              <h4 style={{ wordBreak: "break-word" }}>{p.title} — {p.client_email}</h4>
              <input type="file" onChange={(e) => handleFollowUp(p.id, e.target.files[0])} style={{ marginBottom: "10px" }} />
              <ul style={{ paddingLeft: "20px" }}>
                {p.reports.map((r) => (
                  <li key={r.id} style={{ marginBottom: "6px", wordBreak: "break-word" }}>
                    {r.name} (v{r.version}) — {r.uploaded_by} @ {new Date(r.uploaded_at).toLocaleString()}{" "}
                    <a href={`https://qsl-services-report-backend.vercel.app/${r.download_url}`} target="_blank" rel="noreferrer" style={{ marginLeft: "10px", color: "#0275d8" }}>
                      Download
                    </a>
                    <button
                      onClick={() => setSelectedReport(r)}
                      style={{
                        background: "#5bc0de",
                        color: "white",
                        border: "none",
                        padding: "4px 10px",
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
          ))
        )}
      </div>

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

export default AdminDashboard;
