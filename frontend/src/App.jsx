import React, { useState } from 'react';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ExportsPage from './pages/ExportsPage';
import LoginPage from './pages/LoginPage';
import TerrainPage from './pages/TerrainPage';
import PlanningPage from './pages/PlanningPage';

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('diag_lts_agent') || 'null'));
  const [page, setPage] = useState('terrain');

  function login(nextUser) {
    localStorage.setItem('diag_lts_agent', JSON.stringify(nextUser));
    setUser(nextUser);
  }

  function logout() {
    localStorage.removeItem('diag_lts_agent');
    setUser(null);
    setPage('terrain');
  }

  if (!user) return <LoginPage onLogin={login} />;

  return (
    <Layout user={user} page={page} setPage={setPage} onLogout={logout}>
      {page === 'terrain' && <TerrainPage user={user} />}
      {page === 'dashboard' && <DashboardPage user={user} />}
      {page === 'exports' && <ExportsPage />}
      {page === 'planning' && <PlanningPage user={user} />}
    </Layout>
  );
}
