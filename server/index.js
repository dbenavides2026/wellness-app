import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '10mb' }));

const SUPERADMIN_EMAIL = 'superadmin@wellnesscr.com';
const superadminPasswordHash = bcrypt.hashSync('WellnessDigit@l*2026', 10);

// Ruta del archivo de persistencia JSON
const DB_FILE = path.join(__dirname, 'db.json');

// Estructura por defecto de la base de datos
const defaultDb = {
  participants: [
    {
      id: 'superadmin-1',
      fullName: 'Super Administrator',
      email: SUPERADMIN_EMAIL,
      passwordHash: superadminPasswordHash,
      role: 'admin',
      stamps: []
    }
  ],
  specialChallenges: [],
  hikingChallenges: [],
  runningChallenges: [],
  challengeStatus: { isActive: true, title: 'Active Wellness Challenge Campaign', startDate: new Date().toISOString(), endDate: '' },
  hikingStatus: { isActive: true, title: 'Active Hiking Season Campaign', startDate: new Date().toISOString(), endDate: '' },
  runningStatus: { isActive: true, title: 'Active Running Season Campaign', startDate: new Date().toISOString(), endDate: '' },
  communityPosts: [
    { id: 'c1', author: 'Wellness Team', role: 'admin', message: 'Welcome to the Digital Wellness Passport! Track workouts and earn points.', isAnnouncement: true, createdAt: new Date().toISOString() }
  ]
};

// Función para cargar los datos desde el archivo local
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data);
      
      // Asegurar que el superadmin siempre exista
      if (!parsed.participants.some(p => p.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase())) {
        parsed.participants.unshift(defaultDb.participants[0]);
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error al leer db.json, usando base de datos por defecto:', err);
  }
  return defaultDb;
}

// Inicialización de la base de datos en memoria cargando desde archivo
let db = loadDatabase();

// Función para guardar los cambios en el archivo db.json
function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Error al guardar en db.json:', err);
  }
}

// Validador de política de contraseñas
function validatePasswordPolicy(password) {
  const minLength = 8;
  const maxLength = 16;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength || password.length > maxLength) return 'Password must be between 8 and 16 characters.';
  if (!hasUppercase) return 'Password must contain at least one uppercase letter.';
  if (!hasNumber) return 'Password must contain at least one number.';
  if (!hasSpecial) return 'Password must contain at least one special character (!@#$%^&*...).';
  return null;
}

// Generador de QR
async function generateQrDataUrl(codeText) {
  try {
    const svgString = await QRCode.toString(codeText, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
  } catch (err) {
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="100%" height="100%" fill="#f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#0b41cd">${codeText}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(fallbackSvg)}`;
  }
}

// Catálogo de Códigos QR
async function getQrCodeCatalog() {
  const baseItems = [
    { id: 'gym', title: 'Gym / Solo Workout', code: 'WELLNESS-GYM-101' },
    { id: 'group', title: 'Group Fitness Class', code: 'WELLNESS-GROUP-202' },
    { id: 'sports', title: 'Sports & Outdoor Game', code: 'WELLNESS-SPORTS-303' },
    { id: 'hiking-club-checkin', title: 'Hiking Club Expedition', code: 'HIKING-CLUB-101' },
    { id: 'running-club-checkin', title: 'Running Club Session', code: 'RUNNING-CLUB-101' }
  ];

  const specialItems = [
    ...db.specialChallenges.map(c => ({ id: c.id, title: c.title, code: c.scanCode || `WELLNESS-SPEC-${c.id.slice(-4)}` })),
    ...db.hikingChallenges.map(c => ({ id: c.id, title: c.title, code: c.scanCode || `HIKING-SPEC-${c.id.slice(-4)}` })),
    ...db.runningChallenges.map(c => ({ id: c.id, title: c.title, code: c.scanCode || `RUNNING-SPEC-${c.id.slice(-4)}` }))
  ];

  const allItems = [...baseItems, ...specialItems];

  return Promise.all(
    allItems.map(async (item) => {
      const code = item.code || 'WELLNESS-DEFAULT';
      const qrCode = await generateQrDataUrl(code);
      return {
        id: item.id,
        title: item.title,
        scanCode: code,
        code: code,
        qrCode: qrCode
      };
    })
  );
}

// --- Rutas de API ---

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.participants.find(p => p.email.toLowerCase() === (email || '').toLowerCase());
  if (!user) return res.status(401).json({ message: 'Invalid email or password.' });

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return res.status(401).json({ message: 'Invalid email or password.' });

  const { passwordHash, ...userPayload } = user;
  res.json({ user: userPayload });
});

app.post('/api/register', async (req, res) => {
  const { fullName, email, password } = req.body;
  if (!fullName || !email || !password) return res.status(400).json({ message: 'All fields are required.' });
  if (db.participants.some(p => p.email.toLowerCase() === email.toLowerCase())) return res.status(400).json({ message: 'Email already registered.' });

  const policyError = validatePasswordPolicy(password);
  if (policyError) return res.status(400).json({ message: policyError });

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = { id: String(Date.now()), fullName, email: email.toLowerCase(), passwordHash, role: 'participant', stamps: [] };
  
  db.participants.push(newUser);
  saveDatabase();

  const { passwordHash: _, ...userPayload } = newUser;
  res.status(201).json({ user: userPayload });
});

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  const admin = db.participants.find(p => p.role === 'admin' && p.email.toLowerCase() === (email || '').toLowerCase());
  if (!admin) return res.status(401).json({ message: 'Invalid admin credentials.' });

  const isMatch = await bcrypt.compare(password, admin.passwordHash);
  if (!isMatch) return res.status(401).json({ message: 'Invalid admin credentials.' });

  const { passwordHash, ...adminPayload } = admin;
  res.json({ user: adminPayload });
});

app.get('/api/participants', (req, res) => {
  const safeParticipants = db.participants.map(({ passwordHash, ...p }) => p);
  res.json({ participants: safeParticipants });
});

app.post('/api/participants/:id/stamps', (req, res) => {
  const { id } = req.params;
  const { title, points, categoryId, scanCode } = req.body;

  const user = db.participants.find(p => p.id === id);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const newStamp = { id: String(Date.now()), title, points: Number(points) || 1, categoryId: categoryId || 'general', scanCode, date: new Date().toISOString() };
  user.stamps = [newStamp, ...(user.stamps || [])];

  saveDatabase();

  const { passwordHash, ...userPayload } = user;
  res.json({ user: userPayload });
});

app.put('/api/participants/:id/profile', async (req, res) => {
  const { id } = req.params;
  const { fullName, email, password, profileImage } = req.body;

  const user = db.participants.find(p => p.id === id);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  if (fullName) user.fullName = fullName;
  if (email) user.email = email.toLowerCase();
  if (password) {
    const policyError = validatePasswordPolicy(password);
    if (policyError) return res.status(400).json({ message: policyError });
    user.passwordHash = await bcrypt.hash(password, 10);
  }
  if (profileImage !== undefined) user.profileImage = profileImage;

  saveDatabase();

  const { passwordHash, ...userPayload } = user;
  res.json({ user: userPayload });
});

// --- Desafíos y Campañas ---
app.get('/api/challenges', (req, res) => res.json({ challenges: db.specialChallenges }));
app.get('/api/hiking-challenges', (req, res) => res.json({ challenges: db.hikingChallenges }));
app.get('/api/running-challenges', (req, res) => res.json({ challenges: db.runningChallenges }));

app.get('/api/admin/challenge-status', (req, res) => res.json({ status: db.challengeStatus }));
app.get('/api/admin/hiking-status', (req, res) => res.json({ status: db.hikingStatus }));
app.get('/api/admin/running-status', (req, res) => res.json({ status: db.runningStatus }));

app.post('/api/admin/challenge-status/start', (req, res) => {
  const { startDate, endDate } = req.body;
  db.challengeStatus = { isActive: true, title: 'Active Wellness Challenge Campaign', startDate: startDate || new Date().toISOString(), endDate: endDate || '' };
  saveDatabase();
  res.json({ status: db.challengeStatus });
});

app.post('/api/admin/challenge-status/end', (req, res) => {
  db.challengeStatus = { isActive: false, title: 'Wellness Challenge Campaign Ended' };
  db.participants.forEach(p => { p.stamps = p.stamps ? p.stamps.filter(s => s.scanCode?.startsWith('HIKING-') || s.scanCode?.startsWith('RUNNING-')) : []; });
  saveDatabase();
  res.json({ status: db.challengeStatus });
});

app.post('/api/admin/hiking-status/start', (req, res) => {
  const { startDate, endDate } = req.body;
  db.hikingStatus = { isActive: true, title: 'Active Hiking Season Campaign', startDate: startDate || new Date().toISOString(), endDate: endDate || '' };
  saveDatabase();
  res.json({ status: db.hikingStatus });
});

app.post('/api/admin/hiking-status/end', (req, res) => {
  db.hikingStatus = { isActive: false, title: 'Hiking Season Ended' };
  db.participants.forEach(p => { p.stamps = p.stamps ? p.stamps.filter(s => !s.scanCode?.startsWith('HIKING-')) : []; });
  saveDatabase();
  res.json({ status: db.hikingStatus });
});

app.post('/api/admin/running-status/start', (req, res) => {
  const { startDate, endDate } = req.body;
  db.runningStatus = { isActive: true, title: 'Active Running Season Campaign', startDate: startDate || new Date().toISOString(), endDate: endDate || '' };
  saveDatabase();
  res.json({ status: db.runningStatus });
});

app.post('/api/admin/running-status/end', (req, res) => {
  db.runningStatus = { isActive: false, title: 'Running Season Ended' };
  db.participants.forEach(p => { p.stamps = p.stamps ? p.stamps.filter(s => !s.scanCode?.startsWith('RUNNING-')) : []; });
  saveDatabase();
  res.json({ status: db.runningStatus });
});

app.post('/api/admin/challenges', (req, res) => {
  const { title, description, points, eventDate } = req.body;
  const newCh = { id: String(Date.now()), title, description, points: Number(points) || 10, eventDate: eventDate || '', scanCode: `WELLNESS-SPEC-${Date.now().toString().slice(-4)}` };
  db.specialChallenges.push(newCh);
  saveDatabase();
  res.status(201).json({ challenge: newCh });
});

app.delete('/api/admin/challenges/:id', (req, res) => {
  db.specialChallenges = db.specialChallenges.filter(c => c.id !== req.params.id);
  saveDatabase();
  res.json({ message: 'Deleted' });
});

app.post('/api/admin/hiking-challenges', (req, res) => {
  const { title, description, points, eventDate } = req.body;
  const newCh = { id: String(Date.now()), title, description, points: Number(points) || 15, eventDate: eventDate || '', scanCode: `HIKING-SPEC-${Date.now().toString().slice(-4)}` };
  db.hikingChallenges.push(newCh);
  saveDatabase();
  res.status(201).json({ challenge: newCh });
});

app.delete('/api/admin/hiking-challenges/:id', (req, res) => {
  db.hikingChallenges = db.hikingChallenges.filter(c => c.id !== req.params.id);
  saveDatabase();
  res.json({ message: 'Deleted' });
});

app.post('/api/admin/running-challenges', (req, res) => {
  const { title, description, points, eventDate } = req.body;
  const newCh = { id: String(Date.now()), title, description, points: Number(points) || 12, eventDate: eventDate || '', scanCode: `RUNNING-SPEC-${Date.now().toString().slice(-4)}` };
  db.runningChallenges.push(newCh);
  saveDatabase();
  res.status(201).json({ challenge: newCh });
});

app.delete('/api/admin/running-challenges/:id', (req, res) => {
  db.runningChallenges = db.runningChallenges.filter(c => c.id !== req.params.id);
  saveDatabase();
  res.json({ message: 'Deleted' });
});

// --- Comunidad ---
app.get('/api/admin/community', (req, res) => res.json({ posts: db.communityPosts }));

app.post('/api/admin/community', (req, res) => {
  const { author, role, message, image, isAnnouncement } = req.body;
  const newPost = { id: String(Date.now()), author, role: role || 'participant', message: message || '', image: image || '', isAnnouncement: Boolean(isAnnouncement), createdAt: new Date().toISOString() };
  db.communityPosts = [newPost, ...db.communityPosts];
  saveDatabase();
  res.status(201).json({ post: newPost });
});

app.delete('/api/admin/community/:id', (req, res) => {
  db.communityPosts = db.communityPosts.filter(p => p.id !== req.params.id);
  saveDatabase();
  res.json({ message: 'Deleted' });
});

// --- Estadísticas y Catálogo QR ---
app.get('/api/admin/stats', (req, res) => {
  const totalParticipants = db.participants.length;
  const activeParticipants = db.participants.filter(p => (p.stamps || []).length > 0).length;
  const totalStamps = db.participants.reduce((sum, p) => sum + (p.stamps || []).length, 0);
  const totalPoints = db.participants.reduce((sum, p) => sum + (p.stamps || []).reduce((s, st) => s + Number(st.points || 0), 0), 0);

  res.json({ stats: { totalParticipants, activeParticipants, totalStamps, totalPoints } });
});

app.get('/api/admin/qr-codes', async (req, res) => {
  try {
    const qrCodes = await getQrCodeCatalog();
    res.json({ qrCodes });
  } catch (err) {
    console.error('Error al generar catálogo de QR:', err);
    res.status(500).json({ message: 'Error generando catálogo de QR.' });
  }
});

app.post('/api/admin/participants/:id/promote', (req, res) => {
  const user = db.participants.find(p => p.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  user.role = 'admin';
  saveDatabase();
  res.json({ message: `${user.fullName} is now an admin.` });
});

app.delete('/api/admin/participants/:id', (req, res) => {
  db.participants = db.participants.filter(p => p.id !== req.params.id);
  saveDatabase();
  res.json({ message: 'User deleted.' });
});

// Servir archivos estáticos del frontend
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
