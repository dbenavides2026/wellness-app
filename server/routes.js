import express from 'express';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import {
  readParticipants, writeParticipants, readAdmins, writeAdmins,
  readCommunityPosts, writeCommunityPosts, readSpecialChallenges, writeSpecialChallenges,
  readChallengeStatus, writeChallengeStatus, sanitizeUser, normalizeEmail, SUPERADMIN_EMAIL
} from './db.js';

const router = express.Router();

const categoryQrConfigurations = [
  { id: 'gym', title: 'Gym / Solo Workout', points: 1, code: 'ROCHE-GYM-101' },
  { id: 'group', title: 'Group Fitness Class', points: 2, code: 'ROCHE-GROUP-202' },
  { id: 'sports', title: 'Sports & Outdoor Game', points: 2, code: 'ROCHE-SPORTS-303' }
];

const buildQrCatalog = async () => {
  const specialChallenges = readSpecialChallenges();
  const challengeItems = await Promise.all(specialChallenges.map(async (ch) => ({
    id: ch.id, title: ch.title, points: Number(ch.points || 10), code: ch.scanCode,
    qrCode: await QRCode.toDataURL(ch.scanCode, { margin: 1, width: 420, color: { dark: '#0f172a', light: '#ffffff' } })
  })));
  const items = await Promise.all(categoryQrConfigurations.map(async (cat) => ({
    ...cat, qrCode: await QRCode.toDataURL(cat.code, { margin: 1, width: 420, color: { dark: '#0f172a', light: '#ffffff' } })
  })));
  return [...items, ...challengeItems];
};

router.get('/health', (_req, res) => res.json({ ok: true, service: 'wellness-passport-api' }));
router.get('/participants', (_req, res) => res.json({ participants: readParticipants().map(sanitizeUser) }));

router.post('/register', async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!fullName || !email || !password) return res.status(400).json({ message: 'Complete all fields.' });
    if (!email.endsWith('@roche.com')) return res.status(400).json({ message: 'Use @roche.com email.' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be 6+ chars.' });

    const participants = readParticipants();
    if (participants.some((p) => normalizeEmail(p.email) === email)) return res.status(409).json({ message: 'Email registered.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = { id: crypto.randomUUID(), fullName, email, password: passwordHash, passwordPlain: password, stamps: [] };
    participants.push(user);
    writeParticipants(participants);
    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) { return res.status(500).json({ message: error.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const participants = readParticipants();
    const match = participants.find((p) => normalizeEmail(p.email) === email);
    if (!match || !(await bcrypt.compare(password, match.password))) return res.status(401).json({ message: 'Invalid credentials.' });
    if (!match.passwordPlain) { match.passwordPlain = password; writeParticipants(participants); }
    return res.json({ user: sanitizeUser(match) });
  } catch (error) { return res.status(500).json({ message: error.message }); }
});

router.post('/forgot-password', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const match = readParticipants().find((p) => normalizeEmail(p.email) === email);
  if (!match) return res.status(404).json({ message: 'User not found.' });
  return res.json({ email: match.email, password: match.passwordPlain });
});

router.post('/admin/forgot-password', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const match = readAdmins().find((a) => normalizeEmail(a.email) === email);
  if (!match) return res.status(404).json({ message: 'Admin not found.' });
  return res.json({ email: match.email, password: match.passwordPlain });
});

router.post('/admin/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const match = readAdmins().find((a) => normalizeEmail(a.email) === email);
  if (!match || !(await bcrypt.compare(password, match.password))) return res.status(401).json({ message: 'Invalid admin credentials.' });
  return res.json({ user: sanitizeUser(match) });
});

router.get('/admin/qr-codes', async (_req, res) => res.json({ qrCodes: await buildQrCatalog() }));

router.get('/admin/stats', (_req, res) => {
  const participants = readParticipants();
  const totalParticipants = participants.length;
  const totalStamps = participants.reduce((sum, p) => sum + ((p.stamps || []).length), 0);
  const totalPoints = participants.reduce((sum, p) => sum + (p.stamps || []).reduce((s, st) => s + Number(st.points || 0), 0), 0);
  return res.json({ stats: { totalParticipants, totalStamps, totalPoints, activeParticipants: participants.filter((p) => (p.stamps || []).length > 0).length } });
});

router.get('/challenges', (_req, res) => res.json({ challenges: readSpecialChallenges() }));
router.get('/admin/challenge-status', (_req, res) => res.json({ status: readChallengeStatus() }));

router.post('/participants/:id/stamps', (req, res) => {
  const { id } = req.params;
  const participants = readParticipants();
  const idx = participants.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ message: 'User not found.' });
  const stamp = { id: crypto.randomUUID(), title: req.body.title, points: Number(req.body.points || 0), categoryId: req.body.categoryId, date: new Date().toISOString() };
  participants[idx].stamps = [stamp, ...(participants[idx].stamps || [])];
  writeParticipants(participants);
  return res.json({ user: sanitizeUser(participants[idx]) });
});

export default router;
