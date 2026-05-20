import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

let app;
let firstLogementId;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  const mod = await import('../src/server.js');
  app = mod.app;
  const res = await request(app).get('/api/logements');
  firstLogementId = res.body[0]?.id;
});

describe('CRUD Devis', () => {
  let createdId;

  it('POST /api/devis → crée un devis', async () => {
    const res = await request(app).post('/api/devis').send({
      logementId: firstLogementId,
      entrepriseNom: 'TEST VITEST',
      montantTTC: 1234,
      postes: ['Façade']
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.entrepriseNom).toBe('TEST VITEST');
    createdId = res.body.id;
  });

  it('GET /api/devis → contient le devis créé', async () => {
    const res = await request(app).get('/api/devis');
    expect(res.status).toBe(200);
    expect(res.body.some((d) => d.id === createdId)).toBe(true);
  });

  it('PUT /api/devis/:id → change le statut + date auto', async () => {
    const res = await request(app).put(`/api/devis/${createdId}`).send({ statut: 'recu' });
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('recu');
    expect(res.body.dateReception).toBeTruthy();
  });

  it('DELETE /api/devis/:id → supprime (cleanup)', async () => {
    const res = await request(app).delete(`/api/devis/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/devis sans logementId → 400', async () => {
    const res = await request(app).post('/api/devis').send({ entrepriseNom: 'X' });
    expect(res.status).toBe(400);
  });
});
