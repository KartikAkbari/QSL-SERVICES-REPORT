import React, { useEffect, useState } from "react";

function ReportView({ report, email: propEmail }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("rp_user") || "null");
    } catch {
      return null;
    }
  })();
  const email = propEmail || (storedUser && storedUser.email) || "";

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`https://qsl-services-report-backend.vercel.app/comments/${report.id}`);
      const data = await res.json();
      if (res.ok) setComments(data);
      else setComments([]);
    } catch (err) {
      console.error("Failed to fetch comments", err);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id]);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const res = await fetch(`https://qsl-services-report-backend.vercel.app/comments/${report.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, text }),
      });
      const data = await res.json();
      if (res.ok) {
        setText("");
        fetchComments();
      } else {
        alert(data.error || "Failed to post comment");
      }
    } catch (err) {
      console.error("Failed to post comment", err);
      alert("Failed to post comment");
    }
  };

  return (
    <div
      style={{
        marginTop: "20px",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "12px",
        backgroundColor: "#fafafa",
        boxShadow: "0px 2px 6px rgba(0,0,0,0.1)",
      }}
    >
      {/* Report Info */}
      <h3 style={{ marginBottom: "10px" }}>
        {report.name} <span style={{ color: "#666" }}>(v{report.version})</span>
      </h3>
      <a
        href={`https://qsl-services-report-backend.vercel.app/download/${report.id}`}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "inline-block",
          padding: "8px 14px",
          marginBottom: "20px",
          backgroundColor: "#007bff",
          color: "white",
          borderRadius: "6px",
          textDecoration: "none",
        }}
      >
        ⬇ Download Report
      </a>

      {/* Comments Section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ borderBottom: "1px solid #ddd", paddingBottom: "6px" }}>Comments</h4>
        <button
          onClick={fetchComments}
          style={{
            background: "#5bc0de",
            color: "white",
            border: "none",
            padding: "6px 10px",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Refresh Comments
        </button>
      </div>

      <ul style={{ listStyle: "none", padding: 0, marginTop: "10px" }}>
        {loadingComments && <p style={{ color: "#666" }}>Loading comments...</p>}
        {!loadingComments && comments.length === 0 && (
          <p style={{ color: "#666" }}>No comments yet. Be the first to comment!</p>
        )}
        {comments.map((c) => (
          <li
            key={c.id}
            style={{
              background: "#fff",
              border: "1px solid #eee",
              borderRadius: "8px",
              padding: "10px 14px",
              marginBottom: "10px",
              boxShadow: "0px 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <p style={{ margin: 0 }}>{c.text}</p>
            <small style={{ color: "#555" }}>
              — {c.user_email} • {new Date(c.created_at).toLocaleString()}
            </small>
          </li>
        ))}
      </ul>

      {/* Comment Form */}
      <form
        onSubmit={handleComment}
        style={{ display: "flex", gap: "10px", marginTop: "15px" }}
      >
        <input
          type="text"
          value={text}
          placeholder="Add a comment..."
          onChange={(e) => setText(e.target.value)}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        />
        <button
          type="submit"
          style={{
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Post
        </button>
      </form>
    </div>
  );
}

export default ReportView;
