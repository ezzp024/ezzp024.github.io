const threadForm = document.querySelector('#threadForm');
const threadFeed = document.querySelector('#threadFeed');
const threadNote = document.querySelector('#threadNote');
const threadCount = document.querySelector('#threadCount');
const messageCount = document.querySelector('#messageCount');
const sortTabs = document.querySelectorAll('.sort-tabs .tab');

const SESSION_KEY = 'polly_forum_session';
const FALLBACK_THREADS_KEY = 'polly_forum_threads_local';
const API_BASE = window.FORUM_API_BASE || 'http://localhost:8787/api';

let currentSort = 'hot';
let backendAvailable = false;

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

const getSessionName = () => {
  const session = readJSON(SESSION_KEY, null);
  return session?.name || 'Guest Coder';
};

const setThreadMessage = (message, isError = false) => {
  if (!threadNote) {
    return;
  }

  threadNote.textContent = message;
  threadNote.style.color = isError ? '#ffb7b7' : '#90ffd2';
};

const escapeHtml = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const formatTime = (value) => new Date(value).toLocaleString();

const hotScore = (thread) => {
  const ageHours = Math.max((Date.now() - Number(thread.createdAt || Date.now())) / 3600000, 1);
  const replyCount = Array.isArray(thread.replies) ? thread.replies.length : 0;
  const upvotes = Number(thread.upvotes || 0);
  return upvotes * 3 + replyCount * 2 - ageHours * 0.1;
};

const sortThreads = (threads) => {
  const list = [...threads];
  if (currentSort === 'new') {
    return list.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  }
  return list.sort((a, b) => hotScore(b) - hotScore(a));
};

const fallbackSeedThreads = () => {
  const existing = readJSON(FALLBACK_THREADS_KEY, []);
  if (existing.length > 0) {
    return;
  }

  writeJSON(FALLBACK_THREADS_KEY, [
    {
      id: `t-${Date.now()}-1`,
      title: 'How do you debug random production crashes?',
      body: 'Looking for practical steps for hard-to-reproduce issues.',
      author: 'Polly',
      createdAt: Date.now() - 7200000,
      upvotes: 4,
      replies: [
        {
          id: `r-${Date.now()}-1`,
          author: 'WaveSyntax',
          text: 'Start with traces and error boundaries. Record user context.',
          createdAt: Date.now() - 6500000
        }
      ]
    }
  ]);
};

const api = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
};

const checkBackend = async () => {
  try {
    const data = await api('/health');
    backendAvailable = data?.ok === true;
  } catch {
    backendAvailable = false;
  }
};

const getThreads = async () => {
  if (backendAvailable) {
    const payload = await api(`/threads?sort=${currentSort}`);
    return payload.threads || [];
  }

  fallbackSeedThreads();
  return sortThreads(readJSON(FALLBACK_THREADS_KEY, []));
};

const saveFallbackThreads = (threads) => {
  writeJSON(FALLBACK_THREADS_KEY, threads);
};

const createThread = async (title, body) => {
  const payload = {
    title,
    body,
    author: getSessionName()
  };

  if (backendAvailable) {
    await api('/threads', { method: 'POST', body: JSON.stringify(payload) });
    return;
  }

  const threads = readJSON(FALLBACK_THREADS_KEY, []);
  threads.push({
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    body,
    author: payload.author,
    createdAt: Date.now(),
    upvotes: 0,
    replies: []
  });
  saveFallbackThreads(threads);
};

const addReply = async (threadId, text) => {
  const payload = { text, author: getSessionName() };

  if (backendAvailable) {
    await api(`/threads/${threadId}/replies`, { method: 'POST', body: JSON.stringify(payload) });
    return;
  }

  const threads = readJSON(FALLBACK_THREADS_KEY, []);
  const target = threads.find((thread) => thread.id === threadId);
  if (!target) {
    throw new Error('Thread not found');
  }
  target.replies.push({
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    author: payload.author,
    createdAt: Date.now()
  });
  saveFallbackThreads(threads);
};

const upvoteThread = async (threadId) => {
  if (backendAvailable) {
    await api(`/threads/${threadId}/upvote`, { method: 'POST' });
    return;
  }

  const threads = readJSON(FALLBACK_THREADS_KEY, []);
  const target = threads.find((thread) => thread.id === threadId);
  if (!target) {
    throw new Error('Thread not found');
  }
  target.upvotes = Number(target.upvotes || 0) + 1;
  saveFallbackThreads(threads);
};

const renderThreads = async () => {
  if (!threadFeed) {
    return;
  }

  const threads = await getThreads();
  threadFeed.innerHTML = '';

  const totalMessages = threads.reduce(
    (sum, thread) => sum + 1 + (Array.isArray(thread.replies) ? thread.replies.length : 0),
    0
  );

  threadCount.textContent = String(threads.length);
  messageCount.textContent = String(totalMessages);

  if (threads.length === 0) {
    threadFeed.innerHTML = '<p class="note">No threads yet. Start the first one.</p>';
    return;
  }

  threads.forEach((thread) => {
    const replies = Array.isArray(thread.replies) ? thread.replies : [];
    const repliesHTML = replies
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
      <div class="thread-top">
        <div>
          <h3>${escapeHtml(thread.title)}</h3>
          <span class="thread-meta">${escapeHtml(thread.author)} | ${formatTime(thread.createdAt)}</span>
        </div>
        <span class="thread-meta">${replies.length} replies</span>
      </div>
      <p>${escapeHtml(thread.body)}</p>
      <div class="thread-controls">
        <button class="control-btn" data-action="upvote" data-thread-id="${thread.id}">Upvote (${Number(thread.upvotes || 0)})</button>
        <button class="control-btn" data-action="collapse" data-thread-id="${thread.id}">Collapse</button>
      </div>
      <section class="replies" data-replies-id="${thread.id}">
        ${repliesHTML || '<p class="note">No replies yet.</p>'}
      </section>
      <form class="reply-form" data-thread-id="${thread.id}">
        <input name="reply" maxlength="250" required placeholder="Write a reply..." />
        <button class="btn btn-ghost" type="submit">Reply</button>
      </form>
    `;

    threadFeed.appendChild(item);
  });
};

sortTabs.forEach((tab) => {
  tab.addEventListener('click', async () => {
    sortTabs.forEach((item) => {
      item.classList.remove('active');
      item.setAttribute('aria-selected', 'false');
    });

    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    currentSort = tab.dataset.sort;
    await renderThreads();
  });
});

if (threadForm) {
  threadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(threadForm);
    const title = String(data.get('title') || '').trim();
    const body = String(data.get('body') || '').trim();

    if (!title || !body) {
      setThreadMessage('Please add title and message.', true);
      return;
    }

    try {
      await createThread(title, body);
      threadForm.reset();
      await renderThreads();
      setThreadMessage('Thread created.');
    } catch {
      setThreadMessage('Could not create thread right now.', true);
    }
  });
}

if (threadFeed) {
  threadFeed.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const action = button.getAttribute('data-action');
    const threadId = button.getAttribute('data-thread-id');
    if (!action || !threadId) {
      return;
    }

    if (action === 'upvote') {
      try {
        await upvoteThread(threadId);
        await renderThreads();
      } catch {
        setThreadMessage('Could not upvote this thread.', true);
      }
      return;
    }

    if (action === 'collapse') {
      const replies = threadFeed.querySelector(`[data-replies-id="${threadId}"]`);
      if (!replies) {
        return;
      }

      const collapsed = replies.classList.toggle('collapsed');
      button.textContent = collapsed ? 'Expand' : 'Collapse';
    }
  });

  threadFeed.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('reply-form')) {
      return;
    }

    event.preventDefault();
    const threadId = form.getAttribute('data-thread-id');
    const input = form.querySelector('input[name="reply"]');
    if (!threadId || !input) {
      return;
    }

    const text = input.value.trim();
    if (!text) {
      setThreadMessage('Reply cannot be empty.', true);
      return;
    }

    try {
      await addReply(threadId, text);
      await renderThreads();
      setThreadMessage('Reply posted.');
    } catch {
      setThreadMessage('Could not post reply right now.', true);
    }
  });
}

const boot = async () => {
  await checkBackend();
  if (!backendAvailable) {
    setThreadMessage('Using local mode. Start backend for global shared posts.');
  }
  await renderThreads();
};

boot();
