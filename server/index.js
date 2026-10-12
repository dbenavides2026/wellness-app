import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'participants.json');
const adminsDbPath = path.join(dataDir, 'admins.json');
const communityDbPath = path.join(dataDir, 'community.json');
const specialChallengesDbPath = path.join(dataDir, 'special-challenges.json');
const challengeStatusPath = path.join(dataDir, 'challenge-status.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
}

if (!fs.existsSync(adminsDbPath)) {
  fs.writeFileSync(adminsDbPath, JSON.stringify([], null, 2));
}

if (!fs.existsSync(communityDbPath)) {
  fs.writeFileSync(communityDbPath, JSON.stringify([
    {
      id: crypto.randomUUID(),
      author: 'Roche Wellness Team',
      role: 'admin',
      message: 'Welcome to the Wellness Community — share wins, workouts, and encouragement with the team.',
      image: '',
      isAnnouncement: true,
      createdAt: new Date().toISOString()
    }
  ], null, 2));
}

const defaultSpecialChallenges = [
  {
    id: crypto.randomUUID(),
    title: '10K Steps Sprint',
    description: 'Complete 10,000 steps across the week and log your movement with proof.',
    points: 10,
    scanCode: 'ROCHE-CHALLENGE-STEPS',
    proofPrompt: 'Upload a photo showing your steps challenge progress or movement moment.'
  },
  {
    id: crypto.randomUUID(),
    title: 'Team Energy Boost',
    description: 'Join a team wellness activity and share a photo check-in from the session.',
    points: 10,
    scanCode: 'ROCHE-CHALLENGE-TEAM',
    proofPrompt: 'Upload a photo of your team workout, class, or group challenge moment.'
  },
  {
    id: crypto.randomUUID(),
    title: 'Outdoor Move',
    description: 'Take part in an outdoor or sport challenge and submit proof of your activity.',
    points: 10,
    scanCode: 'ROCHE-CHALLENGE-OUTDOOR',
    proofPrompt: 'Upload a photo of your outdoor session, sport, or active challenge.'
  }
];

if (!fs.existsSync(specialChallengesDbPath)) {
  fs.writeFileSync(specialChallengesDbPath, JSON.stringify(defaultSpecialChallenges, null, 2));
}

const defaultChallengeStatus = {
  isActive: false,
  title: 'No active challenge',
  startedAt: '',
  endedAt: ''
};

if (!fs.existsSync(challengeStatusPath)) {
  fs.writeFileSync(challengeStatusPath, JSON.stringify(defaultChallengeStatus, null, 2));
}

const app = express();
// ASIGNACIÓN DINÁMICA DE PUERTO PARA RENDER
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

const readJson = (filePath, fallback = []) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) || fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
};

const readParticipants = () => readJson(dbPath, []);
const writeParticipants = (participants) => writeJson(dbPath, participants);
const readAdmins = () => readJson(adminsDbPath, []);
const writeAdmins = (admins) => writeJson(adminsDbPath, admins);
const readCommunityPosts = () => readJson(communityDbPath, []);
const writeCommunityPosts = (posts) => writeJson(communityDbPath, posts);
const readSpecialChallenges = () => readJson(specialChallengesDbPath, defaultSpecialChallenges);
const writeSpecialChallenges = (challenges) => writeJson(specialChallengesDbPath, challenges);
const readChallengeStatus = () => readJson(challengeStatusPath, defaultChallengeStatus);
const writeChallengeStatus = (status) => writeJson(challengeStatusPath, status);

const SUPERADMIN_EMAIL = 'superadmin@roche.com';
const SUPERADMIN_PASSWORD = 'DigitalPassport*2026';

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, passwordPlain, ...rest } = user;
  return
