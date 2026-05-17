import express from 'express';

function foldText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user.id,
    prenom: user.prenom || '',
    service: user.service || '',
    role: user.role === 'chef' ? 'responsable' : user.role,
    actif: user.actif !== false
  };
}

function appendAuthJournal(db, action, details = {}) {
  const entry = { id: `ACT-${Date.now()}-${Math.round(Math.random() * 10000)}`, date: new Date().toISOString(), action, ...details };
  db.journalActions ||= [];
  db.historique_actions ||= [];
  db.journalActions.push(entry);
  db.historique_actions.push(entry);
}

export function authRoutes({ loadDb, saveDb }) {
  const router = express.Router();

  router.post('/auth/login', (req, res) => {
    const db = loadDb();
    const prenom = foldText(req.body.prenom);
    const code = String(req.body.code || '').trim();
    const user = prenom && code
      ? db.users.find((item) => foldText(item.prenom) === prenom && String(item.codeConnexion).trim() === code)
      : null;

    if (!user) {
      appendAuthJournal(db, 'connexion_echec', { prenom });
      saveDb(db);
      return res.status(401).json({ message: 'Prénom ou code incorrect' });
    }

    if (user.actif === false) {
      appendAuthJournal(db, 'connexion_refusee_agent_inactif', { userId: user.id });
      saveDb(db);
      return res.status(403).json({ message: 'Agent inactif' });
    }

    appendAuthJournal(db, 'connexion', { userId: user.id });
    saveDb(db);
    res.json({ user: publicUser(user) });
  });

  return router;
}
