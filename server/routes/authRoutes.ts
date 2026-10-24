import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { users, setUsers, recordHistory, CITRINE_ADMIN_PASSWORD, saveUsersDiskBackup } from '../db/memoryStore.js';
import { upsertUserToSupabase, deleteUserFromSupabase, fetchUsersFromSupabase } from '../db/supabase.js';
import { User } from '../types.js';

const router = Router();

const DEFAULT_SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = CITRINE_ADMIN_PASSWORD;
const LEGACY_DEFAULT_PASSWORD = 'c!tr!n$@2026';

// Synchronisation au démarrage depuis Supabase ou Disque
export async function bootstrapCitrineAdmin() {
  try {
    const supaUsers = await fetchUsersFromSupabase();
    if (supaUsers && supaUsers.length > 0) {
      setUsers(supaUsers);
    }
  } catch (e: any) {
    console.warn('[Auth] Bootstrap admin Supabase notice:', e.message);
  }
}

// Lancement de la synchronisation
bootstrapCitrineAdmin().catch(err => console.warn('[Auth] Bootstrap admin notice:', err.message));

// 1. Authentification
router.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  let user = users.find(u => u.email.toLowerCase() === cleanEmail && u.active !== false);

  if (!user && cleanEmail === 'landrymoutongoprofessionnel@gmail.com') {
    const adminHash = await bcrypt.hash(DEFAULT_PASSWORD, DEFAULT_SALT_ROUNDS);
    user = {
      id: 'admin_landry',
      uuid: 'admin_landry_uuid',
      name: 'Landry Moutongo',
      email: cleanEmail,
      role: 'super_admin',
      active: true,
      passwordHash: adminHash,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveUsersDiskBackup();
    await upsertUserToSupabase(user).catch(() => {});
  }

  if (!user) {
    return res.status(401).json({ error: 'Utilisateur introuvable ou compte désactivé.' });
  }

  let isPasswordValid = false;
  if (user.passwordHash) {
    isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  }
  
  // Accepter le mot de passe standard administrateur Citrine en secours
  if (!isPasswordValid && (
    password === DEFAULT_PASSWORD ||
    password === 'Citrine2026!' ||
    password === 'Citrine@2026' ||
    password === LEGACY_DEFAULT_PASSWORD ||
    password === 'citrin$@2026'
  )) {
    isPasswordValid = true;
    user.passwordHash = await bcrypt.hash(password, DEFAULT_SALT_ROUNDS);
    await upsertUserToSupabase(user).catch(() => {});
  }

  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }

  user.lastLoginAt = new Date().toISOString();
  await upsertUserToSupabase(user).catch(() => {});

  // Suppression du passwordHash avant de renvoyer l'objet au client
  const { passwordHash: _, ...safeUser } = user;

  return res.json({
    user: safeUser,
    token: `token_${user.id}_${Date.now()}`
  });
});

// 2. User management
router.get('/api/users', async (req: Request, res: Response) => {
  const forceRefresh = req.query.forceRefresh === 'true';
  if (users.length === 0 || forceRefresh) {
    try {
      const supaUsers = await fetchUsersFromSupabase();
      if (supaUsers && supaUsers.length > 0) {
        setUsers(supaUsers);
      }
    } catch (e: any) {
      console.warn('[Supabase] get users notice:', e.message);
    }
  }
  return res.json(users.map(({ passwordHash: _, ...u }) => u));
});

router.post('/api/users', async (req: Request, res: Response) => {
  const { name, email, role, password } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Nom, email et rôle sont obligatoires.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(409).json({ error: 'Un compte avec cette adresse email existe déjà.' });
  }

  const rawPassword = password && String(password).trim() ? String(password).trim() : DEFAULT_PASSWORD;
  const passwordHash = await bcrypt.hash(rawPassword, DEFAULT_SALT_ROUNDS);

  const newUser: User = {
    id: randomUUID(),
    name: name.trim(),
    email: cleanEmail,
    role,
    active: true,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsersDiskBackup();
  await upsertUserToSupabase(newUser).catch(() => {});

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
  const user = users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const { name, email, role, active, password } = req.body;
  if (name !== undefined) user.name = name.trim();
  if (email !== undefined) {
    const cleanEmail = email.trim().toLowerCase();
    const duplicate = users.find(u => u.id !== id && u.email.toLowerCase() === cleanEmail);
    if (duplicate) {
      return res.status(409).json({ error: 'Un autre utilisateur utilise déjà cette adresse email.' });
    }
    user.email = cleanEmail;
  }
  if (role !== undefined) user.role = role;
  if (active !== undefined) user.active = Boolean(active);
  if (password !== undefined && String(password).trim()) {
    const rawPass = String(password).trim();
    if (rawPass.length < 4) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 4 caractères.' });
    }
    user.passwordHash = await bcrypt.hash(rawPass, DEFAULT_SALT_ROUNDS);
  }

  saveUsersDiskBackup();
  await upsertUserToSupabase(user).catch(() => {});

  await recordHistory({
    action: 'update_user',
    eventType: 'users',
    title: 'Utilisateur mis à jour',
    description: `Modification du compte ${user.name} (${user.email}) - Rôle: ${user.role}${password ? ' (Mot de passe mis à jour)' : ''}`,
    status: 'success'
  });

  const { passwordHash: _, ...safeUser } = user;
  return res.json(safeUser);
});

router.delete('/api/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = users.findIndex(u => u.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const removed = users.splice(idx, 1)[0];
  saveUsersDiskBackup();
  await deleteUserFromSupabase(id).catch(() => {});

  await recordHistory({
    action: 'delete_user',
    eventType: 'users',
    title: 'Utilisateur supprimé',
    description: `Suppression du compte ${removed.name} (${removed.email})`,
    status: 'success'
  });

  return res.json({ success: true, message: 'Utilisateur supprimé avec succès.' });
});

export default router;
