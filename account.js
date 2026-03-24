const API_BASE = window.FORUM_API_BASE || 'http://localhost:8787/api';
const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || '';
const TOKEN_KEY = 'polly_forum_token';

const registerForm = document.querySelector('#registerForm');
const loginForm = document.querySelector('#loginForm');
const sendCodeBtn = document.querySelector('#sendCodeBtn');
const googleBtn = document.querySelector('#googleBtn');
const googleFallbackBtn = document.querySelector('#googleFallbackBtn');
const authMessage = document.querySelector('#authMessage');
const sessionPanel = document.querySelector('#sessionPanel');
const sessionText = document.querySelector('#sessionText');
const logoutBtn = document.querySelector('#logoutBtn');
const authTabs = document.querySelectorAll('.auth-tab');
const forms = document.querySelectorAll('.auth-form');

const setMessage = (message, isError = false) => {
  if (!authMessage) {
    return;
  }

  authMessage.textContent = message;
  authMessage.style.color = isError ? '#ffb7b7' : '#90ffd2';
};

const api = async (path, options = {}) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return payload;
};

const renderSession = async () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    sessionPanel.hidden = true;
    sessionText.textContent = '';
    return;
  }

  try {
    const payload = await api('/auth/me');
    const user = payload.user;
    sessionPanel.hidden = false;
    sessionText.textContent = `Logged in as ${user.name} (${user.email})${user.isAdmin ? ' | Admin' : ''}`;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    sessionPanel.hidden = true;
    sessionText.textContent = '';
  }
};

authTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    authTabs.forEach((item) => {
      item.classList.remove('active');
      item.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    forms.forEach((form) => {
      form.classList.toggle('active', form.id === `${tab.dataset.authTab}Form`);
    });

    setMessage('');
  });
});

if (sendCodeBtn && registerForm) {
  sendCodeBtn.addEventListener('click', async () => {
    const data = new FormData(registerForm);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');

    if (!name || !email || password.length < 6) {
      setMessage('Add name, email, and password first.', true);
      return;
    }

    try {
      await api('/auth/register/start', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      setMessage('Verification code sent. Check your email inbox.');
    } catch (error) {
      setMessage(error.message, true);
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(registerForm);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const code = String(data.get('code') || '').trim();

    if (!email || code.length !== 6) {
      setMessage('Enter your email and 6-digit verification code.', true);
      return;
    }

    try {
      const payload = await api('/auth/register/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code })
      });

      if (payload.pendingApproval) {
        setMessage('Email verified. Waiting for admin approval before login.');
      } else {
        setMessage('Email verified and account ready. Please login now.');
      }

      registerForm.reset();
    } catch (error) {
      setMessage(error.message, true);
    }
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(loginForm);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');

    if (!email || !password) {
      setMessage('Please fill login fields.', true);
      return;
    }

    try {
      const payload = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      localStorage.setItem(TOKEN_KEY, payload.token);
      await renderSession();
      setMessage(`Welcome back ${payload.user.name}.`);
      loginForm.reset();
    } catch (error) {
      setMessage(error.message, true);
    }
  });
}

const handleGoogleCredential = async (response) => {
  try {
    const payload = await api('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: response.credential })
    });
    localStorage.setItem(TOKEN_KEY, payload.token);
    await renderSession();
    setMessage(`Google login successful. Welcome ${payload.user.name}.`);
  } catch (error) {
    setMessage(error.message, true);
  }
};

const initGoogleLogin = () => {
  if (!window.google || !GOOGLE_CLIENT_ID) {
    if (googleFallbackBtn) {
      googleFallbackBtn.style.display = 'inline-flex';
    }
    return;
  }

  if (googleFallbackBtn) {
    googleFallbackBtn.style.display = 'none';
  }

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential
  });

  if (googleBtn) {
    window.google.accounts.id.renderButton(googleBtn, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'continue_with'
    });
  }
};

if (googleFallbackBtn) {
  googleFallbackBtn.addEventListener('click', () => {
    setMessage('Google client is not configured yet.', true);
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    renderSession();
    setMessage('Logged out.');
  });
}

renderSession();
initGoogleLogin();
