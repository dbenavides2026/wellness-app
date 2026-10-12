import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import jsQR from 'jsqr';
import {
  Camera, CheckCircle2, Dumbbell, Edit, Lock, Trash2, IdCard, LogIn, LogOut,
  Mail, PlusCircle, ScanLine, ShieldCheck, Sparkles, Trophy, Upload, UserPlus, Users
} from 'lucide-react';
import './App.css';

const CURRENT_USER_KEY = 'wellness-passport-current-user';
const ADMIN_USER_KEY = 'wellness-passport-admin-user';

const defaultCategories = [
  { id: 'gym', title: 'Gym / Solo Workout', points: 1, iconType: 'dumbbell', scanCode: 'WELLNESS-GYM-101', proofPrompt: 'Upload a photo of your workout setup.' },
  { id: 'group', title: 'Group Fitness Class', points: 2, iconType: 'users', scanCode: 'WELLNESS-GROUP-202', proofPrompt: 'Upload a photo of class attendance.' },
  { id: 'sports', title: 'Sports & Outdoor Game', points: 2, iconType: 'trophy', scanCode: 'WELLNESS-SPORTS-303', proofPrompt: 'Upload a photo of your activity.' }
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
  const [editingParticipantId, setEditingParticipantId] = useState(null);
  const [editingParticipantDraft, setEditingParticipantDraft] = useState({ fullName: '', email: '', role: 'participant' });
  const [adminCommunityPosts, setAdminCommunityPosts] = useState([]);
  const [adminCommunityDraft, setAdminCommunityDraft] = useState({ message: '', image: '', isAnnouncement: true });
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityDraft, setCommunityDraft] = useState({ message: '', image: '' });
  const [accountDraft, setAccountDraft] = useState({ fullName: '', email: '', password: '', profileImage: '' });
  const [accountMessage, setAccountMessage] = useState('');
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
  const [activePortalTab, setActivePortalTab] = useState('passport');
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [adminTab, setAdminTab] = useState('admin');
  const [authMessage, setAuthMessage] = useState('');
  const [passwordRecoveryEmail, setPasswordRecoveryEmail] = useState('');
  const [passwordRecoveryOpen, setPasswordRecoveryOpen] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [specialChallenges, setSpecialChallenges] = useState([]);
  const [challengeStatus, setChallengeStatus] = useState({ isActive: false, title: 'No active challenge', startedAt: '', endedAt: '' });
  const [challengeForm, setChallengeForm] = useState({ title: '', description: '', points: 10, scanCode: '', proofPrompt: '' });
  const [editingChallengeId, setEditingChallengeId] = useState(null);
  const [categorySelections, setCategorySelections] = useState({});
  const [scanEntries, setScanEntries] = useState({});
  const [proofs, setProofs] = useState({});
  const [scannerCategoryId, setScannerCategoryId] = useState(null);
  const [scannerError, setScannerError] = useState('');
  const [formError, setFormError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const points = currentUser?.stamps?.reduce((total, stamp) => total + Number(stamp.points || 0), 0) || 0;
  const noCampaignMessage = 'A new challenge campaign has not started yet. Activity logging is disabled until the wellness team creates and activates a campaign.';

  const refreshAllData = async () => {
    try {
      const [parts, comms, chs, status] = await Promise.all([
        fetchJson('/api/participants'),
        fetchJson('/api/admin/community'),
        fetchJson('/api/challenges'),
        fetchJson('/api/admin/challenge-status')
      ]);

      const updatedParticipants = parts.participants || [];
      setParticipants(updatedParticipants);
      setCommunityPosts(comms.posts || []);
      setAdminCommunityPosts(comms.posts || []);
      setSpecialChallenges(chs.challenges || []);
      setChallengeStatus(status.status || { isActive: false, title: 'No active challenge' });

      if (currentUser?.id) {
        const freshUser = updatedParticipants.find((p) => p.id === currentUser.id);
        if (freshUser) {
          setCurrentUser(freshUser);
        }
      }
    } catch (e) { console.error('Data refresh error', e); }
  };

  const refreshAdminData = async () => {
    try {
      const [stats, qrs, rep] = await Promise.all([
        fetchJson('/api/admin/stats'),
        fetchJson('/api/admin/qr-codes'),
        fetchJson('/api/admin/report')
      ]);
      setAdminStats(stats || { stats: {}, recentActivity: [] });
      setAdminQrCodes(qrs.qrCodes || []);
      setAdminReport(rep.report || []);
    } catch (e) { console.error('Admin data error', e); }
  };

  useEffect(() => {
    refreshAllData();
    const interval = setInterval(() => {
      refreshAllData();
      if (adminUser) refreshAdminData();
    }, 5000);

    return () => clearInterval(interval);
  }, [currentUser?.id, adminUser?.id]);

  useEffect(() => { if (adminUser) refreshAdminData(); }, [adminUser]);

  useEffect(() => {
    if (currentUser) {
      window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
      setAccountDraft({ fullName: currentUser.fullName || '', email: currentUser.email || '', password: '', profileImage: currentUser.profileImage || '' });
    } else window.localStorage.removeItem(CURRENT_USER_KEY);
  }, [currentUser]);

  useEffect(() => {
    if (adminUser) window.localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(adminUser));
    else window.localStorage.removeItem(ADMIN_USER_KEY);
  }, [adminUser]);

  useEffect(() => {
    if (currentUser && ['login', 'register'].includes(screen)) setScreen('dashboard');
    if (adminUser && ['login', 'register', 'admin-login'].includes(screen)) setScreen('admin-dashboard');
  }, [currentUser, adminUser, screen]);

  // Scanner Logic
  useEffect(() => {
    if (!scannerCategoryId) return undefined;
    let animId = 0, cancelled = false;
    const stopStream = () => {
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    const scanFrame = () => {
      const v = videoRef.current, c = canvasRef.current;
      if (v && c && v.readyState >= 2) {
        const ctx = c.getContext('2d');
        c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const decoded = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
        if (decoded) {
          const val = decoded.data.trim().toUpperCase();
          setScanEntries((prev) => ({ ...prev, [scannerCategoryId]: val }));
          setCategorySelections((prev) => ({ ...prev, [scannerCategoryId]: { method: 'scan' } }));
          stopStream(); setScannerCategoryId(null); setScannerError('');
          return;
        }
      }
      if (!cancelled) animId = window.requestAnimationFrame(scanFrame);
    };
    const startScanner = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        scanFrame();
      } catch (err) {
        if (!cancelled) { setScannerError(err.message || 'Unable to access camera.'); setScannerCategoryId(null); }
      }
    };
    startScanner();
    return () => { cancelled = true; window.cancelAnimationFrame(animId); stopStream(); };
  }, [scannerCategoryId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchJson('/api/login', { method: 'POST', body: JSON.stringify({ email: loginForm.email.trim().toLowerCase(), password: loginForm.password }) });
      setCurrentUser(res.user); setAuthMessage(''); setScreen('dashboard'); refreshAllData();
    } catch (err) { setAuthMessage(err.message); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) { setRegistrationMessage('Passwords do not match.'); return; }
    try {
      await fetchJson('/api/register', { method: 'POST', body: JSON.stringify({ fullName: registerForm.fullName.trim(), email: registerForm.email.trim().toLowerCase(), password: registerForm.password }) });
      setScreen('login'); setAuthMessage('Registration successful. Please log in.');
    } catch (err) { setRegistrationMessage(err.message); }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchJson('/api/admin/login', { method: 'POST', body: JSON.stringify({ email: adminLoginForm.email.trim().toLowerCase(), password: adminLoginForm.password }) });
      setAdminUser(res.user); setAdminMessage(''); setScreen('admin-dashboard');
    } catch (err) { setAdminMessage(err.message); }
  };

  const handleSaveSpecialChallenge = async () => {
    const title = challengeForm.title.trim();
    const description = challengeForm.description.trim();
    if (!title || !description) { setAdminMessage('Title and description are required.'); return; }

    try {
      const method = editingChallengeId ? 'PUT' : 'POST';
      const url = editingChallengeId ? `/api/admin/challenges/${editingChallengeId}` : '/api/admin/challenges';
      await fetchJson(url, {
        method,
        body: JSON.stringify({
          ...challengeForm,
          points: Number(challengeForm.points) || 10,
          proofPrompt: challengeForm.proofPrompt || 'Upload a photo.'
        })
      });
      setChallengeForm({ title: '', description: '', points: 10, scanCode: '', proofPrompt: '' });
      setEditingChallengeId(null);
      setAdminMessage('Special activity saved successfully.');
      await refreshAllData();
      await refreshAdminData();
    } catch (err) { setAdminMessage(err.message); }
  };

  const addStamp = async (activity) => {
    if (!currentUser) return;
    try {
      const res = await fetchJson(`/api/participants/${currentUser.id}/stamps`, {
        method: 'POST',
        body: JSON.stringify({
          title: activity.title,
          points: activity.points,
          categoryId: activity.id || 'special',
          scanCode: scanEntries[activity.id] || activity.scanCode || ''
        })
      });
      setCurrentUser(res.user); setFormError('');
      setProofs((p) => { const n = { ...p }; delete n[activity.id]; return n; });
      setScanEntries((p) => { const n = { ...p }; delete n[activity.id]; return n; });
      confetti({ particleCount: 55, spread: 60, origin: { y: 0.8 } });
      await refreshAllData();
    } catch (err) { setFormError(err.message); }
  };

  if (screen === 'login') return (
    <div className="auth-app"><div className="auth-card">
      <div className="
