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

// In-Memory Data Storage
let participants = [
  {
    id: 'superadmin-1',
    fullName: 'Super Administrator',
    email: SUPERADMIN_EMAIL,
    passwordHash: superadminPasswordHash,
    role: 'admin',
    stamps: []
  }
];

let specialChallenges = [];
let hikingChallenges = [];
let runningChallenges = [];

let challengeStatus = { isActive: true, title: 'Active Wellness Challenge Campaign', startDate: new Date().toISOString(), endDate: '' };
let hikingStatus = { isActive: true, title: 'Active Hiking Season Campaign', startDate: new Date().toISOString(), endDate: '' };
let runningStatus = { isActive: true, title: 'Active Running Season Campaign', startDate: new Date().toISOString(), endDate: '' };

let communityPosts = [
  { id: 'c1', author: 'Wellness Team', role: 'admin', message: 'Welcome to the Digital Wellness Passport! Track workouts and earn points.', isAnnouncement: true, createdAt: new Date().toISOString() }
];

// Password Policy Validator
function validatePasswordPolicy(password) {
  const minLength = 8;
  const maxLength = 16;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength || password.length > maxLength) {
    return 'Password must be between 8 and 16 characters.';
  }
  if (!hasUppercase) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!hasNumber) {
    return 'Password must contain at least one number.';
  }
  if (!hasSpecial) {
    return 'Password must contain at least one special character (!@#$%^&*...).';
  }
  return null;
}

// Reliable Promise Wrapper for QR Code Generation
function generateQrDataUrl(codeText) {
  return new Promise((resolve) => {
    QRCode.toString(codeText, { type: 'svg', margin: 2 }, (err, svg) => {
      if (err || !svg) {
        console.error(`QR Generation error for code: ${codeText}`, err);
        resolve('');
      } else {
        const encodedSvg = encodeURIComponent(svg);
        resolve(`data:image/svg+xml;charset=utf-8,${encodedSvg}`);
      }
    });
  });
}

// QR Catalog Generator
async function getQrCodeCatalog() {
  const baseItems = [
    { id: 'gym', title: 'Gym / Solo Workout', code: 'WELLNESS-GYM-101' },
    { id: 'group', title: 'Group Fitness Class', code: 'WELLNESS-GROUP-202' },
    { id: 'sports', title: 'Sports & Outdoor Game', code: 'WELLNESS-SPORTS-303' },
    { id: 'hiking-club-checkin', title: 'Hiking Club Expedition', code: 'HIKING-CLUB-101' },
    { id: 'running-club-checkin', title: 'Running Club Session', code: 'RUNNING-CLUB-101' }
  ];

  const specialItems = [
    ...specialChallenges.map(c => ({ id: c.id, title: c.title, code: c.scanCode || `WELLNESS-SPEC-${c.id.slice(-4)}` })),
    ...hikingChallenges.map(c => ({ id: c.id, title: c.title, code: c.scanCode || `HIKING-SPEC-${c.id.slice(-4)}` })),
    ...runningChallenges.map(c => ({ id: c.id, title: c.title, code: c.scanCode || `RUNNING-SPEC-${c.id.slice(-4)}` }))
  ];

  const allItems = [...baseItems, ...specialItems];

  const catalog = [];
  for (const item of allItems) {
    const code = item.code || 'WELLNESS-DEFAULT';
    const qrCode = await generateQrDataUrl(code);
    catalog.push({
      ...item,
      scanCode: code,
      qrCode
    });
  }

  return catalog;
}

// API Routes
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = participants.find(p => p.email.toLowerCase() === (email || '').toLowerCase());
  if (!user) return res.status(401).json({ message: 'Invalid email or password.' });

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return res.status(401).json({ message: 'Invalid email or password.' });

  const { passwordHash, ...userPayload } = user;
  res.json({ user: userPayload });
});

app.post('/api/register', async (req, res) => {
  const { fullName, email, password } = req.body;
  if (!fullName || !email || !password) return res.status(400).json({ message: 'All fields are required.' });
  if (participants.some(p => p.email.toLowerCase() === email.toLowerCase())) return res.status(400).json({ message: 'Email already registered.' });

  const policyError = validatePasswordPolicy(password);
  if (policyError) return res.status(400).json({ message: policyError });

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = { id: String(Date.now()), fullName, email: email.toLowerCase(), passwordHash, role: 'participant', stamps: [] };
  participants.push(newUser);

  const { passwordHash: _, ...userPayload } = newUser;
  res.status(201).json({ user: userPayload });
});

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  const admin = participants.find(p => p.role === 'admin' && p.email.toLowerCase() === (email || '').toLowerCase());
  if (!admin) return res.status(401).json({ message: 'Invalid admin credentials.' });

  const isMatch = await bcrypt.compare(password, admin.passwordHash);
  if (!isMatch) return res.status(401).json({ message: 'Invalid admin credentials.' });

  const { passwordHash, ...adminPayload } = admin;
  res.json({ user: adminPayload });
});

app.get('/api/participants', (req, res) => {
  const safeParticipants = participants.map(({ passwordHash, ...p }) => p);
  res.json({ participants: safeParticipants });
});

app.post('/api/participants/:id/stamps', (req, res) => {
  const { id } = req.params;
  const { title, points, categoryId, scanCode } = req.body;

  const user = participants.find(p => p.id === id);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const newStamp = { id: String(Date.now()), title, points: Number(points) || 1, categoryId: categoryId || 'general', scanCode, date: new Date().toISOString() };
  user.stamps = [newStamp, ...(user.stamps || [])];

  const { passwordHash, ...userPayload } = user;
  res.json({ user: userPayload });
});

app.put('/api/participants/:id/profile', async (req, res) => {
  const { id } = req.params;
  const { fullName, email, password, profileImage } = req.body;

  const user = participants.find(p => p.id === id);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  if (fullName) user.fullName = fullName;
  if (email) user.email = email.toLowerCase();
  if (password) {
    const policyError = validatePasswordPolicy(password);
    if (policyError) return res.status(400).json({ message: policyError });
    user.passwordHash = await bcrypt.hash(password, 10);
  }
  if (profileImage !== undefined) user.profileImage = profileImage;

  const { passwordHash, ...userPayload } = user;
  res.json({ user: userPayload });
});

// Campaign & Challenge Management
app.get('/api/challenges', (req, res) => res.json({ challenges: specialChallenges }));
app.get('/api/hiking-challenges', (req, res) => res.json({ challenges: hikingChallenges }));
app.get('/api/running-challenges', (req, res) => res.json({ challenges: runningChallenges }));

app.get('/api/admin/challenge-status', (req, res) => res.json({ status: challengeStatus }));
app.get('/api/admin/hiking-status', (req, res) => res.json({ status: hikingStatus }));
app.get('/api/admin/running-status', (req, res) => res.json({ status: runningStatus }));

app.post('/api/admin/challenge-status/start', (req, res) => {
  const { startDate, endDate } = req.body;
  challengeStatus = { isActive: true, title: 'Active Wellness Challenge Campaign', startDate: startDate || new Date().toISOString(), endDate: endDate || '' };
  res.json({ status: challengeStatus });
});

app.post('/api/admin/challenge-status/end', (req, res) => {
  challengeStatus = { isActive: false, title: 'Wellness Challenge Campaign Ended' };
  participants.forEach(p => { p.stamps = p.stamps ? p.stamps.filter(s => s.scanCode?.startsWith('HIKING-') || s.scanCode?.startsWith('RUNNING-')) : []; });
  res.json({ status: challengeStatus });
});

app.post('/api/admin/hiking-status/start', (req, res) => {
  const { startDate, endDate } = req.body;
  hikingStatus = { isActive: true, title: 'Active Hiking Season Campaign', startDate: startDate || new Date().toISOString(), endDate: endDate || '' };
  res.json({ status: hikingStatus });
});

app.post('/api/admin/hiking-status/end', (req, res) => {
  hikingStatus = { isActive: false, title: 'Hiking Season Ended' };
  participants.forEach(p => { p.stamps = p.stamps ? p.stamps.filter(s => !s.scanCode?.startsWith('HIKING-')) : []; });
  res.json({ status: hikingStatus });
});

app.post('/api/admin/running-status/start', (req, res) => {
  const { startDate, endDate } = req.body;
  runningStatus = { isActive: true, title: 'Active Running Season Campaign', startDate: startDate || new Date().toISOString(), endDate: endDate || '' };
  res.json({ status: runningStatus });
});

app.post('/api/admin/running-status/end', (req, res) => {
  runningStatus = { isActive: false, title: 'Running Season Ended' };
  participants.forEach(p => { p.stamps = p.stamps ? p.stamps.filter(s => !s.scanCode?.startsWith('RUNNING-')) : []; });
  res.json({ status: runningStatus });
});

app.post('/api/admin/challenges', (req, res) => {
  const { title, description, points, eventDate } = req.body;
  const newCh = { id: String(Date.now()), title, description, points: Number(points) || 10, eventDate: eventDate || '', scanCode: `WELLNESS-SPEC-${Date.now().toString().slice(-4)}` };
  specialChallenges.push(newCh);
  res.status(201).json({ challenge: newCh });
});

app.delete('/api/admin/challenges/:id', (req, res) => {
  specialChallenges = specialChallenges.filter(c => c.id !== req.params.id);
  res.json({ message: 'Deleted' });
});

app.post('/api/admin/hiking-challenges', (req, res) => {
  const { title, description, points, eventDate } = req.body;
  const newCh = { id: String(Date.now()), title, description, points: Number(points) || 15, eventDate: eventDate || '', scanCode: `HIKING-SPEC-${Date.now().toString().slice(-4)}` };
  hikingChallenges.push(newCh);
  res.status(201).json({ challenge: newCh });
});

app.delete('/api/admin/hiking-challenges/:id', (req, res) => {
  hikingChallenges = hikingChallenges.filter(c => c.id !== req.params.id);
  res.json({ message: 'Deleted' });
});

app.post('/api/admin/running-challenges', (req, res) => {
  const { title, description, points, eventDate } = req.body;
  const newCh = { id: String(Date.now()), title, description, points: Number(points) || 12, eventDate: eventDate || '', scanCode: `RUNNING-SPEC-${Date.now().toString().slice(-4)}` };
  runningChallenges.push(newCh);
  res.status(201).json({ challenge: newCh });
});

app.delete('/api/admin/running-challenges/:id', (req, res) => {
  runningChallenges = runningChallenges.filter(c => c.id !== req.params.id);
  res.json({ message: 'Deleted' });
});

// Community Feed
app.get('/api/admin/community', (req, res) => res.json({ posts: communityPosts }));
app.post('/api/admin/community', (req, res) => {
  const { author, role, message, image, isAnnouncement } = req.body;
  const newPost = { id: String(Date.now()), author, role: role || 'participant', message: message || '', image: image || '', isAnnouncement: Boolean(isAnnouncement), createdAt: new Date().toISOString() };
  communityPosts = [newPost, ...communityPosts];
  res.status(201).json({ post: newPost });
});

app.delete('/api/admin/community/:id', (req, res) => {
  communityPosts = communityPosts.filter(p => p.id !== req.params.id);
  res.json({ message: 'Deleted' });
});

// Stats & QR Catalog
app.get('/api/admin/stats', (req, res) => {
  const totalParticipants = participants.length;
  const activeParticipants = participants.filter(p => (p.stamps || []).length > 0).length;
  const totalStamps = participants.reduce((sum, p) => sum + (p.stamps || []).length, 0);
  const totalPoints = participants.reduce((sum, p) => sum + (p.stamps || []).reduce((s, st) => s + Number(st.points || 0), 0), 0);

  res.json({ stats: { totalParticipants, activeParticipants, totalStamps, totalPoints } });
});

app.get('/api/admin/qr-codes', async (req, res) => {
  try {
    const qrCodes = await getQrCodeCatalog();
    res.json({ qrCodes });
  } catch (err) {
    console.error('Error serving QR catalog:', err);
    res.status(500).json({ message: 'Failed to generate QR catalog.' });
  }
});

app.post('/api/admin/participants/:id/promote', (req, res) => {
  const user = participants.find(p => p.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  user.role = 'admin';
  res.json({ message: `${user.fullName} is now an admin.` });
});

app.delete('/api/admin/participants/:id', (req, res) => {
  participants = participants.filter(p => p.id !== req.params.id);
  res.json({ message: 'User deleted.' });
});

// Static Production Hosting & No-Cache Rules
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
