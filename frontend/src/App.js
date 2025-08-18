import React, { useState } from "react";
import Login from "./components/Login";
import AdminDashboard from "./components/AdminDashboard";
import ClientDashboard from "./components/ClientDashboard";
import Topbar from "./components/Topbar";

function App() {
  const [user, setUser] = useState(null);

  const handleLogin = (role, email) => {
    setUser({ role, email });
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (user.role === "admin") {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  return (
    <div>
      <Topbar user={user} onLogout={handleLogout} />
      {user.role === "admin" ? (
        <AdminDashboard email={user.email} />
      ) : (
        <ClientDashboard email={user.email} />
      )}
    </div>
  );
}

export default App;
