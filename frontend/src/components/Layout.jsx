import React from 'react';
import { Archive, BarChart3, CalendarClock, ClipboardCheck, FileText, LogOut, Menu, User } from 'lucide-react';
import BrandLogo from './BrandLogo';

const nav = [
  ['terrain', 'Terrain', ClipboardCheck],
  ['dashboard', 'Bureau', BarChart3],
  ['planning', 'Planning', CalendarClock],
  ['archive', 'Archive', Archive],
  ['exports', 'Exports', FileText]
];

export default function Layout({ user, page, setPage, onLogout, children }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandLogo variant="dark" className="sidebarLogo" />
        </div>
        <nav>
          {nav.map(([id, text, Icon]) => (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>
              <Icon size={18} /> {text}
            </button>
          ))}
        </nav>
        <div className="agentBox">
          <User size={18} />
          <div><strong>{user.nom || user.prenom || 'Utilisateur'}</strong><span>{user.role || 'agent'}</span></div>
        </div>
        <button className="ghost" onClick={onLogout}><LogOut size={18} /> Déconnexion</button>
      </aside>
      <header className="mobileTop">
        <button className="iconBtn"><Menu size={19} /></button>
        <BrandLogo variant="markDark" className="mobileLogo" />
        <button className="iconBtn" onClick={onLogout}><LogOut size={19} /></button>
      </header>
      <main className="content">{children}</main>
      <nav className="bottomNav">
        {nav.map(([id, text, Icon]) => (
          <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>
            <Icon size={18} /><span>{text}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
