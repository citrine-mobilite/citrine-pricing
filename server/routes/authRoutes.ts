import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import {
  fetchUsersFromMySQL,
  getUserByEmailFromMySQL,
  upsertUserInMySQL,
  deleteUserFromMySQL,
  getMySQLPool
} from '../db/mysql.js';
import { users, setUsers, recordHistory } from '../db/memoryStore.js';
import { getNextSequence } from '../db/counters.js';
import { User } from '../types.js';

const router = Router();
const DEFAULT_SALT_ROUNDS = 10;

// Authentification (Email + mot de passe haché par bcrypt)
router.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  let user: User | null = null;

  // Recherche directe dans MySQL
  try {
    user = await getUserByEmailFromMySQL(cleanEmail);
  } catch (err: any) {
    console.warn('[MySQL Auth] Erreur recherche utilisateur:', err.message);
  }

  // Secours mémoire vive locale
  if (!user) {
    user = users.find(u => u.email.toLowerCase() === cleanEmail) || null;
  }

  if (!user) {
    return res.status(401).json({ error: 'Adresse email ou mot de passe incorrect.' });
  }

  if (!user.active) {
    return res.status(403).json({ error: 'Ce compte utilisateur a été désactivé.' });
  }

  // Vérification du mot de passe avec Bcrypt
  let isPasswordValid = false;
  if (user.passwordHash) {
    isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  }

  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }

  const nowIso = new Date().toISOString();
  user.lastLoginAt = nowIso;

  // Mise à jour de last_login_at dans MySQL
  try {
    const p = getMySQLPool();
    await p.query('UPDATE users SET last_login_at = NOW() WHERE LOWER(email) = LOWER(?)', [cleanEmail]);
  } catch (e: any) {
    console.warn('[MySQL Auth] Erreur mise à jour last_login_at:', e.message);
  }

  const { passwordHash: _, ...safeUser } = user;

  return res.json({
    user: safeUser,
    token: `token_${user.id}_${Date.now()}`
  });
});

// Gestion des utilisateurs (CRUD 100% MySQL direct sans cache)
router.get('/api/users', async (_req: Request, res: Response) => {
  try {
    const dbUsers = await fetchUsersFromMySQL();
    setUsers(dbUsers);
    return res.json(dbUsers.map(({ passwordHash: _, ...u }) => u));
  } catch (e: any) {
    console.warn('[MySQL] Erreur lecture utilisateurs:', e.message);
  }
  return res.json(users.map(({ passwordHash: _, ...u }) => u));
});

router.post('/api/users', async (req: Request, res: Response) => {
  const { name, email, role, password } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Nom, email et rôle sont obligatoires.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = await getUserByEmailFromMySQL(cleanEmail);
  if (existing || users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(409).json({ error: 'Un compte avec cette adresse email existe déjà.' });
  }

  const rawPassword = password && String(password).trim() ? String(password).trim() : 'Citrine2026!';
  const salt = await bcrypt.genSalt(DEFAULT_SALT_ROUNDS);
  const passwordHash = await bcrypt.hash(rawPassword, salt);

  const newUser: User = {
    id: getNextSequence('users'),
    uuid: randomUUID(),
    name: name.trim(),
    email: cleanEmail,
    role,
    active: true,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  try {
    const saved = await upsertUserInMySQL(newUser);
    newUser.id = saved.id;
  } catch (err: any) {
    console.warn('[MySQL Auth] Erreur insertion MySQL:', err.message);
  }

  users.push(newUser);

  await recordHistory({
    action: 'create_user',
    eventType: 'users',
    title: 'Nouvel utilisateur créé',
    description: `${newUser.name} (${newUser.email}) - Rôle: ${newUser.role}`,
    status: 'success'
  });

  const { passwordHash: _, ...safeUser } = newUser;
  return res.status(201).json(safeUser);
});

router.put('/api/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = users.find(u => String(u.id) === id || u.uuid === id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const { name, email, role, active, password } = req.body;
  if (name !== undefined) user.name = name.trim();
  if (email !== undefined) {
    const cleanEmail = email.trim().toLowerCase();
    user.email = cleanEmail;
  }
  if (role !== undefined) user.role = role;
  if (active !== undefined) user.active = Boolean(active);
  if (password !== undefined && String(password).trim()) {
    const salt = await bcrypt.genSalt(DEFAULT_SALT_ROUNDS);
    user.passwordHash = await bcrypt.hash(String(password).trim(), salt);
  }

  try {
    await upsertUserInMySQL(user);
  } catch (err: any) {
    console.warn('[MySQL Auth] Erreur mise à jour utilisateur:', err.message);
  }

  await recordHistory({
    action: 'update_user',
    eventType: 'users',
    title: 'Utilisateur mis à jour',
    description: `Modification du compte ${user.name} (${user.email}) - Rôle: ${user.role}`,
    status: 'success'
  });

  const { passwordHash: _, ...safeUser } = user;
  return res.json(safeUser);
});

router.post('/api/users/:id/change-password', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || String(password).trim().length < 4) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 4 caractères.' });
  }

  const user = users.find(u => String(u.id) === id || u.uuid === id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const salt = await bcrypt.genSalt(DEFAULT_SALT_ROUNDS);
  user.passwordHash = await bcrypt.hash(String(password).trim(), salt);

  try {
    await upsertUserInMySQL(user);
  } catch (e: any) {
    console.warn('[MySQL Auth] Erreur modification mot de passe:', e.message);
  }

  await recordHistory({
    action: 'change_password',
    eventType: 'users',
    title: 'Mot de passe modifié',
    description: `Nouveau mot de passe défini pour ${user.name} (${user.email})`,
    status: 'success'
  });

  return res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
});

router.delete('/api/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = users.findIndex(u => String(u.id) === id || u.uuid === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const deleted = users.splice(idx, 1)[0];
  await deleteUserFromMySQL(id);

  await recordHistory({
    action: 'delete_user',
    eventType: 'users',
    title: 'Utilisateur supprimé',
    description: `Suppression du compte ${deleted.name} (${deleted.email})`,
    status: 'success'
  });

  return res.json({ success: true, message: 'Utilisateur supprimé avec succès.' });
});

export default router;
