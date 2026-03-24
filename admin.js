const sb = window.sb;

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

const guardSupabase = () => {
  if (!sb) {
    setMessage(window.__supabaseInitError || 'Supabase not configured.', true);
    return false;
  }
  return true;
};

const renderPending = (pendingUsers) => {
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
        <h3>${user.display_name || 'Member'}</h3>
        <p>${user.email}</p>
      </div>
      <button class="btn btn-primary" data-approve-id="${user.id}" type="button">Approve</button>
    `;
    adminPanel.appendChild(item);
  });
};

const loadPending = async () => {
  if (!guardSupabase()) {
    return;
  }

  const {
    data: { session }
  } = await sb.auth.getSession();

  if (!session?.user) {
    setMessage('Please login as admin first.', true);
    renderPending([]);
    return;
  }

  const { data: me, error: meError } = await sb
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (meError || !me?.is_admin) {
    setMessage('Access denied. Admin account only.', true);
    renderPending([]);
    return;
  }

  const { data, error } = await sb
    .from('profiles')
    .select('id,email,display_name,approved')
    .eq('approved', false)
    .order('created_at', { ascending: true });

  if (error) {
    setMessage(error.message, true);
    renderPending([]);
    return;
  }

  renderPending(data || []);
  setMessage(`Loaded ${data?.length || 0} pending users.`);
};

if (adminPanel) {
  adminPanel.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-approve-id]');
    if (!button) {
      return;
    }

    if (!guardSupabase()) {
      return;
    }

    const userId = button.getAttribute('data-approve-id');
    if (!userId) {
      return;
    }

    const { error } = await sb.from('profiles').update({ approved: true }).eq('id', userId);
    if (error) {
      setMessage(error.message, true);
      return;
    }

    setMessage('User approved.');
    await loadPending();
  });
}

if (refreshAdminBtn) {
  refreshAdminBtn.addEventListener('click', loadPending);
}

loadPending();
