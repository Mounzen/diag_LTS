import React from 'react';
import BrandLogo from '../components/BrandLogo';

export default function ErrorPage({ title = 'Une erreur est survenue', text = 'La page ne peut pas être affichée pour le moment.' }) {
  return (
    <main className="errorPage">
      <section className="errorCard">
        <BrandLogo variant="light" className="errorLogo" />
        <h1>{title}</h1>
        <p>{text}</p>
      </section>
    </main>
  );
}
