const USERS_KEY = 'polly_forum_users';
const SESSION_KEY = 'polly_forum_session';

const registerForm = document.querySelector('#registerForm');
const loginForm = document.querySelector('#loginForm');
const googleBtn = document.querySelector('#googleBtn');
const authMessage = document.querySelector('#authMessage');
const sessionPanel = document.querySelector('#sessionPanel');
const sessionText = document.querySelector('#sessionText');
const logoutBtn = document.querySelector('#logoutBtn');
const authTabs = document.querySelectorAll('.auth-tab');
const forms = document.querySelectorAll('.auth-form');

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const setMessage = (message, isError = false) => {
  if (!authMessage) {
    return;
  }

  authMessage.textContent = message;
  authMessage.style.color = isError ? '#ffb7b7' : '#90ffd2';
};

const renderSession = () => {
  const session = readJSON(SESSION_KEY, null);
  if (!session || !session.email) {
    sessionPanel.hidden = true;
    sessionText.textContent = '';
    return;
  }

  sessionPanel.hidden = false;
  sessionText.textContent = `Logged in as ${session.name || session.email} (${session.provider})`;
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

if (registerForm) {
  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(registerForm);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');

    if (!name || !email || password.length < 6) {
      setMessage('Please complete all fields correctly.', true);
      return;
    }

    const users = readJSON(USERS_KEY, []);
    if (users.some((user) => user.email === email)) {
      setMessage('Email already registered. Please login.', true);
      return;
    }

    users.push({ name, email, password });
    writeJSON(USERS_KEY, users);
    writeJSON(SESSION_KEY, { name, email, provider: 'register' });
    renderSession();
    setMessage(`Welcome ${name}. Your account is active.`);
    registerForm.reset();
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(loginForm);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');

    const users = readJSON(USERS_KEY, []);
    const match = users.find((user) => user.email === email && user.password === password);
    if (!match) {
      setMessage('Invalid email or password.', true);
      return;
    }

    writeJSON(SESSION_KEY, { name: match.name, email: match.email, provider: 'login' });
    renderSession();
    setMessage(`Welcome back ${match.name}.`);
    loginForm.reset();
  });
}

if (googleBtn) {
  googleBtn.addEventListener('click', () => {
    writeJSON(SESSION_KEY, {
      name: 'Google User',
      email: `google_${Date.now()}@gmail.com`,
      provider: 'google-demo'
    });
    renderSession();
    setMessage('Google login connected in demo mode.');
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    renderSession();
    setMessage('Logged out.');
  });
}

renderSession();
