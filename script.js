const menuToggle = document.querySelector('.menu-toggle');
const topnav = document.querySelector('.topnav');
const revealItems = document.querySelectorAll('.reveal');

const tabs = document.querySelectorAll('.tab');
const authForms = document.querySelectorAll('.auth-form');
const registerForm = document.querySelector('#registerForm');
const loginForm = document.querySelector('#loginForm');
const googleBtn = document.querySelector('#googleBtn');
const authMessage = document.querySelector('#authMessage');
const sessionPanel = document.querySelector('#sessionPanel');
const sessionText = document.querySelector('#sessionText');
const logoutBtn = document.querySelector('#logoutBtn');

const threadForm = document.querySelector('#threadForm');
const threadFeed = document.querySelector('#threadFeed');
const threadNote = document.querySelector('#threadNote');
const threadCount = document.querySelector('#threadCount');
const messageCount = document.querySelector('#messageCount');

const USERS_KEY = 'polly_forum_users';
const SESSION_KEY = 'polly_forum_session';
const THREADS_KEY = 'polly_forum_threads';

if (menuToggle && topnav) {
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    topnav.classList.toggle('open');
  });

  topnav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      topnav.classList.remove('open');
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
  { threshold: 0.16 }
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

const formatTime = (value) => new Date(value).toLocaleString();

const setAuthMessage = (msg, error = false) => {
  if (!authMessage) {
    return;
  }

  authMessage.textContent = msg;
  authMessage.style.color = error ? '#ffb7b7' : '#91ffd3';
};

const setThreadMessage = (msg, error = false) => {
  if (!threadNote) {
    return;
  }

  threadNote.textContent = msg;
  threadNote.style.color = error ? '#ffb7b7' : '#91ffd3';
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
  sessionText.textContent = `Signed in as ${session.name || session.email} (${session.provider})`;
};

const setSession = (session) => {
  writeJSON(SESSION_KEY, session);
  renderSession();
};

const ensureDefaultThreads = () => {
  const existing = readJSON(THREADS_KEY, []);
  if (existing.length > 0) {
    return;
  }

  const seed = [
    {
      id: `t-${Date.now()}`,
      title: 'Best tools for shipping full-stack projects faster?',
      body: 'I am building quickly and want a stack that stays clean over time. What do you recommend?',
      author: 'Polly',
      createdAt: Date.now() - 7200000,
      replies: [
        {
          id: `r-${Date.now()}-1`,
          author: 'WaveSyntax',
          text: 'Use a simple starter and focus on deployment flow early.',
          createdAt: Date.now() - 6800000
        }
      ]
    },
    {
      id: `t-${Date.now()}-2`,
      title: 'How do you debug random production crashes?',
      body: 'Looking for a practical checklist to catch hidden runtime problems.',
      author: 'TunnelByte',
      createdAt: Date.now() - 3600000,
      replies: []
    }
  ];

  writeJSON(THREADS_KEY, seed);
};

const escapeHtml = (text) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const renderThreads = () => {
  if (!threadFeed) {
    return;
  }

  const threads = readJSON(THREADS_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
  threadFeed.innerHTML = '';

  if (threads.length === 0) {
    threadFeed.innerHTML = '<p class="note">No threads yet. Start the first conversation.</p>';
  }

  let totalMessages = 0;

  threads.forEach((thread) => {
    totalMessages += 1 + thread.replies.length;
    const repliesHTML = thread.replies
      .map(
        (reply) => `
          <article class="reply">
            <div class="reply-top">
              <strong>${escapeHtml(reply.author)}</strong>
              <span>${formatTime(reply.createdAt)}</span>
            </div>
            <p>${escapeHtml(reply.text)}</p>
          </article>
        `
      )
      .join('');

    const item = document.createElement('article');
    item.className = 'thread';
    item.innerHTML = `
      <div class="thread-head">
        <h3>${escapeHtml(thread.title)}</h3>
        <span class="meta">${escapeHtml(thread.author)} | ${formatTime(thread.createdAt)}</span>
      </div>
      <p>${escapeHtml(thread.body)}</p>
      <section class="replies">
        ${repliesHTML || '<p class="note">No replies yet.</p>'}
      </section>
      <form class="reply-form" data-thread-id="${thread.id}">
        <input name="reply" maxlength="240" required placeholder="Write a reply..." />
        <button class="btn btn-ghost" type="submit">Reply</button>
      </form>
    `;

    threadFeed.appendChild(item);
  });

  if (threadCount) {
    threadCount.textContent = String(threads.length);
  }

  if (messageCount) {
    messageCount.textContent = String(totalMessages);
  }
};

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((item) => {
      item.classList.remove('active');
      item.setAttribute('aria-selected', 'false');
    });

    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    const target = `${tab.dataset.tab}Form`;
    authForms.forEach((form) => {
      form.classList.toggle('active', form.id === target);
    });

    setAuthMessage('');
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
      setAuthMessage('Please complete all fields correctly.', true);
      return;
    }

    const users = readJSON(USERS_KEY, []);
    if (users.some((user) => user.email === email)) {
      setAuthMessage('Email already registered. Please login.', true);
      return;
    }

    users.push({ name, email, password });
    writeJSON(USERS_KEY, users);
    setSession({ name, email, provider: 'register' });
    setAuthMessage(`Welcome ${name}, your account is active.`);
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
      setAuthMessage('Invalid login details.', true);
      return;
    }

    setSession({ name: match.name, email: match.email, provider: 'login' });
    setAuthMessage(`Welcome back ${match.name}.`);
    loginForm.reset();
  });
}

if (googleBtn) {
  googleBtn.addEventListener('click', () => {
    const session = {
      name: 'Google User',
      email: `google_${Date.now()}@gmail.com`,
      provider: 'google-demo'
    };

    setSession(session);
    setAuthMessage('Google login connected in demo mode.');
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    renderSession();
    setAuthMessage('Logged out.');
  });
}

if (threadForm) {
  threadForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(threadForm);
    const title = String(data.get('title') || '').trim();
    const body = String(data.get('body') || '').trim();

    if (!title || !body) {
      setThreadMessage('Please add a title and message.', true);
      return;
    }

    const session = readJSON(SESSION_KEY, null);
    const author = session?.name || 'Guest Coder';

    const threads = readJSON(THREADS_KEY, []);
    threads.push({
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      body,
      author,
      createdAt: Date.now(),
      replies: []
    });

    writeJSON(THREADS_KEY, threads);
    renderThreads();
    setThreadMessage('Thread posted to the community feed.');
    threadForm.reset();
  });
}

if (threadFeed) {
  threadFeed.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('reply-form')) {
      return;
    }

    event.preventDefault();
    const input = form.querySelector('input[name="reply"]');
    const threadId = form.getAttribute('data-thread-id');

    if (!input || !threadId) {
      return;
    }

    const text = input.value.trim();
    if (!text) {
      setThreadMessage('Reply text cannot be empty.', true);
      return;
    }

    const threads = readJSON(THREADS_KEY, []);
    const session = readJSON(SESSION_KEY, null);
    const author = session?.name || 'Guest Coder';

    const target = threads.find((thread) => thread.id === threadId);
    if (!target) {
      setThreadMessage('Thread not found.', true);
      return;
    }

    target.replies.push({
      id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      author,
      text,
      createdAt: Date.now()
    });

    writeJSON(THREADS_KEY, threads);
    renderThreads();
    setThreadMessage('Reply added.');
  });
}

ensureDefaultThreads();
renderSession();
renderThreads();
