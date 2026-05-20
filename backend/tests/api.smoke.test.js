import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  const mod = await import('../src/server.js');
  app = mod.app;
});

describe('Santé et lectures de base', () => {
  it('GET /api/health → 200 avec ok:true', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /api/logements → liste non vide', async () => {
    const res = await request(app).get('/api/logements');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /api/secteurs → tableau de secteurs', async () => {
    const res = await request(app).get('/api/secteurs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/meta → contient les états et urgences', async () => {
    const res = await request(app).get('/api/meta');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('etats');
    expect(res.body).toHaveProperty('urgences');
  });

  it('GET /api/carto/logements → structure attendue (pas 404)', async () => {
    const res = await request(app).get('/api/carto/logements');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalLogements');
    expect(res.body.totalLogements).toBeGreaterThan(0);
  });
});
