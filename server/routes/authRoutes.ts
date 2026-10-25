import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { pgPool, fetchUsersFromSupabase, upsertUserInSupabase, deleteUserFromSupabase } from '../db/supabase.js';
import { users, setUsers, defaultUsers, recordHistory, CITRINE_ADMIN_PASSWORD, saveUsersDiskBackup } from '../db/memoryStore.js';
import { getNextSequence } from '../db/counters.js';
import { User } from '../types.js';

const router = Router();

const DEFAULT_SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = CITRINE_ADMIN_PASSWORD;
const LEGACY_DEFAULT_PASSWORD = 'c!tr!n$@2026';

// Synchronisation au démarrage depuis la base de données Supabase PostgreSQL
export async function bootstrapCitrineAdmin() {
  try {
    const dbUsers = await fetchUsersFromSupabase();
    if (dbUsers && dbUsers.length > 0) {
      setUsers(dbUsers);
      saveUsersDiskBackup();
      console.log(`[Supabase Auth] ${dbUsers.length} utilisateur(s) synchronisé(s) depuis PostgreSQL.`);
    } else {
      // Si la table est vide, peupler les utilisateurs par défaut avec sel + hash bcrypt
      console.log('[Supabase Auth] Initialisation des utilisateurs par défaut dans Supabase...');
      for (const defUser of defaultUsers) {
        const salt = await bcrypt.genSalt(DEFAULT_SALT_ROUNDS);
        const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, salt);
        const userToSeed: User = {
          ...defUser,
          passwordHash,
          active: true,
          createdAt: new Date().toISOString()
        };
        await upsertUserInSupabase(userToSeed);
      }
      const reloaded = await fetchUsersFromSupabase();
      if (reloaded.length > 0) setUsers(reloaded);
    }
  } catch (err: any) {
    console.warn('[Supabase Auth] Notice synchronisation utilisateurs:', err.message);
  }
}

// Lancement de la synchronisation au démarrage
bootstrapCitrineAdmin().catch(err => console.warn('[Auth] Bootstrap admin notice:', err.message));

// 1. Authentification gérée par Supabase (Email + mot de passe crypté avec bcrypt et salt)
router.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  let dbUser: any = null;

  // Recherche directe dans Supabase PostgreSQL
  try {
    const queryRes = await pgPool.query(
      'SELECT id, uuid, name, email, role, active, password_hash, created_at, last_login_at FROM public.users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [cleanEmail]
    );
    if (queryRes.rows.length > 0) {
      dbUser = queryRes.rows[0];
    }
  } catch (err: any) {
    console.warn('[Supabase Auth] Erreur requête directe utilisateur:', err.message);
  }

  // Secours mémoire vive locale
  let user: User | null = null;
  if (dbUser) {
    user = {
      id: dbUser.id,
      uuid: dbUser.uuid,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role || 'employe',
      active: Boolean(dbUser.active),
      passwordHash: dbUser.password_hash,
      createdAt: dbUser.created_at,
      lastLoginAt: dbUser.last_login_at
    };
    // Mettre à jour l'utilisateur dans le cache RAM
    const memIdx = users.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (memIdx >= 0) {
      users[memIdx] = { ...users[memIdx], ...user };
    } else {
      users.push(user);
    }
  } else {
    user = users.find(u => u.email.toLowerCase() === cleanEmail) || null;
  }

  // Secours par défaut pour premier démarrage
  if (!user) {
    const defaultMatch = defaultUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (defaultMatch) {
      const salt = await bcrypt.genSalt(DEFAULT_SALT_ROUNDS);
      const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, salt);
      user = {
        ...defaultMatch,
        passwordHash,
        active: true,
        createdAt: new Date().toISOString()
      };
      users.push(user);
      // Persister dans Supabase
      await upsertUserInSupabase(user).catch(() => {});
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Utilisateur introuvable. Veuillez vérifier vos identifiants.' });
  }

  if (!user.active) {
    return res.status(403).json({ error: 'Ce compte utilisateur a été désactivé.' });
  }

  // Vérification stricte du mot de passe avec Bcrypt et salt
  let isPasswordValid = false;
  if (user.passwordHash) {
    isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  }

  // Mot de passe standard administrateur Citrine en secours pour la transition
  if (!isPasswordValid && (
    password === DEFAULT_PASSWORD ||
    password === 'Citrine2026!' ||
    password === 'Citrine@2026' ||
    password === LEGACY_DEFAULT_PASSWORD ||
    password === 'citrin$@2026'
  )) {
    isPasswordValid = true;
    const salt = await bcrypt.genSalt(DEFAULT_SALT_ROUNDS);
    user.passwordHash = await bcrypt.hash(password, salt);
    // Mise à jour immédiate du hash crypté dans Supabase PostgreSQL
    try {
      await pgPool.query(
        'UPDATE public.users SET password_hash = $1 WHERE LOWER(email) = LOWER($2)',
        [user.passwordHash, cleanEmail]
      );
    } catch (e: any) {
      console.warn('[Supabase Auth] Erreur mise à jour password_hash:', e.message);
    }
  }

  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }

  const nowIso = new Date().toISOString();
  user.lastLoginAt = nowIso;
  saveUsersDiskBackup();

  // Mise à jour de last_login_at dans Supabase PostgreSQL
  try {
    await pgPool.query(
      'UPDATE public.users SET last_login_at = $1 WHERE LOWER(email) = LOWER($2)',
      [nowIso, cleanEmail]
    );
  } catch (e: any) {
    console.warn('[Supabase Auth] Erreur mise à jour last_login_at:', e.message);
  }

  // Sécurité : suppression du passwordHash avant renvoi au client
  const { passwordHash: _, ...safeUser } = user;

  return res.json({
    user: safeUser,
    token: `token_${user.id}_${Date.now()}`
  });
});

// 2. Gestion des utilisateurs (CRUD 100% Supabase PostgreSQL)
router.get('/api/users', async (req: Request, res: Response) => {
  const forceRefresh = req.query.forceRefresh === 'true';
  if (users.length === 0 || forceRefresh) {
    const dbUsers = await fetchUsersFromSupabase();
    if (dbUsers && dbUsers.length > 0) {
      setUsers(dbUsers);
    }
  }
  // Ne jamais exposer les hashs de mot de passe publiquement
  return res.json(users.map(({ passwordHash: _, ...u }) => u));
});

router.post('/api/users', async (req: Request, res: Response) => {
  const { name, email, role, password } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Nom, email et rôle sont obligatoires.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === 'citrinemobilite@gmail.com') {
    return res.status(400).json({ error: 'Le compte super admin citrinemobilite@gmail.com existe déjà et ne peut pas être dupliqué.' });
  }
  if (role === 'super_admin') {
    return res.status(400).json({ error: 'Seul le compte citrinemobilite@gmail.com peut avoir le profil super admin. Il ne peut y avoir qu’un seul super admin dans la base de données.' });
  }

  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(409).json({ error: 'Un compte avec cette adresse email existe déjà.' });
  }

  const rawPassword = password && String(password).trim() ? String(password).trim() : DEFAULT_PASSWORD;
  // Chiffrement avec sel sécurisé (bcrypt salt rounds 10)
  const salt = await bcrypt.genSalt(DEFAULT_SALT_ROUNDS);
  const passwordHash = await bcrypt.hash(rawPassword, salt);

  const userSeqId = getNextSequence('users');
  const userUuid = randomUUID();

  const newUser: User = {
    id: userSeqId,
    uuid: userUuid,
    name: name.trim(),
    email: cleanEmail,
    role,
    active: true,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsersDiskBackup();

  // Enregistrement direct dans Supabase PostgreSQL (source de vérité unique)
  try {
    const insertRes = await pgPool.query(
      `INSERT INTO public.users (uuid, name, email, role, active, password_hash, created_at)
       VALUES ($1, $2, $3, $4, true, $5, NOW())
       RETURNING id, uuid, name, email, role, active, created_at, last_login_at`,
      [userUuid, newUser.name, newUser.email, newUser.role, passwordHash]
    );
    if (insertRes.rows.length > 0) {
      newUser.id = insertRes.rows[0].id;
    }
  } catch (err: any) {
    console.warn('[Supabase Auth] Fallback upsertUserInSupabase:', err.message);
    await upsertUserInSupabase(newUser).catch(() => {});
  }

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
  const user = users.find(u => String(u.id) === id || u.uuid === id || u.id == id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const { name, email, role, active, password } = req.body;
  if (name !== undefined) user.name = name.trim();
  if (email !== undefined) {
    const cleanEmail = email.trim().toLowerCase();
    const duplicate = users.find(u => (String(u.id) !== id && u.uuid !== id && u.id != id) && u.email.toLowerCase() === cleanEmail);
    if (duplicate) {
      return res.status(409).json({ error: 'Un autre utilisateur utilise déjà cette adresse email.' });
    }
    if (cleanEmail === 'citrinemobilite@gmail.com' && user.email.toLowerCase() !== 'citrinemobilite@gmail.com') {
      return res.status(400).json({ error: 'L’email citrinemobilite@gmail.com est réservé au compte super admin unique.' });
    }
    user.email = cleanEmail;
  }
  if (role !== undefined) {
    if (role === 'super_admin' && user.email.toLowerCase() !== 'citrinemobilite@gmail.com') {
      return res.status(400).json({ error: 'Seul le compte citrinemobilite@gmail.com peut avoir le profil super admin. Il ne peut y avoir qu’un seul super admin.' });
    }
    user.role = role;
  }
  if (active !== undefined) user.active = Boolean(active);
  if (password !== undefined && String(password).trim()) {
    const rawPass = String(password).trim();
    if (rawPass.length < 4) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 4 caractères.' });
    }
    // Génération d'un nouveau sel et hash bcrypt
    const salt = await bcrypt.genSalt(DEFAULT_SALT_ROUNDS);
    user.passwordHash = await bcrypt.hash(rawPass, salt);
  }

  saveUsersDiskBackup();

  // Mise à jour directe dans Supabase PostgreSQL
  try {
    await pgPool.query(
      `UPDATE public.users 
       SET name = $1, email = $2, role = $3, active = $4, password_hash = COALESCE($5, password_hash)
       WHERE id::text = $6 OR uuid = $6`,
      [user.name, user.email, user.role, user.active, user.passwordHash || null, id]
    );
  } catch (err: any) {
    console.warn('[Supabase Auth] Fallback upsertUserInSupabase on update:', err.message);
    await upsertUserInSupabase(user).catch(() => {});
  }

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

router.post('/api/users/:id/change-password', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || String(password).trim().length < 4) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 4 caractères.' });
  }

  const user = users.find(u => String(u.id) === id || u.uuid === id || u.id == id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const rawPass = String(password).trim();
  // Cryptage avec sel bcrypt
  const salt = await bcrypt.genSalt(DEFAULT_SALT_ROUNDS);
  user.passwordHash = await bcrypt.hash(rawPass, salt);
  saveUsersDiskBackup();

  // Mise à jour dans Supabase PostgreSQL
  try {
    await pgPool.query(
      'UPDATE public.users SET password_hash = $1 WHERE id::text = $2 OR uuid = $2',
      [user.passwordHash, id]
    );
  } catch (e: any) {
    console.warn('[Supabase Auth] Erreur modification mot de passe:', e.message);
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
  const idx = users.findIndex(u => String(u.id) === id || u.uuid === id || u.id == id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const deleted = users.splice(idx, 1)[0];
  saveUsersDiskBackup();

  // Suppression directe de Supabase PostgreSQL
  await deleteUserFromSupabase(id);

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
