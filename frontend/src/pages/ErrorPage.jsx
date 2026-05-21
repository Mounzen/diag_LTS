import React from 'react';
import BrandLogo from '../components/BrandLogo';

export default function ErrorPage({ title = 'Une erreur est survenue', text = 'La page ne peut pas être affichée pour le moment.', detail = '' }) {
  return (
    <main className="errorPage">
      <section className="errorCard">
        <BrandLogo variant="light" className="errorLogo" />
        <h1>{title}</h1>
        <p>{text}</p>
        {detail && (
          <pre style={{ marginTop: 16, padding: 12, background: '#fef2f2', color: '#b42318', borderRadius: 8, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'left', maxHeight: 240, overflow: 'auto' }}>
            {detail}
          </pre>
        )}
      </section>
    </main>
  );
}
