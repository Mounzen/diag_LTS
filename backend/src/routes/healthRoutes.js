import express from 'express';

export function healthRoutes() {
  const router = express.Router();
  router.get('/health', (req, res) => res.json({ ok: true, name: 'DIAG-LTS API' }));
  return router;
}
