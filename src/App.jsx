import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import jsQR from 'jsqr';
import {
  Camera, CheckCircle2, Dumbbell, Edit, Lock, Trash2, IdCard, LogIn, LogOut,
  Mail, PlusCircle, ScanLine, ShieldCheck, Sparkles, Trophy, Upload, UserPlus, Users, Mountain, User
} from 'lucide-react';
import './App.css';

const CURRENT_USER_KEY = 'wellness-passport-current-user';
const ADMIN_USER_KEY = 'wellness-passport-admin-user';

const categories = [
  { id: 'gym', title: 'Gym / Solo Workout', points: 1, iconType: 'dumbbell', scanCode: 'WELLNESS-GYM-101', proofPrompt: 'Upload a photo of your workout setup.' },
  { id: 'group', title: 'Group Fitness Class', points: 2, iconType: 'users', scanCode: 'WELLNESS-GROUP-202', proofPrompt: 'Upload a photo of class attendance.' },
  { id: 'sports', title: 'Sports & Outdoor Game', points: 2, iconType: 'trophy', scanCode: 'WELLNESS-SPORTS-303', proofPrompt: 'Upload a photo of your activity.' }
];

const hikingCategories = [
  { id: 'hiking-club-checkin', title: 'Hiking Club Expedition', points: 3, iconType: 'mountain', scanCode: 'HIKING-CLUB-101', proofPrompt: 'Upload a photo from your trail check-in.' }
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
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  
  const [specialChallenges, setSpecialChallenges] = useState([]);
  const [challengeStatus, setChallengeStatus] = useState({ isActive: false, title: 'No active challenge' });
  const [hikingChallenges, setHikingChallenges] = useState([]);
  const [hikingStatus, setHikingStatus] = useState({ isActive: false, title: 'No active hiking season' });

  const [challengeForm, setChallengeForm] = useState({ title: '', description: '', points: 10, scanCode: '', proofPrompt: '' });
  const [hikingForm, setHikingForm] = useState({ title: '', description: '', points: 15, scanCode: '', proofPrompt: '' });

  const [categorySelections, setCategorySelections] = useState({});
  const [scanEntries, setScanEntries] = useState({});
  const [proofs, setProofs] = useState({});
  const [scannerCategoryId, setScannerCategoryId] = useState(null);
  const [scannerError, setScannerError] = useState('');
  const [formError, setFormError] = useState('');

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ fullName: '', email: '', password: '', profileImage: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const points = currentUser?.stamps?.reduce((total, stamp) => total + Number(stamp.points || 0), 0) || 0;

  const refreshAllData = async () => {
    try {
      const t = Date.now();
      const [parts, comms, chs, status, hChs, hStatus] = await Promise.all([
        fetchJson(`/api/participants?t=${t}`),
        fetchJson(`/api/admin/community?t=${t}`),
        fetchJson(`/api/challenges?t=${t}`),
        fetchJson(`/api/admin/challenge-status?t=${t}`),
        fetchJson(`/api/hiking-challenges?t=${t}`),
        fetchJson(`/api/admin/hiking-status?t=${t}`)
      ]);

      const updated = parts.participants || [];
      setParticipants(updated);
      setCommunityPosts(comms.posts || []);
      setAdminCommunityPosts(comms.posts || []);
      setSpecialChallenges(chs.challenges || []);
      setChallengeStatus(status.status || { isActive: false });
      setHikingChallenges(hChs.challenges || []);
      setHikingStatus(hStatus.status || { isActive: false });

      if (currentUser?.id) {
        const fresh = updated.find((p) => p.id === currentUser.id);
        if (fresh) setCurrentUser(fresh);
      }
    } catch (e) { console.error('Data refresh error', e); }
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
    } catch (e) { console.error('Admin data error', e); }
  };

  useEffect(() => {
    refreshAllData();
    const interval = setInterval(() => {
      refreshAllData();
      if (adminUser) refreshAdminData();
    }, 5000);

    const handleVis = () => {
      if (document.visibilityState === 'visible') {
        refreshAllData();
        if (adminUser) refreshAdminData();
      }
    };

    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('focus', handleVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('focus', handleVis);
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
    if (currentUser && ['login', 'register'].includes(screen)) setScreen('dashboard');
    if (adminUser && ['login', 'register', 'admin-login'].includes(screen)) setScreen('admin-dashboard');
  }, [currentUser, adminUser, screen]);

  // STRICT QR CODE VALIDATION LOGIC
  const addStampWithCode = async (activity, directCode = '') => {
    if (!currentUser) return;
    const codeToSend = (directCode || scanEntries[activity.id] || '').trim().toUpperCase();
    const expected = (activity.scanCode || '').trim().toUpperCase();

    if (!codeToSend) { setFormError('No QR code detected. Please scan the QR code first.'); return; }
    if (expected && codeToSend !== expected) {
      setFormError(`Invalid QR Code. Scanned "${codeToSend}", but this activity requires "${expected}".`);
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
        await refreshAllData();
      }
    } catch (err) { setFormError(err.message || 'Unable to save activity.'); }
  };

  const addStamp = (activity) => addStampWithCode(activity, scanEntries[activity.id]);

  // CAMERA SCANNER WITH STRICT VALIDATION
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

          const targetCategory = categories.find((cat) => cat.id === scannerCategoryId)
            || hikingCategories.find((hc) => hc.id === scannerCategoryId)
            || specialChallenges.find((sc) => sc.id === scannerCategoryId)
            || hikingChallenges.find((hc) => hc.id === scannerCategoryId);

          const expected = (targetCategory?.scanCode || '').trim().toUpperCase();

          if (expected && val !== expected) {
            setScannerError(`Invalid QR Code! Code does not match "${targetCategory?.title}".`);
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
  }, [scannerCategoryId, activePortalTab, specialChallenges, hikingChallenges]);

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

  const handleForgotPassword = async (e) => {
    e.preventDefault(); setForgotMsg('');
    try {
      const res = await fetchJson('/api/forgot-password', { method: 'POST', body: JSON.stringify({ email: forgotEmail }) });
      setForgotMsg(`Success: ${res.message} (${res.password})`);
    } catch (err) { setForgotMsg(err.message || 'Unable to retrieve password.'); }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault(); setProfileMsg('');
    try {
      const res = await fetchJson(`/api/participants/${currentUser.id}/profile`, { method: 'PUT', body: JSON.stringify(profileDraft) });
      setCurrentUser(res.user); setProfileMsg('Profile updated!'); await refreshAllData();
    } catch (err) { setProfileMsg(err.message || 'Unable to update profile.'); }
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
      const res = await fetchJson(`/api/admin/participants/${participant.id}/promote`, { method: 'POST', body: JSON.stringify({}) });
      setAdminMessage(res.message); await refreshAllData(); await refreshAdminData();
    } catch (err) { setAdminMessage(err.message); }
  };

  const handleSaveUser = async () => {
    try {
      await fetchJson(`/api/admin/participants/${editingParticipantId}`, { method: 'PUT', body: JSON.stringify(editingParticipantDraft) });
      setEditingParticipantId(null); setAdminMessage('User updated.'); await refreshAllData(); await refreshAdminData();
    } catch (err) { setAdminMessage(err.message); }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete user?')) return;
    try {
      await fetchJson(`/api/admin/participants/${userId}`, { method: 'DELETE' });
      setAdminMessage('User deleted.'); await refreshAllData(); await refreshAdminData();
    } catch (err) { setAdminMessage(err.message); }
  };

  const handleDeleteSpecialActivity = async (id) => {
    if (!window.confirm('Delete activity?')) return;
    try {
      await fetchJson(`/api/admin/challenges/${id}`, { method: 'DELETE' });
      setAdminMessage('Activity deleted.'); await refreshAllData(); await refreshAdminData();
    } catch (err) { setAdminMessage(err.message); }
  };

  const handleDeleteHikingActivity = async (id) => {
    if (!window.confirm('Delete hiking activity?')) return;
    try {
      await fetchJson(`/api/admin/hiking-challenges/${id}`, { method: 'DELETE' });
      setAdminMessage('Hiking activity deleted.'); await refreshAllData(); await refreshAdminData();
    } catch (err) { setAdminMessage(err.message); }
  };

  const handleSaveSpecialChallenge = async () => {
    if (!challengeForm.title || !challengeForm.description) return;
    try {
      await fetchJson('/api/admin/challenges', { method: 'POST', body: JSON.stringify({ ...challengeForm, points: Number(challengeForm.points) || 10 }) });
      setChallengeForm({ title: '', description: '', points: 10, scanCode: '', proofPrompt: '' });
      setAdminMessage('Special activity saved.'); await refreshAllData(); await refreshAdminData();
    } catch (err) { setAdminMessage(err.message); }
  };

  const handleSaveHikingChallenge = async () => {
    if (!hikingForm.title || !hikingForm.description) return;
    try {
      await fetchJson('/api/admin/hiking-challenges', { method: 'POST', body: JSON.stringify({ ...hikingForm, points: Number(hikingForm.points) || 15 }) });
      setHikingForm({ title: '', description: '', points: 15, scanCode: '', proofPrompt: '' });
      setAdminMessage('Hiking activity saved.'); await refreshAllData(); await refreshAdminData();
    } catch (err) { setAdminMessage(err.message); }
  };

  if (screen === 'login') return (
    <div className="auth-app"><div className="auth-card">
      <div className="auth-header"><span className="brand-badge"><IdCard /></span><h1>Wellness Passport</h1><p>Sign in to track activity.</p></div>
      <form className="auth-form" onSubmit={handleLogin}>
        <label><span className="input-label"><Mail /> Email</span><input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required /></label>
        <label><span className="input-label"><Lock /> Password</span><input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required /></label>
        {authMessage && <p className="auth-message error">{authMessage}</p>}
        <button type="submit" className="primary-button"><LogIn /> Log in</button>
        <button type="button" className="secondary-button" style={{ marginTop: '0.5rem', background: 'transparent', border: 'none', color: '#0b41cd' }} onClick={() => setForgotPasswordOpen(true)}>Forgot password?</button>
      </form>
      <div className="auth-divider"><span>or</span></div>
      <button type="button" className="secondary-button" onClick={() => setScreen('register')}><UserPlus /> Create an account</button>
      <button type="button" className="secondary-button" onClick={() => setScreen('admin-login')}><ShieldCheck /> Admin portal</button>
    </div>
    {forgotPasswordOpen && (
      <div className="scanner-modal"><div className="scanner-card" style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px' }}>
        <h3>Retrieve Password</h3>
        <form onSubmit={handleForgotPassword} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input type="email" placeholder="registered@email.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
          {forgotMsg && <p className="auth-message">{forgotMsg}</p>}
          <button type="submit" className="primary-button">Retrieve</button>
          <button type="button" className="secondary-button" onClick={() => setForgotPasswordOpen(false)}>Close</button>
        </form>
      </div></div>
    )}</div>
  );

  if (screen === 'register') return (
    <div className="auth-app"><div className="auth-card">
      <div className="auth-header"><h1>Create account</h1></div>
      <form className="auth-form" onSubmit={handleRegister}>
        <label><span className="input-label">Full name</span><input type="text" value={registerForm.fullName} onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })} required /></label>
        <label><span className="input-label">Email</span><input type="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} required /></label>
        <label><span className="input-label">Password</span><input type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} required /></label>
        <label><span className="input-label">Confirm password</span><input type="password" value={registerForm.confirmPassword} onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })} required /></label>
        {registrationMessage && <p className="auth-message error">{registrationMessage}</p>}
        <button type="submit" className="primary-button"><UserPlus /> Register</button>
      </form>
      <button type="button" className="secondary-button" onClick={() => setScreen('login')}>Back to login</button>
    </div></div>
  );

  if (screen === 'admin-login') return (
    <div className="auth-app"><div className="auth-card">
      <div className="auth-header"><h1>Admin portal</h1></div>
      <form className="auth-form" onSubmit={handleAdminLogin}>
        <label><span className="input-label">Admin email</span><input type="email" value={adminLoginForm.email} onChange={(e) => setAdminLoginForm({ ...adminLoginForm, email: e.target.value })} required /></label>
        <label><span className="input-label">Password</span><input type="password" value={adminLoginForm.password} onChange={(e) => setAdminLoginForm({ ...adminLoginForm, password: e.target.value })} required /></label>
        {adminMessage && <p className="auth-message error">{adminMessage}</p>}
        <button type="submit" className="primary-button"><ShieldCheck /> Log in</button>
      </form>
      <button type="button" className="secondary-button" onClick={() => setScreen('login')}>Back</button>
    </div></div>
  );

  if (screen === 'admin-dashboard') return (
    <div className="admin-app"><div className="admin-shell">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <button type="button" className="logout-button" onClick={() => { setAdminUser(null); setScreen('login'); }}><LogOut /> Log out</button>
      </header>

      <nav className="admin-top-nav" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <button type="button" className={adminTab === 'admin' ? 'active' : ''} onClick={() => setAdminTab('admin')}>Overview</button>
        <button type="button" className={adminTab === 'users' ? 'active' : ''} onClick={() => setAdminTab('users')}>User management</button>
        <button type="button" className={adminTab === 'challenge' ? 'active' : ''} onClick={() => setAdminTab('challenge')}>Manage Wellness Challenge</button>
        <button type="button" className={adminTab === 'hiking' ? 'active' : ''} onClick={() => setAdminTab('hiking')}>Manage Hiking Club</button>
        <button type="button" className={adminTab === 'community' ? 'active' : ''} onClick={() => setAdminTab('community')}>Community</button>
        <button type="button" className={adminTab === 'qr' ? 'active' : ''} onClick={() => setAdminTab('qr')}>QRs</button>
      </nav>

      {adminMessage && <p className="auth-message success" style={{ margin: '1rem 0' }}>{adminMessage}</p>}

      {/* USER MANAGEMENT - WHITE BACKGROUND */}
      {adminTab === 'users' && (
        <section className="admin-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
          <h3 style={{ color: '#0f172a' }}>Registered Account Management</h3>
          <div className="participant-list" style={{ marginTop: '1rem', background: '#ffffff' }}>
            {participants.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
                <div><strong style={{ color: '#0f172a' }}>{p.fullName}</strong> <small style={{ color: '#64748b' }}>({p.role || 'participant'})</small><br/><span style={{ color: '#475569', fontSize: '0.85rem' }}>{p.email}</span></div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {p.role !== 'admin' && <button type="button" className="small-button" onClick={() => promoteParticipantToAdmin(p)}>Assign admin</button>}
                  <button type="button" className="icon-button edit-button" onClick={() => { setEditingParticipantId(p.id); setEditingParticipantDraft({ fullName: p.fullName, email: p.email, role: p.role || 'participant' }); }}><Edit size={16} /></button>
                  <button type="button" className="icon-button delete-button" onClick={() => handleDeleteUser(p.id)}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MANAGE WELLNESS CHALLENGE */}
      {adminTab === 'challenge' && (
        <section className="admin-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
          <h3 style={{ color: '#0f172a' }}>Manage Wellness Challenge</h3>
          <div className="special-challenges-form" style={{ marginTop: '1rem' }}>
            <input type="text" placeholder="Activity Name" value={challengeForm.title} onChange={(e) => setChallengeForm({ ...challengeForm, title: e.target.value })} />
            <textarea placeholder="Description" value={challengeForm.description} onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })} />
            <input type="number" placeholder="Points" value={challengeForm.points} onChange={(e) => setChallengeForm({ ...challengeForm, points: e.target.value })} />
            <button type="button" className="primary-button" onClick={handleSaveSpecialChallenge}>Add Special Activity</button>
          </div>
          <div className="special-challenges-list" style={{ marginTop: '1.5rem' }}>
            {specialChallenges.map((ch) => (
              <div key={ch.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', marginBottom: '0.5rem' }}>
                <div><strong style={{ color: '#0f172a' }}>{ch.title}</strong> <small>({ch.points} pts)</small><p style={{ margin: 0, color: '#475569', fontSize: '0.85rem' }}>{ch.description}</p></div>
                <button type="button" className="icon-button delete-button" onClick={() => handleDeleteSpecialActivity(ch.id)}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MANAGE HIKING CLUB */}
      {adminTab === 'hiking' && (
        <section className="admin-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
          <h3 style={{ color: '#0f172a' }}>Manage Hiking Club</h3>
          <div className="special-challenges-form" style={{ marginTop: '1rem' }}>
            <input type="text" placeholder="Hike Title" value={hikingForm.title} onChange={(e) => setHikingForm({ ...hikingForm, title: e.target.value })} />
            <textarea placeholder="Description" value={hikingForm.description} onChange={(e) => setHikingForm({ ...hikingForm, description: e.target.value })} />
            <input type="number" placeholder="Points" value={hikingForm.points} onChange={(e) => setHikingForm({ ...hikingForm, points: e.target.value })} />
            <button type="button" className="primary-button" onClick={handleSaveHikingChallenge}>Add Hiking Activity</button>
          </div>
          <div className="special-challenges-list" style={{ marginTop: '1.5rem' }}>
            {hikingChallenges.map((ch) => (
              <div key={ch.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', marginBottom: '0.5rem' }}>
                <div><strong style={{ color: '#0f172a' }}>{ch.title}</strong> <small style={{ color: '#15803d' }}>({ch.points} pts)</small><p style={{ margin: 0, color: '#475569', fontSize: '0.85rem' }}>{ch.description}</p></div>
                <button type="button" className="icon-button delete-button" onClick={() => handleDeleteHikingActivity(ch.id)}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div></div>
  );

  return (
    <div className="wellness-app"><div className="passport-shell">
      <nav className="portal-nav"><div className="portal-brand"><IdCard /></div>
        <div className="portal-tabs" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className={activePortalTab === 'passport' ? 'active' : ''} onClick={() => setActivePortalTab('passport')}>Digital Passport</button>
          <button type="button" className={activePortalTab === 'community' ? 'active' : ''} onClick={() => setActivePortalTab('community')}>Wellness Community</button>
          <button type="button" className={activePortalTab === 'challenge' ? 'active' : ''} onClick={() => setActivePortalTab('challenge')}>Special Activities</button>
          <button type="button" className={activePortalTab === 'hiking' ? 'active' : ''} onClick={() => setActivePortalTab('hiking')}>Hiking Club</button>
        </div>
      </nav>

      <div className="portal-content">
        {formError && <div className="auth-message error" style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '8px' }}>{formError}</div>}

        {activePortalTab === 'passport' && (
          <>
            <header className="passport-header">
              <div><p className="eyebrow">Wellness Passport</p><h1>Welcome, {currentUser?.fullName}</h1></div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="secondary-button" onClick={() => setProfileOpen(true)}><User size={16} /> Profile</button>
                <button type="button" className="logout-button" onClick={handleLogout}><LogOut /> Log out</button>
              </div>
            </header>
            <main className="category-list">
              {categories.map((cat) => (
                <article key={cat.id} className="category-card">
                  <h2>{cat.title}</h2>
                  <button type="button" className="scan-camera-button" onClick={() => { setFormError(''); setScannerCategoryId(cat.id); }}><ScanLine /> Scan Code</button>
                  <button type="button" className="log-button" onClick={() => addStamp(cat)} disabled={!challengeStatus.isActive}><PlusCircle /> Log Activity</button>
                </article>
              ))}
            </main>
          </>
        )}

        {/* HIKING CLUB TAB */}
        {activePortalTab === 'hiking' && (
          <section className="challenge-panel">
            <h3>Hiking Club Expeditions</h3>
            <main className="category-list" style={{ margin: '1rem 0' }}>
              {hikingCategories.map((cat) => (
                <article key={cat.id} className="category-card">
                  <h2>{cat.title}</h2>
                  <button type="button" className="scan-camera-button" onClick={() => { setFormError(''); setScannerCategoryId(cat.id); }}><ScanLine /> Scan Hiking QR</button>
                  <button type="button" className="log-button" onClick={() => addStamp(cat)} disabled={!hikingStatus.isActive}><PlusCircle /> Log Hike</button>
                </article>
              ))}
            </main>
          </section>
        )}
      </div>

      {scannerCategoryId && (
        <div className="scanner-modal"><div className="scanner-card">
          <button type="button" className="close-scanner" onClick={() => setScannerCategoryId(null)}>Close</button>
          <video ref={videoRef} className="scanner-video" autoPlay playsInline muted />
          <canvas ref={canvasRef} hidden />
          {scannerError && <p className="auth-message error">{scannerError}</p>}
        </div></div>
      )}
    </div></div>
  );
}
