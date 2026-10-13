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
          setCategorySelections((prev) => ({ ...prev, [scannerCategoryId]: { method: 'scan' } }));
          stopStream();
          setScannerCategoryId(null);
          setScannerError('');

          addStampWithCode(targetCategory, val);
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
  }, [scannerCategoryId, specialChallenges, hikingChallenges, runningChallenges]);

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

  const handleProfileSave = async (e) => {
    e.preventDefault(); setProfileMsg('');
    try {
      const res = await fetchJson(`/api/participants/${currentUser.id}/profile`, { method: 'PUT', body: JSON.stringify(profileDraft) });
      setCurrentUser(res.user); setProfileMsg('Profile updated successfully!'); await refreshAllData();
    } catch (err) { setProfileMsg(err.message || 'Unable to update profile.'); }
  };

  const handleImageUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfileDraft((p) => ({ ...p, profileImage: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchJson('/api/admin/login', { method: 'POST', body: JSON.stringify({ email: adminLoginForm.email.trim().toLowerCase(), password: adminLoginForm.password }) });
      setAdminUser(res.user); setAdminMessage(''); setScreen('admin-dashboard');
    } catch (err) { setAdminMessage(err.message); }
  };

  const promoteParticipantToAdmin = async (participant) => {
    try {
      const response = await fetchJson(`/api/admin/participants/${participant.id}/promote`, { method: 'POST', body: JSON.stringify({}) });
      setAdminMessage(response.message || `${participant.fullName} promoted to admin.`); await refreshAllData(); await refreshAdminData();
    } catch (error) { setAdminMessage(error.message || 'Unable to promote user.'); }
  };

  const handleSaveUser = async () => {
    try {
      await fetchJson(`/api/admin/participants/${editingParticipantId}`, { method: 'PUT', body: JSON.stringify(editingParticipantDraft) });
      setEditingParticipantId(null); setAdminMessage('User updated successfully.'); await refreshAllData(); await refreshAdminData();
    } catch (error) { setAdminMessage(error.message || 'Unable to update user.'); }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await fetchJson(`/api/admin/participants/${userId}`, { method: 'DELETE' });
      setAdminMessage('User deleted successfully.'); await refreshAllData(); await refreshAdminData();
    } catch (error) { setAdminMessage(error.message || 'Unable to delete user.'); }
  };

  const handleDeleteSpecialActivity = async (id) => {
    if (!window.confirm('Delete this special activity?')) return;
    try {
      await fetchJson(`/api/admin/challenges/${id}`, { method: 'DELETE' });
      setAdminMessage('Special activity deleted.'); await refreshAllData(); await refreshAdminData();
    } catch (error) { setAdminMessage(error.message || 'Unable to delete activity.'); }
  };

  const handleDeleteHikingActivity = async (id) => {
    if (!window.confirm('Delete this hiking activity?')) return;
    try {
      await fetchJson(`/api/admin/hiking-challenges/${id}`, { method: 'DELETE' });
      setAdminMessage('Hiking activity deleted.'); await refreshAllData(); await refreshAdminData();
    } catch (error) { setAdminMessage(error.message || 'Unable to delete activity.'); }
  };

  const handleDeleteRunningActivity = async (id) => {
    if (!window.confirm('Delete this running activity?')) return;
    try {
      await fetchJson(`/api/admin/running-challenges/${id}`, { method: 'DELETE' });
      setAdminMessage('Running activity deleted.'); await refreshAllData(); await refreshAdminData();
    } catch (error) { setAdminMessage(error.message || 'Unable to delete activity.'); }
  };

  const handleLogout = () => {
    setCurrentUser(null); setScreen('login'); setAuthMessage(''); setFormError(''); setProofs({}); setScanEntries({}); setCategorySelections({});
  };

  const handleAdminLogout = () => { setAdminUser(null); setScreen('login'); setAdminMessage(''); };

  const handleCommunityPostSubmit = async () => {
    const message = communityDraft.message.trim();
    if (!message && !communityDraft.image) return;
    const author = currentUser?.fullName || adminUser?.fullName || 'Community Member';
    const role = currentUser ? 'participant' : adminUser?.role || 'participant';

    try {
      await fetchJson('/api/admin/community', { method: 'POST', body: JSON.stringify({ author, role, message, image: communityDraft.image, isAnnouncement: false }) });
      setCommunityDraft({ message: '', image: '' });
      await refreshAllData();
    } catch (err) { console.error('Community submit error:', err); }
  };

  const handleAdminCommunityPostSubmit = async () => {
    const message = adminCommunityDraft.message.trim();
    if (!message && !adminCommunityDraft.image) { setAdminMessage('Add a message or photo to publish an update.'); return; }
    try {
      await fetchJson('/api/admin/community', { method: 'POST', body: JSON.stringify({ author: 'Wellness Team', role: 'admin', message, image: adminCommunityDraft.image, isAnnouncement: adminCommunityDraft.isAnnouncement }) });
      setAdminCommunityDraft({ message: '', image: '', isAnnouncement: true });
      setAdminMessage('Community update published successfully.');
      await refreshAllData();
    } catch (error) { setAdminMessage(error.message || 'Unable to save community update.'); }
  };

  const handleSaveCommunityEdit = async (id) => {
    try {
      await fetchJson(`/api/admin/community/${id}`, { method: 'PUT', body: JSON.stringify({ message: editingCommunityDraft.message }) });
      setEditingCommunityId(null); setAdminMessage('Community announcement updated.'); await refreshAllData();
    } catch (error) { setAdminMessage(error.message || 'Unable to update announcement.'); }
  };

  const handleDeleteCommunityPost = async (id) => {
    if (!window.confirm('Delete this community post?')) return;
    try {
      await fetchJson(`/api/admin/community/${id}`, { method: 'DELETE' });
      setAdminMessage('Post deleted.'); await refreshAllData();
    } catch (error) { setAdminMessage(error.message || 'Unable to delete post.'); }
  };

  const handleSaveSpecialChallenge = async () => {
    const title = challengeForm.title.trim(); const description = challengeForm.description.trim();
    if (!title || !description) { setAdminMessage('Activity name and description are required.'); return; }
    try {
      await fetchJson('/api/admin/challenges', { method: 'POST', body: JSON.stringify({ ...challengeForm, points: Number(challengeForm.points) || 10 }) });
      setChallengeForm({ title: '', description: '', points: 10, scanCode: '', proofPrompt: '' }); setAdminMessage('Special activity saved successfully.'); await refreshAllData(); await refreshAdminData();
    } catch (error) { setAdminMessage(error.message || 'Unable to save activity.'); }
  };

  const handleSaveHikingChallenge = async () => {
    const title = hikingForm.title.trim(); const description = hikingForm.description.trim();
    if (!title || !description) { setAdminMessage('Hiking title and description are required.'); return; }
    try {
      await fetchJson('/api/admin/hiking-challenges', { method: 'POST', body: JSON.stringify({ ...hikingForm, points: Number(hikingForm.points) || 15 }) });
      setHikingForm({ title: '', description: '', points: 15, scanCode: '', proofPrompt: '' }); setAdminMessage('Hiking activity saved successfully.'); await refreshAllData(); await refreshAdminData();
    } catch (error) { setAdminMessage(error.message || 'Unable to save hiking activity.'); }
  };

  const handleSaveRunningChallenge = async () => {
    const title = runningForm.title.trim(); const description = runningForm.description.trim();
    if (!title || !description) { setAdminMessage('Running title and description are required.'); return; }
    try {
      await fetchJson('/api/admin/running-challenges', { method: 'POST', body: JSON.stringify({ ...runningForm, points: Number(runningForm.points) || 12 }) });
      setRunningForm({ title: '', description: '', points: 12, scanCode: '', proofPrompt: '' }); setAdminMessage('Running activity saved successfully.'); await refreshAllData(); await refreshAdminData();
    } catch (error) { setAdminMessage(error.message || 'Unable to save running activity.'); }
  };

  const handleStartChallenge = async () => {
    try { const res = await fetchJson('/api/admin/challenge-status/start', { method: 'POST', body: JSON.stringify({ title: 'Active Wellness Challenge Campaign' }) }); setChallengeStatus(res.status); setAdminMessage('New Wellness Challenge campaign started.'); await refreshAllData(); } catch (err) { setAdminMessage(err.message); }
  };

  const handleEndChallenge = async () => {
    if (!window.confirm('Ending this campaign will reset all Wellness Challenge points and stamps. Proceed?')) return;
    try { const res = await fetchJson('/api/admin/challenge-status/end', { method: 'POST' }); setChallengeStatus(res.status); setAdminMessage('Wellness Challenge campaign ended. Points reset.'); await refreshAllData(); } catch (err) { setAdminMessage(err.message); }
  };

  const handleStartHikingSeason = async () => {
    try { const res = await fetchJson('/api/admin/hiking-status/start', { method: 'POST', body: JSON.stringify({ title: 'Active Hiking Season Campaign' }) }); setHikingStatus(res.status); setAdminMessage('New Hiking Season started.'); await refreshAllData(); } catch (err) { setAdminMessage(err.message); }
  };

  const handleEndHikingSeason = async () => {
    if (!window.confirm('Ending this campaign will reset all Hiking Club points and stamps. Proceed?')) return;
    try { const res = await fetchJson('/api/admin/hiking-status/end', { method: 'POST' }); setHikingStatus(res.status); setAdminMessage('Hiking Season ended. Points reset.'); await refreshAllData(); } catch (err) { setAdminMessage(err.message); }
  };

  const handleStartRunningSeason = async () => {
    try { const res = await fetchJson('/api/admin/running-status/start', { method: 'POST', body: JSON.stringify({ title: 'Active Running Season Campaign' }) }); setRunningStatus(res.status); setAdminMessage('New Running Season started.'); await refreshAllData(); } catch (err) { setAdminMessage(err.message); }
  };

  const handleEndRunningSeason = async () => {
    if (!window.confirm('Ending this campaign will reset all Running Club points and stamps. Proceed?')) return;
    try { const res = await fetchJson('/api/admin/running-status/end', { method: 'POST' }); setRunningStatus(res.status); setAdminMessage('Running Season ended. Points reset.'); await refreshAllData(); } catch (err) { setAdminMessage(err.message); }
  };

  const exportCategoryReportCsv = () => {
    const filterFn = reportCategory === 'wellness' 
      ? (s) => !s.scanCode?.startsWith('HIKING-') && !s.scanCode?.startsWith('RUNNING-')
      : reportCategory === 'hiking' 
      ? (s) => s.scanCode?.startsWith('HIKING-')
      : reportCategory === 'running'
      ? (s) => s.scanCode?.startsWith('RUNNING-')
      : () => true;

    const rows = participants.map((p) => {
      const filteredStamps = (p.stamps || []).filter(filterFn);
      const points = filteredStamps.reduce((s, st) => s + Number(st.points || 0), 0);
      const lastAct = filteredStamps.length ? new Date(filteredStamps[0].date).toLocaleString() : 'No activity';
      return [p.fullName, p.email, filteredStamps.length, points, lastAct];
    });

    const csvContent = [['Name', 'Email', 'Stamps', 'Points', 'Last Activity'], ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `participants-report-${reportCategory}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStampBadge = (title) => {
    const normalized = String(title || '').toLowerCase();
    if (normalized.includes('hiking') || normalized.includes('summit')) return { Icon: Mountain, background: 'rgba(21, 128, 61, 0.12)', color: '#15803d' };
    if (normalized.includes('running') || normalized.includes('run')) return { Icon: Trophy, background: 'rgba(180, 83, 9, 0.12)', color: '#b45309' };
    if (normalized.includes('challenge') || normalized.includes('sprint') || normalized.includes('boost') || normalized.includes('outdoor')) return { Icon: Sparkles, background: 'rgba(245, 158, 11, 0.12)', color: '#b45309' };
    if (normalized.includes('gym') || normalized.includes('workout')) return { Icon: Dumbbell, background: 'rgba(11, 65, 205, 0.12)', color: '#0b41cd' };
    return { Icon: Users, background: 'rgba(11, 65, 205, 0.08)', color: '#0b41cd' };
  };

  const renderStampHistory = (stampList) => {
    if (!stampList || stampList.length === 0) return <div className="empty-state">No stamps recorded for this club yet.</div>;
    return (
      <div className="stamp-list">
        {stampList.map((stamp) => {
          const { Icon, background, color } = getStampBadge(stamp.title);
          return (
            <div key={stamp.id} className="stamp-item">
              <div className="stamp-badge" style={{ background, color }}><Icon className="stamp-badge-icon" /></div>
              <div className="stamp-copy">
                <div className="stamp-title-row"><span className="stamp-title">{stamp.title}</span><span className="stamp-points">+{stamp.points} pt</span></div>
                <span className="stamp-time">{new Date(stamp.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderActivityCard = (category, isCampaignActive, isSpecial = false) => {
    const method = categorySelections[category.id]?.method || 'scan';
    const scanValue = (scanEntries[category.id] || '').trim().toUpperCase();
    const isReady = method === 'scan' ? Boolean(scanValue) : Boolean(proofs[category.id]);
    const canLogActivity = isCampaignActive && isReady;

    let Icon = Trophy; let badgeBg = 'rgba(11, 65, 205, 0.12)'; let badgeColor = '#0b41cd';
    if (category.iconType === 'dumbbell') Icon = Dumbbell;
    else if (category.iconType === 'users') Icon = Users;
    else if (category.iconType === 'mountain' || category.scanCode?.startsWith('HIKING')) { Icon = Mountain; badgeBg = 'rgba(21, 128, 61, 0.12)'; badgeColor = '#15803d'; }
    else if (category.scanCode?.startsWith('RUNNING')) { Icon = Trophy; badgeBg = 'rgba(180, 83, 9, 0.12)'; badgeColor = '#b45309'; }
    else if (isSpecial) { Icon = Sparkles; badgeBg = 'rgba(245, 158, 11, 0.12)'; badgeColor = '#b45309'; }

    return (
      <article key={category.id} className="category-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
        <div className="card-topline" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="category-title-wrap" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div className="icon-badge" style={{ background: badgeBg, color: badgeColor }}><Icon className="category-icon" /></div>
            <div><h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.1rem' }}>{category.title}</h2><p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>+{category.points} point{category.points > 1 ? 's' : ''}</p></div>
          </div>
          <span className={`status-pill ${isReady ? 'success' : 'pending'}`}>{isReady ? <CheckCircle2 className="status-icon" /> : <Camera className="status-icon" />}{isReady ? 'Ready' : 'Picture required'}</span>
        </div>
        {category.description && <p style={{ margin: '0.75rem 0 1rem 0', color: '#475569', fontSize: '0.9rem' }}>{category.description}</p>}
        <div className="method-toggle" style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
          <button type="button" className={method === 'scan' ? 'active' : ''} onClick={() => setCategorySelections((prev) => ({ ...prev, [category.id]: { method: 'scan' } }))}><ScanLine className="button-icon" /> Scan code</button>
          <button type="button" className={method === 'upload' ? 'active' : ''} onClick={() => setCategorySelections((prev) => ({ ...prev, [category.id]: { method: 'upload' } }))}><Upload className="button-icon" /> Upload picture</button>
        </div>
        {method === 'scan' ? (
          <div className="scan-box"><button type="button" className="scan-camera-button" onClick={() => { setFormError(''); setScannerCategoryId(category.id); }}><ScanLine className="button-icon" /> Scan code with camera</button></div>
        ) : (
          <label className="upload-box"><input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setProofs((prev) => ({ ...prev, [category.id]: URL.createObjectURL(file) })); setCategorySelections((prev) => ({ ...prev, [category.id]: { method: 'upload' } })); } }} /><span className="upload-hint">{category.proofPrompt || 'Upload a picture.'}</span></label>
        )}
        <button type="button" className="log-button" onClick={() => addStamp(category)} disabled={!canLogActivity}><PlusCircle className="button-icon" /> Log Activity</button>
      </article>
    );
  };

  const getTopUsersByFilter = (filterFn) => {
    return participants.map((p) => {
      const filteredStamps = (p.stamps || []).filter(filterFn);
      const points = filteredStamps.reduce((s, st) => s + Number(st.points || 0), 0);
      return { id: p.id, fullName: p.fullName, points };
    }).sort((a, b) => b.points - a.points).slice(0, 10);
  };

  if (screen === 'login') {
    return (
      <div className="auth-app"><div className="auth-card">
        <div className="auth-header"><span className="brand-badge"><IdCard className="button-icon" /></span><h1>Wellness Passport</h1><p>Sign in to track activity and submit pictures.</p></div>
        <form className="auth-form" onSubmit={handleLogin}>
          <label><span className="input-label"><Mail className="input-icon" /> Email</span><input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required /></label>
          <label><span className="input-label"><Lock className="input-icon" /> Password</span><input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required /></label>
          {authMessage && <p className="auth-message error">{authMessage}</p>}
          <button type="submit" className="primary-button"><LogIn className="button-icon" /> Log in</button>
        </form>
        <div className="auth-divider"><span>or</span></div>
        <button type="button" className="secondary-button" onClick={() => setScreen('register')}><UserPlus className="button-icon" /> Create an account</button>
        <div className="auth-divider small-gap"><span>admin access</span></div>
        <button type="button" className="secondary-button" onClick={() => setScreen('admin-login')}><ShieldCheck className="button-icon" /> Admin portal</button>
      </div></div>
    );
  }

  if (screen === 'register') {
    return (
      <div className="auth-app"><div className="auth-card">
        <div className="auth-header"><span className="brand-badge"><IdCard className="button-icon" /></span><h1>Create account</h1></div>
        <form className="auth-form" onSubmit={handleRegister}>
          <label><span className="input-label">Full name</span><input type="text" value={registerForm.fullName} onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })} required /></label>
          <label><span className="input-label">Email</span><input type="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} required /></label>
          <label><span className="input-label">Password</span><input type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} required /></label>
          <label><span className="input-label">Confirm password</span><input type="password" value={registerForm.confirmPassword} onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })} required /></label>
          {registrationMessage && <p className="auth-message error">{registrationMessage}</p>}
          <button type="submit" className="primary-button"><UserPlus className="button-icon" /> Register participant</button>
        </form>
        <button type="button" className="secondary-button" onClick={() => setScreen('login')}>Back to login</button>
      </div></div>
    );
  }

  if (screen === 'admin-login') {
    return (
      <div className="auth-app"><div className="auth-card">
        <div className="auth-header"><span className="brand-badge admin-badge"><ShieldCheck className="button-icon" /></span><h1>Admin portal</h1></div>
        <form className="auth-form" onSubmit={handleAdminLogin}>
          <label><span className="input-label">Admin email</span><input type="email" value={adminLoginForm.email} onChange={(e) => setAdminLoginForm({ ...adminLoginForm, email: e.target.value })} required /></label>
          <label><span className="input-label">Password</span><input type="password" value={adminLoginForm.password} onChange={(e) => setAdminLoginForm({ ...adminLoginForm, password: e.target.value })} required /></label>
          {adminMessage && <p className="auth-message error">{adminMessage}</p>}
          <button type="submit" className="primary-button"><ShieldCheck className="button-icon" /> Log in as admin</button>
        </form>
        <button type="button" className="secondary-button" onClick={() => setScreen('login')}>Back to login</button>
      </div></div>
    );
  }

  if (screen === 'admin-dashboard') {
    const stats = adminStats?.stats || {};

    const topWellnessUsers = getTopUsersByFilter((s) => !s.scanCode?.startsWith('HIKING-') && !s.scanCode?.startsWith('RUNNING-'));
    const topHikingUsers = getTopUsersByFilter((s) => s.scanCode?.startsWith('HIKING-'));
    const topRunningUsers = getTopUsersByFilter((s) => s.scanCode?.startsWith('RUNNING-'));

    const maxWellnessPts = Math.max(...topWellnessUsers.map(u => u.points), 1);
    const maxHikingPts = Math.max(...topHikingUsers.map(u => u.points), 1);
    const maxRunningPts = Math.max(...topRunningUsers.map(u => u.points), 1);

    const filterFn = reportCategory === 'wellness' 
      ? (s) => !s.scanCode?.startsWith('HIKING-') && !s.scanCode?.startsWith('RUNNING-')
      : reportCategory === 'hiking' 
      ? (s) => s.scanCode?.startsWith('HIKING-')
      : reportCategory === 'running'
      ? (s) => s.scanCode?.startsWith('RUNNING-')
      : () => true;

    return (
      <div className="admin-app" style={{ minHeight: '100vh', background: '#f1f5f9' }}>
        <header className="admin-header" style={{ padding: '1rem 2rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><p className="eyebrow" style={{ color: '#0b41cd', fontWeight: 'bold', margin: 0 }}>Admin dashboard</p><h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>Wellness Passport Overview</h1></div>
          <button type="button" className="logout-button" onClick={handleAdminLogout}><LogOut className="button-icon" /> Log out</button>
        </header>

        {/* LAYOUT WITH SIDEBAR ON THE LEFT */}
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 70px)' }}>
          {/* VERTICAL SIDEBAR MENU */}
          <aside style={{ width: '250px', background: '#ffffff', borderRight: '1px solid #e2e8f0', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
            <button type="button" className={`admin-side-nav ${adminTab === 'admin' ? 'active' : ''}`} style={sidebarButtonStyle(adminTab === 'admin')} onClick={() => setAdminTab('admin')}>
              <BarChart2 size={18} /> Overview
            </button>
            <button type="button" className={`admin-side-nav ${adminTab === 'users' ? 'active' : ''}`} style={sidebarButtonStyle(adminTab === 'users')} onClick={() => setAdminTab('users')}>
              <Users size={18} /> User management
            </button>
            <button type="button" className={`admin-side-nav ${adminTab === 'reports' ? 'active' : ''}`} style={sidebarButtonStyle(adminTab === 'reports')} onClick={() => setAdminTab('reports')}>
              <FileText size={18} /> Participants Report
            </button>
            <button type="button" className={`admin-side-nav ${adminTab === 'challenge' ? 'active' : ''}`} style={sidebarButtonStyle(adminTab === 'challenge')} onClick={() => setAdminTab('challenge')}>
              <Trophy size={18} /> Wellness Challenge
            </button>
            <button type="button" className={`admin-side-nav ${adminTab === 'hiking' ? 'active' : ''}`} style={sidebarButtonStyle(adminTab === 'hiking')} onClick={() => setAdminTab('hiking')}>
              <Mountain size={18} /> Hiking Club
            </button>
            <button type="button" className={`admin-side-nav ${adminTab === 'running' ? 'active' : ''}`} style={sidebarButtonStyle(adminTab === 'running')} onClick={() => setAdminTab('running')}>
              <Sparkles size={18} /> Running Club
            </button>
            <button type="button" className={`admin-side-nav ${adminTab === 'community' ? 'active' : ''}`} style={sidebarButtonStyle(adminTab === 'community')} onClick={() => setAdminTab('community')}>
              <MessageSquare size={18} /> Community
            </button>
            <button type="button" className={`admin-side-nav ${adminTab === 'qr' ? 'active' : ''}`} style={sidebarButtonStyle(adminTab === 'qr')} onClick={() => setAdminTab('qr')}>
              <QrCode size={18} /> Category QR codes
            </button>
          </aside>

          {/* MAIN CONTENT WORKSPACE */}
          <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
            {adminMessage ? <p className="auth-message success" style={{ marginBottom: '1.5rem' }}>{adminMessage}</p> : null}

            {adminTab === 'admin' && (
              <>
                <section className="admin-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <article className="metric-card accent"><span>Total participants</span><strong>{stats.totalParticipants || 0}</strong></article>
                  <article className="metric-card"><span>Active participants</span><strong>{stats.activeParticipants || 0}</strong></article>
                  <article className="metric-card"><span>Total stamps</span><strong>{stats.totalStamps || 0}</strong></article>
                  <article className="metric-card"><span>Total points</span><strong>{stats.totalPoints || 0}</strong></article>
                </section>

                <section className="admin-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  <div className="admin-panel chart-panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
                    <h3 style={{ color: '#0f172a', margin: '0 0 1rem 0' }}>Top 10: Wellness Challenge</h3>
                    <div className="bar-chart" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {topWellnessUsers.map((u) => (
                        <div key={u.id} className="bar-row">
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{u.fullName}</span>
                          <div className="bar-track" style={{ background: '#f1f5f9', borderRadius: '4px', height: '10px', overflow: 'hidden', margin: '4px 0' }}>
                            <div className="bar-fill" style={{ width: `${(u.points / maxWellnessPts) * 100}%`, background: '#0b41cd', height: '100%' }} />
                          </div>
                          <strong style={{ color: '#0f172a' }}>{u.points} pts</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="admin-panel chart-panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
                    <h3 style={{ color: '#0f172a', margin: '0 0 1rem 0' }}>Top 10: Hiking Club</h3>
                    <div className="bar-chart" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {topHikingUsers.map((u) => (
                        <div key={u.id} className="bar-row">
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{u.fullName}</span>
                          <div className="bar-track" style={{ background: '#f1f5f9', borderRadius: '4px', height: '10px', overflow: 'hidden', margin: '4px 0' }}>
                            <div className="bar-fill" style={{ width: `${(u.points / maxHikingPts) * 100}%`, background: '#15803d', height: '100%' }} />
                          </div>
                          <strong style={{ color: '#0f172a' }}>{u.points} pts</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="admin-panel chart-panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
                    <h3 style={{ color: '#0f172a', margin: '0 0 1rem 0' }}>Top 10: Running Club</h3>
                    <div className="bar-chart" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {topRunningUsers.map((u) => (
                        <div key={u.id} className="bar-row">
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{u.fullName}</span>
                          <div className="bar-track" style={{ background: '#f1f5f9', borderRadius: '4px', height: '10px', overflow: 'hidden', margin: '4px 0' }}>
                            <div className="bar-fill" style={{ width: `${(u.points / maxRunningPts) * 100}%`, background: '#b45309', height: '100%' }} />
                          </div>
                          <strong style={{ color: '#0f172a' }}>{u.points} pts</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}

            {adminTab === 'users' && (
              <section className="admin-panel assignment-panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
                <h3 style={{ color: '#0f172a', margin: '0 0 1.25rem 0' }}>User Management</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>Name</th>
                        <th style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>Role</th>
                        <th style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>Email</th>
                        <th style={{ padding: '0.75rem 1rem', color: '#0f172a', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.85rem 1rem', color: '#0f172a', fontWeight: 'bold' }}>{p.fullName}</td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{ padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', background: p.role === 'admin' ? '#eff6ff' : '#f1f5f9', color: p.role === 'admin' ? '#0b41cd' : '#475569' }}>
                              {p.role || 'participant'}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>{p.email}</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                              {p.role !== 'admin' && (
                                <button
                                  type="button"
                                  className="secondary-button"
                                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', height: '32px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                  onClick={() => promoteParticipantToAdmin(p)}
                                >
                                  <ShieldAlert size={14} /> Make Admin
                                </button>
                              )}
                              <button
                                type="button"
                                className="icon-button edit-button"
                                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.4rem', borderRadius: '6px', color: '#0f172a', height: '32px', width: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => { setEditingParticipantId(p.id); setEditingParticipantDraft({ fullName: p.fullName, email: p.email, role: p.role || 'participant' }); }}
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-button delete-button"
                                style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '0.4rem', borderRadius: '6px', color: '#dc2626', height: '32px', width: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => handleDeleteUser(p.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {adminTab === 'reports' && (
              <section className="admin-panel report-panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ color: '#0f172a', margin: 0 }}>Participants Report</h3>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>Filter performance statistics by activity category.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <select
                      value={reportCategory}
                      onChange={(e) => setReportCategory(e.target.value)}
                      style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#0f172a', fontWeight: 'bold' }}
                    >
                      <option value="all">All Categories</option>
                      <option value="wellness">Wellness Challenge</option>
                      <option value="hiking">Hiking Club</option>
                      <option value="running">Running Club</option>
                    </select>
                    <button type="button" className="primary-button" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={exportCategoryReportCsv}>
                      <Download size={16} /> Export to CSV
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>Name</th>
                        <th style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>Email</th>
                        <th style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>Stamps</th>
                        <th style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>Points</th>
                        <th style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>Last Activity</th>
                        <th style={{ padding: '0.75rem 1rem', color: '#0f172a', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p) => {
                        const filteredStamps = (p.stamps || []).filter(filterFn);
                        const pts = filteredStamps.reduce((s, st) => s + Number(st.points || 0), 0);
                        const lastAct = filteredStamps.length ? new Date(filteredStamps[0].date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'No activity';

                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '0.85rem 1rem', color: '#0f172a', fontWeight: 'bold' }}>{p.fullName}</td>
                            <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>{p.email}</td>
                            <td style={{ padding: '0.85rem 1rem', color: '#0f172a', fontWeight: 'bold' }}>{filteredStamps.length}</td>
                            <td style={{ padding: '0.85rem 1rem', color: '#0b41cd', fontWeight: 'bold' }}>{pts} pts</td>
                            <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>{lastAct}</td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                                <button
                                  type="button"
                                  className="icon-button edit-button"
                                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.4rem', borderRadius: '6px', color: '#0f172a', height: '32px', width: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                  onClick={() => { setEditingParticipantId(p.id); setEditingParticipantDraft({ fullName: p.fullName, email: p.email, role: p.role || 'participant' }); }}
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-button delete-button"
                                  style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '0.4rem', borderRadius: '6px', color: '#dc2626', height: '32px', width: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                  onClick={() => handleDeleteUser(p.id)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {adminTab === 'challenge' && (
              <section className="admin-panel special-challenges-panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ color: '#0f172a', margin: 0 }}>Manage Wellness Challenge</h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="secondary-button" onClick={handleEndChallenge} disabled={!challengeStatus.isActive}>End Campaign</button>
                    <button type="button" className="primary-button" onClick={handleStartChallenge}>Start New Campaign</button>
                  </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: challengeStatus.isActive ? '#15803d' : '#dc2626', fontWeight: 'bold' }}>
                  Campaign Status: {challengeStatus.isActive ? 'Active' : 'Ended (Users blocked from logging activities)'}
                </p>

                <div className="special-challenges-layout" style={{ marginTop: '1.5rem' }}>
                  <div className="special-challenges-form">
                    <label><span className="input-label">Activity Name</span><input type="text" value={challengeForm.title} onChange={(e) => setChallengeForm({ ...challengeForm, title: e.target.value })} /></label>
                    <label><span className="input-label">Description</span><textarea value={challengeForm.description} onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })} /></label>
                    <label><span className="input-label">Points</span><input type="number" value={challengeForm.points} onChange={(e) => setChallengeForm({ ...challengeForm, points: e.target.value })} /></label>
                    <button type="button" className="primary-button" onClick={handleSaveSpecialChallenge}>Add Special Activity</button>
                  </div>
                  <div className="special-challenges-list">
                    {specialChallenges.map((ch) => (
                      <div key={ch.id} className="admin-community-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                        <div><strong style={{ color: '#0f172a' }}>{ch.title}</strong> <small style={{ color: '#0b41cd' }}>({ch.points} pts)</small><p style={{ color: '#475569', margin: '0.25rem 0 0 0' }}>{ch.description}</p></div>
                        <button type="button" className="icon-button delete-button" style={{ color: '#dc2626' }} onClick={() => handleDeleteSpecialActivity(ch.id)}><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {adminTab === 'hiking' && (
              <section className="admin-panel special-challenges-panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ color: '#0f172a', margin: 0 }}>Manage Hiking Club</h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="secondary-button" onClick={handleEndHikingSeason} disabled={!hikingStatus.isActive}>End Campaign</button>
                    <button type="button" className="primary-button" onClick={handleStartHikingSeason}>Start New Campaign</button>
                  </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: hikingStatus.isActive ? '#15803d' : '#dc2626', fontWeight: 'bold' }}>
                  Campaign Status: {hikingStatus.isActive ? 'Active' : 'Ended (Users blocked from logging activities)'}
                </p>

                <div className="special-challenges-layout" style={{ marginTop: '1.5rem' }}>
                  <div className="special-challenges-form">
                    <label><span className="input-label">Hike Title</span><input type="text" value={hikingForm.title} onChange={(e) => setHikingForm({ ...hikingForm, title: e.target.value })} /></label>
                    <label><span className="input-label">Description</span><textarea value={hikingForm.description} onChange={(e) => setHikingForm({ ...hikingForm, description: e.target.value })} /></label>
                    <label><span className="input-label">Points</span><input type="number" value={hikingForm.points} onChange={(e) => setHikingForm({ ...hikingForm, points: e.target.value })} /></label>
                    <button type="button" className="primary-button" onClick={handleSaveHikingChallenge}>Add Hiking Activity</button>
                  </div>
                  <div className="special-challenges-list">
                    {hikingChallenges.map((ch) => (
                      <div key={ch.id} className="admin-community-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                        <div><strong style={{ color: '#0f172a' }}>{ch.title}</strong> <small style={{ color: '#15803d' }}>({ch.points} pts)</small><p style={{ color: '#475569', margin: '0.25rem 0 0 0' }}>{ch.description}</p></div>
                        <button type="button" className="icon-button delete-button" style={{ color: '#dc2626' }} onClick={() => handleDeleteHikingActivity(ch.id)}><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {adminTab === 'running' && (
              <section className="admin-panel special-challenges-panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ color: '#0f172a', margin: 0 }}>Manage Running Club</h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="secondary-button" onClick={handleEndRunningSeason} disabled={!runningStatus.isActive}>End Campaign</button>
                    <button type="button" className="primary-button" onClick={handleStartRunningSeason}>Start New Campaign</button>
                  </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: runningStatus.isActive ? '#15803d' : '#dc2626', fontWeight: 'bold' }}>
                  Campaign Status: {runningStatus.isActive ? 'Active' : 'Ended (Users blocked from logging activities)'}
                </p>

                <div className="special-challenges-layout" style={{ marginTop: '1.5rem' }}>
                  <div className="special-challenges-form">
                    <label><span className="input-label">Run Title</span><input type="text" value={runningForm.title} onChange={(e) => setRunningForm({ ...runningForm, title: e.target.value })} /></label>
                    <label><span className="input-label">Description</span><textarea value={runningForm.description} onChange={(e) => setRunningForm({ ...runningForm, description: e.target.value })} /></label>
                    <label><span className="input-label">Points</span><input type="number" value={runningForm.points} onChange={(e) => setRunningForm({ ...runningForm, points: e.target.value })} /></label>
                    <button type="button" className="primary-button" onClick={handleSaveRunningChallenge}>Add Running Activity</button>
                  </div>
                  <div className="special-challenges-list">
                    {runningChallenges.map((ch) => (
                      <div key={ch.id} className="admin-community-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                        <div><strong style={{ color: '#0f172a' }}>{ch.title}</strong> <small style={{ color: '#b45309' }}>({ch.points} pts)</small><p style={{ color: '#475569', margin: '0.25rem 0 0 0' }}>{ch.description}</p></div>
                        <button type="button" className="icon-button delete-button" style={{ color: '#dc2626' }} onClick={() => handleDeleteRunningActivity(ch.id)}><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {adminTab === 'community' && (
              <section className="admin-panel community-admin-panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
                <h3 style={{ color: '#0f172a' }}>Community Management</h3>
                <div className="community-manager-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
                  <div className="community-manager-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <textarea
                      value={adminCommunityDraft.message}
                      onChange={(e) => setAdminCommunityDraft({ ...adminCommunityDraft, message: e.target.value })}
                      placeholder="Publish an announcement to all participants..."
                      rows={4}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                    <button type="button" className="primary-button" onClick={handleAdminCommunityPostSubmit}>Publish Announcement</button>
                  </div>
                  <div className="community-manager-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                    {adminCommunityPosts.length === 0 ? (
                      <div className="empty-state">No community updates published yet.</div>
                    ) : (
                      adminCommunityPosts.map((post) => (
                        <div key={post.id} className="admin-community-item" style={{ padding: '0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', borderLeft: '4px solid #0b41cd' }}>
                          {editingCommunityId === post.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <textarea value={editingCommunityDraft.message} onChange={(e) => setEditingCommunityDraft({ message: e.target.value })} rows={2} style={{ padding: '0.5rem' }} />
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button type="button" className="small-button" onClick={() => handleSaveCommunityEdit(post.id)}>Save</button>
                                <button type="button" className="secondary-button small-action" onClick={() => setEditingCommunityId(null)}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <strong style={{ color: '#0f172a' }}>{post.author} <small style={{ color: '#64748b' }}>({post.isAnnouncement ? 'Announcement' : 'User post'})</small></strong>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <button type="button" className="icon-button edit-button" onClick={() => { setEditingCommunityId(post.id); setEditingCommunityDraft({ message: post.message }); }}><Edit size={14} /></button>
                                  <button type="button" className="icon-button delete-button" style={{ color: '#dc2626' }} onClick={() => handleDeleteCommunityPost(post.id)}><Trash2 size={14} /></button>
                                </div>
                              </div>
                              <p style={{ margin: 0, color: '#334155' }}>{post.message}</p>
                              {post.image ? <img src={post.image} alt="Community Post" style={{ marginTop: '0.5rem', maxHeight: '180px', borderRadius: '6px', objectFit: 'cover' }} /> : null}
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            )}

            {adminTab === 'qr' && (
              <section className="admin-panel qr-panel qr-sheet" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
                <h3 style={{ color: '#0f172a' }}>Category & Activity QR Codes</h3>
                <div className="qr-grid qr-sheet-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
                  {adminQrCodes.length === 0 ? (
                    <div className="empty-state">Loading QR codes catalog…</div>
                  ) : (
                    adminQrCodes.map((item) => (
                      <div key={item.id || item.code} className="qr-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        {item.qrCode ? (
                          <img src={item.qrCode} alt={item.title} className="qr-image" style={{ width: '100%', maxWidth: '180px', height: 'auto', borderRadius: '8px' }} />
                        ) : (
                          <div style={{ width: '180px', height: '180px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', color: '#94a3b8' }}>Generating QR…</div>
                        )}
                        <strong style={{ display: 'block', margin: '0.75rem 0 0.25rem 0', color: '#0f172a', fontSize: '0.95rem' }}>{item.title}</strong>
                        <small style={{ color: '#0b41cd', fontWeight: 'bold', fontFamily: 'monospace' }}>{item.code || item.scanCode}</small>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}
          </main>
        </div>
      </div></div>
    );
  }

  return (
    <div className="wellness-app">
      <div className="passport-shell">
        <div className="portal-layout">
          <nav className="portal-nav">
            <div className="portal-brand"><IdCard className="button-icon" /></div>
            <div className="portal-tabs">
              <button type="button" className={`portal-nav-button ${activePortalTab === 'home' ? 'active' : ''}`} onClick={() => setActivePortalTab('home')}><HomeIcon className="button-icon" /> Home</button>
              <button type="button" className={`portal-nav-button ${activePortalTab === 'passport' ? 'active' : ''}`} onClick={() => setActivePortalTab('passport')}>Wellness Challenge</button>
              <button type="button" className={`portal-nav-button ${activePortalTab === 'hiking' ? 'active' : ''}`} onClick={() => setActivePortalTab('hiking')}>Hiking Club</button>
              <button type="button" className={`portal-nav-button ${activePortalTab === 'running' ? 'active' : ''}`} onClick={() => setActivePortalTab('running')}>Running Club</button>
              <button type="button" className={`portal-nav-button ${activePortalTab === 'community' ? 'active' : ''}`} onClick={() => setActivePortalTab('community')}>Wellness Community</button>
            </div>
          </nav>

          <div className="portal-content">
            {formError && <div className="auth-message error" style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '8px' }}>{formError}</div>}

            {/* HOME TAB */}
            {activePortalTab === 'home' && (
              <section className="home-panel">
                <header className="passport-header" style={{ marginBottom: '1.5rem' }}>
                  <div className="header-topline">
                    <div>
                      <p className="eyebrow">Digital Wellness Passport</p>
                      <h1 style={{ color: '#0f172a' }}>Welcome, {currentUser?.fullName || 'Participant'}</h1>
                    </div>
                    <div className="header-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                      <button type="button" className="secondary-button" onClick={() => setProfileOpen(true)}><User size={16} /> My Profile</button>
                      <button type="button" className="logout-button" onClick={handleLogout}><LogOut className="button-icon" /> Log out</button>
                    </div>
                  </div>

                  <div className="welcome-intro" style={{ marginTop: '1rem', padding: '1.25rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #0b41cd' }}>
                    <p style={{ margin: 0, color: '#334155', fontSize: '1rem', lineHeight: '1.6' }}>
                      Welcome to your <strong>Digital Wellness Passport</strong>! Track your daily workout activities, join community fitness events, and earn points across all wellness clubs. Explore your progress below and stay active!
                    </p>
                  </div>

                  <div className="points-panel" style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div className="points-row" style={{ padding: '1rem', background: '#eff6ff', borderRadius: '10px', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.85rem', color: '#1e40af' }}>Wellness Challenge Points</span>
                      <strong style={{ fontSize: '1.75rem', color: '#0b41cd' }}>{wellnessPoints} pts</strong>
                    </div>
                    <div className="points-row" style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '10px', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.85rem', color: '#166534' }}>Hiking Club Points</span>
                      <strong style={{ fontSize: '1.75rem', color: '#15803d' }}>{hikingPoints} pts</strong>
                    </div>
                    <div className="points-row" style={{ padding: '1rem', background: '#fffbeb', borderRadius: '10px', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.85rem', color: '#92400e' }}>Running Club Points</span>
                      <strong style={{ fontSize: '1.75rem', color: '#b45309' }}>{runningPoints} pts</strong>
                    </div>
                    <div className="points-row" style={{ padding: '1rem', background: '#0b41cd', color: '#ffffff', borderRadius: '10px', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.85rem', color: '#93c5fd' }}>Total Passport Points</span>
                      <strong style={{ fontSize: '1.75rem', color: '#ffffff' }}>{totalPoints} pts</strong>
                    </div>
                  </div>
                </header>
              </section>
            )}

            {/* WELLNESS CHALLENGE TAB */}
            {activePortalTab === 'passport' && (
              <>
                <header className="passport-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Wellness Challenge Activities</h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="secondary-button" onClick={() => setProfileOpen(true)}><User size={16} /> My Profile</button>
                    <button type="button" className="logout-button" onClick={handleLogout}><LogOut className="button-icon" /> Log out</button>
                  </div>
                </header>

                <section className="activity-section-wrapper" style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <main className="category-list">
                    {categories.map((category) => renderActivityCard(category, challengeStatus.isActive))}
                  </main>
                </section>

                <section className="challenge-panel" style={{ marginTop: '2rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div className="section-heading"><h3 style={{ color: '#0f172a' }}>Special Activities</h3></div>
                  <main className="category-list" style={{ marginTop: '1rem' }}>
                    {specialChallenges.map((challenge) => renderActivityCard(challenge, challengeStatus.isActive, true))}
                  </main>
                </section>

                <section className="stamp-panel" style={{ marginTop: '2rem' }}>
                  <div className="section-heading"><h3 style={{ color: '#0f172a' }}>Wellness Challenge Stamp History</h3></div>
                  {renderStampHistory(wellnessStamps)}
                </section>
              </>
            )}

            {/* HIKING CLUB TAB */}
            {activePortalTab === 'hiking' && (
              <>
                <header className="passport-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Hiking Club Expeditions</h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="secondary-button" onClick={() => setProfileOpen(true)}><User size={16} /> My Profile</button>
                    <button type="button" className="logout-button" onClick={handleLogout}><LogOut className="button-icon" /> Log out</button>
                  </div>
                </header>

                <section className="activity-section-wrapper" style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <main className="category-list">
                    {hikingCategories.map((category) => renderActivityCard(category, hikingStatus.isActive))}
                  </main>

                  {hikingChallenges.length > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <div className="section-heading"><h3 style={{ color: '#0f172a' }}>Scheduled Trails & Peaks</h3></div>
                      <main className="category-list" style={{ marginTop: '1rem' }}>
                        {hikingChallenges.map((challenge) => renderActivityCard(challenge, hikingStatus.isActive, true))}
                      </main>
                    </div>
                  )}
                </section>

                <section className="stamp-panel" style={{ marginTop: '2rem' }}>
                  <div className="section-heading"><h3 style={{ color: '#0f172a' }}>Hiking Club Stamp History</h3></div>
                  {renderStampHistory(hikingStamps)}
                </section>
              </>
            )}

            {/* RUNNING CLUB TAB */}
            {activePortalTab === 'running' && (
              <>
                <header className="passport-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Running Club Sessions</h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="secondary-button" onClick={() => setProfileOpen(true)}><User size={16} /> My Profile</button>
                    <button type="button" className="logout-button" onClick={handleLogout}><LogOut className="button-icon" /> Log out</button>
                  </div>
                </header>

                <section className="activity-section-wrapper" style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <main className="category-list">
                    {runningCategories.map((category) => renderActivityCard(category, runningStatus.isActive))}
                  </main>

                  {runningChallenges.length > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <div className="section-heading"><h3 style={{ color: '#0f172a' }}>Scheduled Running Events</h3></div>
                      <main className="category-list" style={{ marginTop: '1rem' }}>
                        {runningChallenges.map((challenge) => renderActivityCard(challenge, runningStatus.isActive, true))}
                      </main>
                    </div>
                  )}
                </section>

                <section className="stamp-panel" style={{ marginTop: '2rem' }}>
                  <div className="section-heading"><h3 style={{ color: '#0f172a' }}>Running Club Stamp History</h3></div>
                  {renderStampHistory(runningStamps)}
                </section>
              </>
            )}

            {/* WELLNESS COMMUNITY TAB */}
            {activePortalTab === 'community' && (
              <section className="community-panel">
                <div className="section-heading"><h3 style={{ color: '#0f172a' }}>Wellness Community</h3></div>
                <div className="community-composer">
                  <textarea value={communityDraft.message} onChange={(e) => setCommunityDraft((p) => ({ ...p, message: e.target.value }))} placeholder="Share an update..." />
                  <button type="button" className="primary-button small-action" onClick={handleCommunityPostSubmit}>Post update</button>
                </div>
                <div className="community-feed" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {communityPosts.map((post) => (
                    <article key={post.id} className="community-post" style={{ padding: '1rem', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div className="community-post-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong style={{ color: '#0f172a' }}>{post.author}</strong>
                        <small style={{ color: '#64748b' }}>{post.createdAt ? new Date(post.createdAt).toLocaleDateString() : ''}</small>
                      </div>
                      <p style={{ margin: 0, color: '#334155' }}>{post.message}</p>
                      {post.image ? <img src={post.image} alt="Community Post" style={{ marginTop: '0.5rem', maxHeight: '220px', borderRadius: '8px', objectFit: 'cover' }} /> : null}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* MY PROFILE MODAL */}
      {profileOpen && (
        <div className="scanner-modal">
          <div className="scanner-card" style={{ background: '#ffffff', padding: '2rem', borderRadius: '16px', maxWidth: '420px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>My Profile</h3>
              <button type="button" className="secondary-button" onClick={() => setProfileOpen(false)}>Close</button>
            </div>
            <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                {profileDraft.profileImage ? (
                  <img src={profileDraft.profileImage} alt="Profile" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #0b41cd' }} />
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', color: '#64748b' }}>
                    <User size={36} />
                  </div>
                )}
                <label className="secondary-button" style={{ marginTop: '0.5rem', display: 'inline-block', cursor: 'pointer', fontSize: '0.85rem' }}>
                  Upload Picture
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageUpload(e.target.files?.[0])} />
                </label>
              </div>
              <label><span className="input-label">Full Name</span><input type="text" value={profileDraft.fullName} onChange={(e) => setProfileDraft({ ...profileDraft, fullName: e.target.value })} required /></label>
              <label><span className="input-label">Email</span><input type="email" value={profileDraft.email} onChange={(e) => setProfileDraft({ ...profileDraft, email: e.target.value })} required /></label>
              <label><span className="input-label">Change Password</span><input type="password" placeholder="Leave blank to keep current" value={profileDraft.password} onChange={(e) => setProfileDraft({ ...profileDraft, password: e.target.value })} /></label>
              {profileMsg && <p className="auth-message success" style={{ margin: 0 }}>{profileMsg}</p>}
              <button type="submit" className="primary-button">Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {/* QR SCANNER MODAL */}
      {scannerCategoryId && (
        <div className="scanner-modal">
          <div className="scanner-card">
            <button type="button" className="close-scanner" onClick={() => setScannerCategoryId(null)}>Close</button>
            <video ref={videoRef} className="scanner-video" autoPlay playsInline muted />
            <canvas ref={canvasRef} hidden />
            {scannerError && <p className="auth-message error" style={{ marginTop: '0.5rem' }}>{scannerError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function sidebarButtonStyle(isActive) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: 'none',
    background: isActive ? '#0b41cd' : 'transparent',
    color: isActive ? '#ffffff' : '#334155',
    fontWeight: isActive ? 'bold' : '500',
    fontSize: '0.9rem',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s ease'
  };
}
