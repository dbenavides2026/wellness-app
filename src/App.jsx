/* Base Resets */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body, html {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: #f1f5f9;
  color: #0f172a;
  min-height: 100vh;
}

/* Authentication Screen (Login / Register) */
.auth-app {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0b41cd 0%, #1e1b4b 100%);
  padding: 1.5rem;
}

.auth-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 2.5rem;
  max-width: 440px;
  width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.brand-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background-color: #eff6ff;
  color: #0b41cd;
  border-radius: 12px;
  margin-bottom: 1rem;
}

.brand-badge.admin-badge {
  background-color: #fef2f2;
  color: #dc2626;
}

.auth-header h1 {
  font-size: 1.75rem;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.auth-header p {
  color: #64748b;
  font-size: 0.95rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.auth-form label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.input-icon {
  width: 16px;
  height: 16px;
  color: #64748b;
}

.auth-form input,
.auth-form textarea,
.community-composer textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  outline: none;
}

.auth-form input:focus,
.auth-form textarea:focus,
.community-composer textarea:focus {
  border-color: #0b41cd;
  box-shadow: 0 0 0 3px rgba(11, 65, 205, 0.15);
}

.auth-divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 1.5rem 0;
  color: #94a3b8;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.auth-divider.small-gap {
  margin: 1rem 0;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #e2e8f0;
}

.auth-divider span {
  padding: 0 0.75rem;
}

/* Buttons */
.primary-button {
  width: 100%;
  background-color: #0b41cd;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 0.85rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: background-color 0.2s ease;
}

.primary-button:hover {
  background-color: #0832a4;
}

.secondary-button {
  width: 100%;
  background-color: #ffffff;
  color: #334155;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.75rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.secondary-button:hover {
  background-color: #f8fafc;
  border-color: #94a3b8;
}

.logout-button {
  background: transparent;
  color: #dc2626;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  padding: 0.5rem 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.logout-button:hover {
  background-color: #fef2f2;
}

.button-icon {
  width: 18px;
  height: 18px;
}

.auth-message {
  font-size: 0.85rem;
  padding: 0.75rem;
  border-radius: 8px;
  text-align: center;
}

.auth-message.error {
  background-color: #fef2f2;
  color: #dc2626;
  border: 1px solid #fca5a5;
}

.auth-message.success {
  background-color: #f0fdf4;
  color: #166534;
  border: 1px solid #86efac;
}

/* Layout Core (Sidebar + Main Content) */
.portal-body {
  display: flex;
  min-height: calc(100vh - 70px);
  width: 100%;
}

.portal-sidebar {
  width: 250px;
  background-color: #ffffff;
  border-right: 1px solid #e2e8f0;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-shrink: 0;
}

.portal-main {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  min-width: 0;
}

/* Method Toggle inside Activity Cards */
.method-toggle {
  display: flex;
  gap: 0.5rem;
  background: #f1f5f9;
  padding: 0.25rem;
  border-radius: 8px;
}

.method-toggle button {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}

.method-toggle button.active {
  background: #ffffff;
  color: #0b41cd;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.scan-box, .upload-box {
  margin: 1rem 0;
  display: block;
}

.scan-camera-button {
  width: 100%;
  padding: 0.75rem;
  background: #eff6ff;
  color: #0b41cd;
  border: 1px dashed #93c5fd;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.upload-box input {
  display: none;
}

.upload-hint {
  display: block;
  text-align: center;
  padding: 1rem;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  font-size: 0.85rem;
  cursor: pointer;
}

.log-button {
  width: 100%;
  background: #0b41cd;
  color: #ffffff;
  border: none;
  padding: 0.75rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.log-button:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

/* Modals */
.scanner-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 1rem;
}

.scanner-card {
  background: #000000;
  padding: 1rem;
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  text-align: center;
}

.scanner-video {
  width: 100%;
  max-height: 380px;
  border-radius: 12px;
  object-fit: cover;
}

.close-scanner {
  background: #ffffff;
  color: #0f172a;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  margin-bottom: 0.75rem;
  cursor: pointer;
}

/* Mobile Responsiveness (Celulares) */
@media (max-width: 768px) {
  .portal-body {
    flex-direction: column !important;
  }

  .portal-sidebar {
    width: 100% !important;
    border-right: none !important;
    border-bottom: 1px solid #e2e8f0 !important;
    padding: 0.75rem 1rem !important;
    flex-direction: row !important;
    overflow-x: auto !important;
    white-space: nowrap !important;
    -webkit-overflow-scrolling: touch;
  }

  .portal-sidebar button {
    width: auto !important;
    flex-shrink: 0 !important;
    padding: 0.5rem 0.85rem !important;
    font-size: 0.85rem !important;
  }

  .portal-main {
    padding: 1rem !important;
    width: 100% !important;
  }

  .passport-top-bar, .admin-header {
    padding: 0.75rem 1rem !important;
  }

  .passport-top-bar h1, .admin-header h1 {
    font-size: 1.1rem !important;
  }

  .points-panel {
    grid-template-columns: 1fr 1fr !important;
  }

  .community-manager-grid,
  .special-challenges-layout {
    grid-template-columns: 1fr !important;
  }
}
