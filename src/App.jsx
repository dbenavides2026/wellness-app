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

const categories = [
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

  // Comprehensive Refresh & State Re-hydration
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

      // Automatically sync logged-in user profile from backend without requiring re-login
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

  // Initial load + Polling Interval for live updates
  useEffect(() => {
    refreshAllData();

    // Auto-poll backend every 6 seconds so user state, stamps, and new activities refresh automatically
    const interval = setInterval(() => {
      refreshAllData();
      if (adminUser) refreshAdminData();
    }, 6000);

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

  const addStamp = async (category) => {
    if (!currentUser) return;
    try {
      const res = await fetchJson(`/api/participants/${currentUser.id}/stamps`, {
        method: 'POST',
        body: JSON.stringify({
          title: category.title,
          points: category.points,
          categoryId: category.id,
          scanCode: scanEntries[category.id] || category.scanCode || ''
        })
      });
      setCurrentUser(res.user); setFormError('');
      setProofs((p) => { const n = { ...p }; delete n[category.id]; return n; });
      setScanEntries((p) => { const n = { ...p }; delete n[category.id]; return n; });
      confetti({ particleCount: 55, spread: 60, origin: { y: 0.8 } });
      await refreshAllData();
    } catch (err) { setFormError(err.message); }
  };

  // View Renderings
  if (screen === 'login') return (
    <div className="auth-app"><div className="auth-card">
      <div className="auth-header"><h1>Wellness Passport</h1><p>Sign in to track activity.</p></div>
      <form className="auth-form" onSubmit={handleLogin}>
        <label><span className="input-label"><Mail className="input-icon" /> Email</span><input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required /></label>
        <label><span className="input-label"><Lock className="input-icon" /> Password</span><input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required /></label>
        {authMessage && <p className="auth-message error">{authMessage}</p>}
        <button type="submit" className="primary-button"><LogIn className="button-icon" /> Log in</button>
      </form>
      <div className="auth-divider"><span>or</span></div>
      <button className="secondary-button" onClick={() => setScreen('register')}><UserPlus className="button-icon" /> Create account</button>
      <button className="secondary-button" onClick={() => setScreen('admin-login')}><ShieldCheck className="button-icon" /> Admin portal</button>
    </div></div>
  );

  if (screen === 'register') return (
    <div className="auth-app"><div className="auth-card">
      <div className="auth-header"><h1>Create Account</h1></div>
      <form className="auth-form" onSubmit={handleRegister}>
        <label><span className="input-label">Full Name</span><input type="text" value={registerForm.fullName} onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })} required /></label>
        <label><span className="input-label">Email</span><input type="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} required /></label>
        <label><span className="input-label">Password</span><input type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} required /></label>
        <label><span className="input-label">Confirm Password</span><input type="password" value={registerForm.confirmPassword} onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })} required /></label>
        {registrationMessage && <p className="auth-message error">{registrationMessage}</p>}
        <button type="submit" className="primary-button">Register</button>
      </form>
      <button className="secondary-button" onClick={() => setScreen('login')}>Back to login</button>
    </div></div>
  );

  if (screen === 'admin-login') return (
    <div className="auth-app"><div className="auth-card">
      <div className="auth-header"><h1>Admin Portal</h1></div>
      <form className="auth-form" onSubmit={handleAdminLogin}>
        <label><span className="input-label">Admin Email</span><input type="email" value={adminLoginForm.email} onChange={(e) => setAdminLoginForm({ ...adminLoginForm, email: e.target.value })} required /></label>
        <label><span className="input-label">Password</span><input type="password" value={adminLoginForm.password} onChange={(e) => setAdminLoginForm({ ...adminLoginForm, password: e.target.value })} required /></label>
        {adminMessage && <p className="auth-message error">{adminMessage}</p>}
        <button type="submit" className="primary-button"><ShieldCheck className="button-icon" /> Log in as Admin</button>
      </form>
      <button className="secondary-button" onClick={() => setScreen('login')}>Back to login</button>
    </div></div>
  );

  if (screen === 'admin-dashboard') return (
    <div className="admin-app"><div className="admin-shell">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <button className="logout-button" onClick={() => { setAdminUser(null); setScreen('login'); }}><LogOut /> Log out</button>
      </header>
      <nav className="admin-top-nav">
        <button className={adminTab === 'admin' ? 'active' : ''} onClick={() => setAdminTab('admin')}>Overview</button>
        <button className={adminTab === 'challenge' ? 'active' : ''} onClick={() => setAdminTab('challenge')}>Manage Challenges</button>
        <button className={adminTab === 'qr' ? 'active' : ''} onClick={() => setAdminTab('qr')}>Category QRs</button>
      </nav>
      {adminTab === 'qr' && (
        <section className="admin-panel">
          <div className="qr-grid">
            {adminQrCodes.map((item) => (
              <div key={item.id} className="qr-card">
                <img src={item.qrCode} alt={item.title} />
                <strong>{item.title}</strong>
                <small>{item.code}</small>
              </div>
            ))}
          </div>
        </section>
      )}
    </div></div>
  );

  return (
    <div className="wellness-app"><div className="passport-shell">
      <header className="passport-header">
        <h1>Welcome, {currentUser?.fullName}</h1>
        <button className="logout-button" onClick={() => { setCurrentUser(null); setScreen('login'); }}><LogOut /> Log out</button>
        <div className="points-panel"><strong>{points} pts</strong></div>
      </header>
      <main className="category-list">
        {categories.map((cat) => (
          <article key={cat.id} className="category-card">
            <h2>{cat.title}</h2>
            <button className="scan-camera-button" onClick={() => setScannerCategoryId(cat.id)}><ScanLine /> Scan QR Code</button>
            <button className="log-button" onClick={() => addStamp(cat)} disabled={!challengeStatus.isActive}><PlusCircle /> Log Activity</button>
          </article>
        ))}
      </main>
      {scannerCategoryId && (
        <div className="scanner-modal"><div className="scanner-card">
          <button className="close-scanner" onClick={() => setScannerCategoryId(null)}>Close</button>
          <video ref={videoRef} className="scanner-video" autoPlay playsInline muted />
          <canvas ref={canvasRef} hidden />
        </div></div>
      )}
    </div></div>
  );
}
