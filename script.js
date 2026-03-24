const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
const revealItems = document.querySelectorAll('.reveal');

const tabs = document.querySelectorAll('.tab');
const forms = document.querySelectorAll('.auth-form');
const registerForm = document.querySelector('#registerForm');
const loginForm = document.querySelector('#loginForm');
const googleBtn = document.querySelector('#googleBtn');
const authMessage = document.querySelector('#authMessage');
const sessionPanel = document.querySelector('#sessionPanel');
const sessionText = document.querySelector('#sessionText');
const logoutBtn = document.querySelector('#logoutBtn');

const USERS_KEY = 'polly_tunnels_users';
const SESSION_KEY = 'polly_tunnels_session';

if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('open');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
    });
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.18 }
);

revealItems.forEach((item) => observer.observe(item));

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
  authMessage.style.color = isError ? '#ffb4b4' : '#92ffd8';
};

const setSession = (session) => {
  writeJSON(SESSION_KEY, session);
  renderSession();
};

const renderSession = () => {
  if (!sessionPanel || !sessionText) {
    return;
  }

  const session = readJSON(SESSION_KEY, null);

  if (!session || !session.email) {
    sessionPanel.hidden = true;
    sessionText.textContent = '';
    return;
  }

  sessionPanel.hidden = false;
  sessionText.textContent = `Logged in as ${session.name || session.email} (${session.provider})`;
};

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((btn) => {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    });

    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    const target = tab.dataset.tab;
    forms.forEach((form) => {
      form.classList.toggle('active', form.id === `${target}Form`);
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
    const exists = users.some((user) => user.email === email);

    if (exists) {
      setMessage('This email already exists. Please log in.', true);
      return;
    }

    users.push({ name, email, password });
    writeJSON(USERS_KEY, users);
    setSession({ name, email, provider: 'register' });
    setMessage(`Welcome, ${name}. Your account is ready.`);
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

    setSession({ name: match.name, email: match.email, provider: 'login' });
    setMessage(`Welcome back, ${match.name}.`);
    loginForm.reset();
  });
}

if (googleBtn) {
  googleBtn.addEventListener('click', () => {
    const googleSession = {
      name: 'Google User',
      email: `google_user_${Date.now()}@gmail.com`,
      provider: 'google-demo'
    };

    setSession(googleSession);
    setMessage('Google sign-in connected in demo mode.');
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    renderSession();
    setMessage('Logged out successfully.');
  });
}

renderSession();
