import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

let app;
let logementId;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  const mod = await import('../src/server.js');
  app = mod.app;
  const res = await request(app).get('/api/logements');
  logementId = res.body[0]?.id;
});

describe('Conformité réglementaire', () => {
  it('PUT conformité → enregistre les champs', async () => {
    const res = await request(app).put(`/api/logements/${logementId}/conformite`).send({
      detecteurFumee: 'present',
      dpe: 'D'
    });
    expect(res.status).toBe(200);
    expect(res.body.detecteurFumee).toBe('present');
    expect(res.body.dpe).toBe('D');
  });

  it('PUT conformité → ignore plomb et gaz (champs retirés)', async () => {
    const res = await request(app).put(`/api/logements/${logementId}/conformite`).send({
      plomb: 'present',
      gazAuxNormes: 'oui'
    });
    expect(res.status).toBe(200);
    // Ces champs ne doivent PAS être enregistrés (whitelist)
    expect(res.body.plomb).toBeUndefined();
    expect(res.body.gazAuxNormes).toBeUndefined();
  });
});

describe('Caractéristiques structurelles', () => {
  it('PUT caractéristiques → étage + toiture + cours', async () => {
    const res = await request(app).put(`/api/logements/${logementId}/caracteristiques`).send({
      etage: 'N+1',
      couverture: 'tole',
      hasCours: false
    });
    expect(res.status).toBe(200);
    expect(res.body.etage).toBe('N+1');
    expect(res.body.hasCours).toBe(false);
    // Remettre RDC pour ne pas polluer
    await request(app).put(`/api/logements/${logementId}/caracteristiques`).send({ etage: 'RDC', hasCours: true });
  });

  it('PUT caractéristiques → étage invalide ignoré', async () => {
    const res = await request(app).put(`/api/logements/${logementId}/caracteristiques`).send({ etage: 'SOUS_SOL' });
    expect(res.status).toBe(200);
    // étage invalide → reste à sa valeur précédente (RDC)
    expect(res.body.etage).toBe('RDC');
  });
});
