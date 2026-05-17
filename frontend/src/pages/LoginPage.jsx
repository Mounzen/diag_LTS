import React, { useState } from 'react';
import { RefreshCw, User } from 'lucide-react';
import { api } from '../services/api';
import BrandLogo from '../components/BrandLogo';

export default function LoginPage({ onLogin }) {
  const [prenom, setPrenom] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.login({ prenom, code });
      onLogin(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <form className="loginCard" onSubmit={submit}>
        <div>
          <BrandLogo variant="light" className="loginLogo" />
          <p>Connexion simple avec prénom et code numérique.</p>
        </div>
        <label>Prénom<input value={prenom} onChange={(event) => setPrenom(event.target.value)} placeholder="Prénom" autoFocus /></label>
        <label>Code de connexion<input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Code numérique" inputMode="numeric" /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? <RefreshCw size={18} /> : <User size={18} />} Connexion</button>
      </form>
    </main>
  );
}
