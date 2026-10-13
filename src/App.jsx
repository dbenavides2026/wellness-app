import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle2,
  Dumbbell,
  Edit,
  Lock,
  Trash2,
  IdCard,
  LogIn,
  LogOut,
  Mail,
  PlusCircle,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
  UserPlus,
  Users,
  Mountain,
  User,
  Home as HomeIcon,
  Download,
  ShieldAlert,
  BarChart2,
  FileText,
  QrCode,
  MessageSquare
} from 'lucide-react';
import './App.css';

const CURRENT_USER_KEY = 'wellness-passport-current-user';
const ADMIN_USER_KEY = 'wellness-passport-admin-user';

const categories = [
  { id: 'gym', title: 'Gym / Solo Workout', points: 1, iconType: 'dumbbell', scanCode: 'WELLNESS-GYM-101', proofPrompt: 'Upload a picture of your workout setup or equipment log.' },
  { id: 'group', title: 'Group Fitness Class', points: 2, iconType: 'users', scanCode: 'WELLNESS-GROUP-202', proofPrompt: 'Upload a picture of your class attendance or workout scene.' },
  { id: 'sports', title: 'Sports & Outdoor Game', points: 2, iconType: 'trophy', scanCode: 'WELLNESS-SPORTS-303', proofPrompt: 'Upload a picture of your activity, match, or hike.' }
];

const hikingCategories = [
  { id: 'hiking-club-checkin', title: 'Hiking Club Expedition', points: 1, iconType: 'mountain', scanCode: 'HIKING-CLUB-101', proofPrompt: 'Upload a picture from your trail or summit check-in.' }
];

const runningCategories = [
  { id: 'running-club-checkin', title: 'Running Club Session', points: 1, iconType: 'trophy', scanCode: 'RUNNING-CLUB-101', proofPrompt: 'Upload a picture from your running session.' }
];

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Request failed');
  return payload;
}

export default function App() {
  const [participants, setParticipants] = useState([]);
  const [adminStats, setAdminStats] = useState({ stats: {}, recentActivity: [] });
  const [adminQrCodes, setAdminQrCodes] = useState([]);
  const [adminReport, setAdminReport] = useState([]);
  const [reportCategory, setReportCategory] = useState('all');
  const [editingParticipantId, setEditingParticipantId] = useState(null);
  const [editingParticipantDraft, setEditingParticipantDraft] = useState({ fullName: '', email: '', role: 'participant' });
  const [adminCommunityPosts, setAdminCommunityPosts] = useState([]);
  const [adminCommunityDraft, setAdminCommunityDraft] = useState({ message: '', image: '', isAnnouncement: true });
  const [editingCommunityId, setEditingCommunityId] = useState(null);
  const [editingCommunityDraft, setEditingCommunityDraft] = useState({ message: '' });

  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityDraft, setCommunityDraft] = useState({ message: '', image: '' });
  const [screen, setScreen] = useState('login');

  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem(CURRENT_USER_KEY)) || null; } catch { return null; }
  });
  const [adminUser, setAdminUser] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem(ADMIN_USER_KEY)) || null; } catch { return null; }
  });

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [adminLoginForm, setAdminLoginForm] = useState({ email: '', password: '' });
  const [activePortalTab, setActivePortalTab] = useState('home');
  const [adminTab, setAdminTab] = useState('admin');
  const [authMessage, setAuthMessage] = useState('');
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [adminMessage, setAdminMessage] = useState('');

  const [specialChallenges, setSpecialChallenges] = useState([]);
  const [challengeStatus, setChallengeStatus] = useState({ isActive: false, title: 'No active challenge' });
  const [hikingChallenges, setHikingChallenges] = useState([]);
  const [hikingStatus, setHikingStatus] = useState({ isActive: false, title: 'No active hiking season' });
  const [runningChallenges, setRunningChallenges] = useState([]);
  const [runningStatus, setRunningStatus] = useState({ isActive: false, title: 'No active running season' });

  const [challengeForm, setChallengeForm] = useState({ title: '', description: '', points: 10, scanCode: '', proofPrompt: '' });
  const [hikingForm, setHikingForm] = useState({ title: '', description: '', points: 15, scanCode: '', proofPrompt: '' });
  const [runningForm, setRunningForm] = useState({ title: '', description: '', points: 12, scanCode: '', proofPrompt: '' });

  const [categorySelections, setCategorySelections] = useState({});
  const [scanEntries, setScanEntries] = useState({});
  const [proofs, setProofs] = useState({});
  const [scannerCategoryId, setScannerCategoryId] = useState(null);
  const [scannerError, setScannerError] = useState('');
  const [formError, setFormError] = useState('');

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ fullName: '', email: '', password: '', profileImage: '' });
  const [profileMsg, setProfileMsg] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const stamps = currentUser?.stamps || [];
  const wellnessStamps = stamps.filter(s => !s.scanCode?.startsWith('HIKING-') && !s.scanCode?.startsWith('RUNNING-'));
  const hikingStamps = stamps.filter(s => s.scanCode?.startsWith('HIKING-'));
  const runningStamps = stamps.filter(s => s.scanCode?.startsWith('RUNNING-'));

  const wellnessPoints = wellnessStamps.reduce((sum, s) => sum + Number(s.points || 0), 0);
  const hikingPoints = hikingStamps.reduce((sum, s) => sum + Number(s.points || 0), 0);
  const runningPoints = runningStamps.reduce((sum, s) => sum + Number(s.points || 0), 0);
  const totalPoints = wellnessPoints + hikingPoints + runningPoints;

  const refreshAllData = async () => {
    try {
      const t = Date.now();
      const [parts, comms, chs, status, hChs, hStatus, rChs, rStatus] = await Promise.all([
        fetchJson(`/api/participants?t=${t}`),
        fetchJson(`/api/admin/community?t=${t}`),
        fetchJson(`/api/challenges?t=${t}`),
        fetchJson(`/api/admin/challenge-status?t=${t}`),
        fetchJson(`/api/hiking-challenges?t=${t}`),
        fetchJson(`/api/admin/hiking-status?t=${t}`),
        fetchJson(`/api/running-challenges?t=${t}`),
        fetchJson(`/api/admin/running-status?t=${t}`)
      ]);

      const updatedParticipants = parts.participants || [];
      setParticipants(updatedParticipants);
      setCommunityPosts(comms.posts || []);
      setAdminCommunityPosts(comms.posts || []);
      setSpecialChallenges(chs.challenges || []);
      setChallengeStatus(status.status || { isActive: false });
      setHikingChallenges(hChs.challenges || []);
      setHikingStatus(hStatus.status || { isActive: false });
      setRunningChallenges(rChs.challenges || []);
      setRunningStatus(rStatus.status || { isActive: false });

      if (currentUser?.id) {
        const freshUser = updatedParticipants.find((p) => p.id === currentUser.id);
        if (freshUser) setCurrentUser(freshUser);
      }
    } catch (e) {
      console.error('Data refresh error', e);
    }
  };

  const refreshAdminData = async () => {
    try {
      const t = Date.now();
      const [stats, qrs, rep] = await Promise.all([
        fetchJson(`/api/admin/stats?t=${t}`),
        fetchJson(`/api/admin/qr-codes?t=${t}`),
        fetchJson(`/api/admin/report?t=${t}`)
      ]);
      setAdminStats(stats || { stats: {}, recentActivity: [] });
      setAdminQrCodes(qrs.qrCodes || []);
      setAdminReport(rep.report || []);
    } catch (e) {
      console.error('Admin data error', e);
    }
  };

  useEffect(() => {
    refreshAllData();
    const interval = setInterval(() => {
      refreshAllData();
      if (adminUser) refreshAdminData();
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAllData();
        if (adminUser) refreshAdminData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [currentUser?.id, adminUser?.id]);

  useEffect(() => { if (adminUser) refreshAdminData(); }, [adminUser]);

  useEffect(() => {
    if (currentUser) {
      window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
      setProfileDraft({ fullName: currentUser.fullName || '', email: currentUser.email || '', password: '', profileImage: currentUser.profileImage || '' });
    } else window.localStorage.removeItem(CURRENT_USER_KEY);
  }, [currentUser]);

  useEffect(() => {
    if (adminUser) window.localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(adminUser));
    else window.localStorage.removeItem(ADMIN_USER_KEY);
  }, [adminUser]);

  useEffect(() => {
    if (currentUser && (screen === 'login' || screen === 'register')) setScreen('dashboard');
    if (adminUser && (screen === 'login' || screen === 'register' || screen === 'admin-login')) setScreen('admin-dashboard');
  }, [currentUser, adminUser, screen]);

  const addStampWithCode = async (activity, directCode = '') => {
    if (!currentUser) return;
    const codeToSend = (directCode || scanEntries[activity.id] || '').trim().toUpperCase();
    const expectedCode = (activity.scanCode || '').trim().toUpperCase();

    if (!codeToSend) { setFormError('No QR code detected. Please scan the QR code first.'); return; }
    if (expectedCode && codeToSend !== expectedCode) {
      setFormError(`Invalid QR code. Scanned "${codeToSend}", but "${activity.title}" requires "${expectedCode}".`);
      return;
    }

    try {
      const res = await fetchJson(`/api/participants/${currentUser.id}/stamps`, {
        method: 'POST',
        body: JSON.stringify({ title: activity.title, points: activity.points, categoryId: activity.id || 'general', scanCode: codeToSend })
      });

      if (res.user) {
        setCurrentUser(res.user);
        setFormError('');
        setProofs((p) => { const n = { ...p }; delete n[activity.id]; return n; });
        setScanEntries((p) => { const n = { ...p }; delete n[activity.id]; return n; });
        confetti({ particleCount: 55, spread: 60, origin: { y: 0.8 } });

        const autoMessage = `🎉 ${currentUser.fullName} logged activity "${activity.title}" and earned +${activity.points} pts!`;
        const imageProof = proofs[activity.id] || '';

        await fetchJson('/api/admin/community', {
          method: 'POST',
          body: JSON.stringify({ author: currentUser.fullName, role: 'participant', message: autoMessage, image: imageProof, isAnnouncement: false })
        }).catch((err) => console.error('Auto community post error:', err));

        await refreshAllData();
      }
    } catch (err) { setFormError(err.message || 'Unable to save activity.'); }
  };

  const addStamp = (activity) => addStampWithCode(activity, scanEntries[activity.id]);

  useEffect(() => {
    if (!scannerCategoryId) return undefined;
    let animId = 0, cancelled = false;

    const stopStream = () => {
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const scanFrame = () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v && c && v.readyState >= 2) {
        const ctx = c.getContext('2d');
        c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const decoded = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);

        if (decoded) {
          const val = decoded.data.trim().toUpperCase();
          const targetCategory = categories.find((cat) => cat.id === scannerCategoryId)
            || hikingCategories.find((hc) => hc.id === scannerCategoryId)
            || runningCategories.find((rc) => rc.id === scannerCategoryId)
            || specialChallenges.find((sc) => sc.id === scannerCategoryId)
            || hikingChallenges.find((hc) => hc.id === scannerCategoryId)
            || runningChallenges.find((rc) => rc.id === scannerCategoryId);

          const expected = (targetCategory?.scanCode || '').trim().toUpperCase();

          if (expected && val !== expected) {
            setScannerError(`Invalid QR code! Scanned "${val}", but requires "${expected}".`);
            if (!cancelled) animId = window.requestAnimationFrame(scanFrame);
            return;
          }

          setScanEntries((prev) => ({ ...prev, [scannerCategoryId]: val }));
          setCategorySelections((prev) => ({ ...prev, [scannerCategoryId]: { method:
