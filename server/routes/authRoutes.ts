import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, cleanFirestoreDoc, safeFirestoreWrite } from '../db/firestore.js';
import { users, setUsers, recordHistory } from '../db/memoryStore.js';
import { User } from '../types.js';

const router = Router();

const DEFAULT_SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'c!tr!n$@2026';

// Initialisation sécurisée du compte Super Admin Citrine en base Firestore
export async function bootstrapCitrineAdmin() {
  const cleanEmail = 'citrinemobilite@gmail.com';
  const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, DEFAULT_SALT_ROUNDS);
  
  let admin = users.find(u => u.email.toLowerCase() === cleanEmail);
  if (!admin) {
    admin = {
      id: 'usr_citrine_admin',
      name: 'Citrine Mobilité (Super Admin)',
      email: cleanEmail,
      role: 'admin',
      active: true,
      passwordHash: defaultHash,
      createdAt: new Date().toISOString()
    };
    users.unshift(admin);
  } else {
    admin.passwordHash = defaultHash;
    admin.role = 'admin';
    admin.active = true;
  }

  if (db) {
    await safeFirestoreWrite('bootstrapCitrineAdmin', () => 
      setDoc(doc(db!, 'users', admin!.id), cleanFirestoreDoc(admin), { merge: true })
    );
  }
}

// Lancement de l'initialisation
bootstrapCitrineAdmin().catch(err => console.warn('[Auth] Bootstrap admin notice:', err.message));

// 1. Auth routes
router.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  let user = users.find(u => u.email.toLowerCase() === cleanEmail);

  // Si l'utilisateur n'est pas encore en mémoire locale, tentative de récupération Firestore
  if (!user && db) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        const found = snap.docs.find(d => {
          const data = d.data();
          return data.email && data.email.toLowerCase() === cleanEmail && !data.deleted;
        });
        if (found) {
          user = { id: found.id, ...found.data() } as User;
          users.push(user);
        }
      }
    } catch (e: any) {
      console.warn('[Firestore] error finding user on login:', e.message);
    }
  }

  // Auto-création / synchronisation pour citrinemobilite@gmail.com
  if (!user && cleanEmail === 'citrinemobilite@gmail.com') {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, DEFAULT_SALT_ROUNDS);
    user = {
      id: 'usr_citrine_admin',
      name: 'Citrine Mobilité (Super Admin)',
      email: 'citrinemobilite@gmail.com',
      role: 'admin',
      active: true,
      passwordHash,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    users.unshift(user);
    if (db) {
      await safeFirestoreWrite('seedCitrineAdmin', () => setDoc(doc(db!, 'users', user!.id), cleanFirestoreDoc(user)));
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Utilisateur introuvable. Veuillez vérifier vos identifiants.' });
  }

  if (!user.active) {
    return res.status(403).json({ error: 'Ce compte utilisateur a été désactivé.' });
  }

  // Vérification du mot de passe avec Bcrypt & Salt
  let isPasswordValid = false;
  if (user.passwordHash) {
    isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  } else {
    // Si aucun hash présent (ex: compte créé auparavant), vérification du mot de passe standard et hachage
    if (password === DEFAULT_PASSWORD || (cleanEmail === 'citrinemobilite@gmail.com' && password === 'c!tr!n$@2026')) {
      isPasswordValid = true;
      user.passwordHash = await bcrypt.hash(password, DEFAULT_SALT_ROUNDS);
      if (db) {
        await safeFirestoreWrite('updateUserPasswordHash', () => 
          setDoc(doc(db!, 'users', user!.id), { passwordHash: user!.passwordHash }, { merge: true })
        );
      }
    }
  }

  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }

  user.lastLoginAt = new Date().toISOString();
  if (db) {
    await safeFirestoreWrite('updateLastLogin', () => 
      setDoc(doc(db!, 'users', user!.id), { lastLoginAt: user!.lastLoginAt }, { merge: true })
    );
  }

  // Suppression du passwordHash avant de renvoyer l'objet au client
  const { passwordHash: _, ...safeUser } = user;

  return res.json({
    user: safeUser,
    token: `token_${user.id}_${Date.now()}`
  });
});

// 2. User management (Servis depuis la RAM en priorité - 0 lecture Firestore)
router.get('/api/users', async (req: Request, res: Response) => {
  const forceRefresh = req.query.forceRefresh === 'true';
  if (db && (users.length === 0 || forceRefresh)) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        const dbUsers = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(u => !u.deleted && u.email && u.role);
        if (dbUsers.length > 0) {
          setUsers(dbUsers);
        }
      }
    } catch (e: any) {
      console.warn('[Firestore] get users error:', e.message);
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
  await safeFirestoreWrite('createUser', () => setDoc(doc(db!, 'users', newUser.id), cleanFirestoreDoc(newUser)));

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
  if (password && String(password).trim()) {
    user.passwordHash = await bcrypt.hash(String(password).trim(), DEFAULT_SALT_ROUNDS);
  }

  await safeFirestoreWrite('updateUser', () => setDoc(doc(db!, 'users', id), cleanFirestoreDoc(user), { merge: true }));

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

router.delete('/api/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const deleted = users.splice(idx, 1)[0];
  
  if (db) {
    // 1. Tenter la suppression physique directe
    const delRes = await safeFirestoreWrite('deleteUser', () => deleteDoc(doc(db!, 'users', id)));
    // 2. En cas de blocage de règles de sécurité cloud sur delete, marquer deleted: true
    if (delRes === null) {
      await safeFirestoreWrite('markDeletedUser', () => 
        setDoc(doc(db!, 'users', id), { deleted: true, active: false }, { merge: true })
      );
    }
  }

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
