const threadForm = document.querySelector('#threadForm');
const threadFeed = document.querySelector('#threadFeed');
const threadNote = document.querySelector('#threadNote');
const threadCount = document.querySelector('#threadCount');
const messageCount = document.querySelector('#messageCount');
const sortTabs = document.querySelectorAll('.sort-tabs .tab');

const API_BASE = window.FORUM_API_BASE || 'http://localhost:8787/api';
const TOKEN_KEY = 'polly_forum_token';

let currentSort = 'hot';
let backendAvailable = false;

const setThreadMessage = (message, isError = false) => {
  if (!threadNote) {
    return;
  }

  threadNote.textContent = message;
  threadNote.style.color = isError ? '#ffb7b7' : '#90ffd2';
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

const escapeHtml = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const formatTime = (value) => new Date(value).toLocaleString();

const checkBackend = async () => {
  try {
    const data = await api('/health');
    backendAvailable = data?.ok === true;
  } catch {
    backendAvailable = false;
  }
};

const getThreads = async () => {
  const payload = await api(`/threads?sort=${currentSort}`);
  return payload.threads || [];
};

const createThread = async (title, body) => {
  await api('/threads', {
    method: 'POST',
    body: JSON.stringify({ title, body })
  });
};

const addReply = async (threadId, text) => {
  await api(`/threads/${threadId}/replies`, {
    method: 'POST',
    body: JSON.stringify({ text })
  });
};

const upvoteThread = async (threadId) => {
  await api(`/threads/${threadId}/upvote`, {
    method: 'POST'
  });
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

  if (threadCount) {
    threadCount.textContent = String(threads.length);
  }
  if (messageCount) {
    messageCount.textContent = String(totalMessages);
  }

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
    currentSort = tab.dataset.sort || 'hot';

    try {
      await renderThreads();
    } catch (error) {
      setThreadMessage(error.message, true);
    }
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
    } catch (error) {
      setThreadMessage(error.message, true);
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
      } catch (error) {
        setThreadMessage(error.message, true);
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
    } catch (error) {
      setThreadMessage(error.message, true);
    }
  });
}

const boot = async () => {
  await checkBackend();
  if (!backendAvailable) {
    setThreadMessage('Backend not reachable. Start backend to use forum.');
    return;
  }

  await renderThreads();
};

boot();
