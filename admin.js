const API_BASE = window.FORUM_API_BASE || 'http://localhost:8787/api';
const TOKEN_KEY = 'polly_forum_token';

const adminPanel = document.querySelector('#adminPanel');
const adminMessage = document.querySelector('#adminMessage');
const refreshAdminBtn = document.querySelector('#refreshAdminBtn');

const setMessage = (message, isError = false) => {
  if (!adminMessage) {
    return;
  }
  adminMessage.textContent = message;
  adminMessage.style.color = isError ? '#ffb7b7' : '#90ffd2';
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

const renderPending = (pendingUsers) => {
  if (!adminPanel) {
    return;
  }

  adminPanel.innerHTML = '';

  if (!pendingUsers.length) {
    adminPanel.innerHTML = '<p class="note">No pending users right now.</p>';
    return;
  }

  pendingUsers.forEach((user) => {
    const item = document.createElement('article');
    item.className = 'admin-item';
    item.innerHTML = `
      <div>
        <h3>${user.name}</h3>
        <p>${user.email}</p>
      </div>
      <button class="btn btn-primary" data-approve-email="${user.email}" type="button">Approve</button>
    `;
    adminPanel.appendChild(item);
  });
};

const loadPending = async () => {
  try {
    const me = await api('/auth/me');
    if (!me.user?.isAdmin) {
      setMessage('Access denied. Admin email only.', true);
      renderPending([]);
      return;
    }

    const payload = await api('/admin/pending-users');
    renderPending(payload.pendingUsers || []);
    setMessage(`Loaded ${payload.pendingUsers?.length || 0} pending users.`);
  } catch (error) {
    setMessage(error.message, true);
    renderPending([]);
  }
};

if (adminPanel) {
  adminPanel.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-approve-email]');
    if (!button) {
      return;
    }

    const email = button.getAttribute('data-approve-email');
    if (!email) {
      return;
    }

    try {
      await api('/admin/approve', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      setMessage(`${email} approved.`);
      await loadPending();
    } catch (error) {
      setMessage(error.message, true);
    }
  });
}

if (refreshAdminBtn) {
  refreshAdminBtn.addEventListener('click', loadPending);
}

loadPending();
