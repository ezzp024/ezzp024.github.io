const sb = window.sb;
const list = document.querySelector('#notificationsList');
const message = document.querySelector('#notificationsMessage');
const refreshBtn = document.querySelector('#refreshNotificationsBtn');
const markReadBtn = document.querySelector('#markReadBtn');

const setMessage = (text, error = false) => {
  if (!message) {
    return;
  }
  message.textContent = text;
  message.style.color = error ? '#ffb7b7' : '#90ffd2';
};

const load = async () => {
  if (!sb || !list) {
    return;
  }
  const {
    data: { session }
  } = await sb.auth.getSession();
  if (!session?.user) {
    list.innerHTML = '<p class="note">Please login first.</p>';
    return;
  }

  const { data, error } = await sb
    .from('notifications')
    .select('id,message,is_read,thread_id,created_at')
    .eq('recipient_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    setMessage(error.message, true);
    return;
  }

  list.innerHTML =
    !data || data.length === 0
      ? '<p class="note">No notifications yet.</p>'
      : data
          .map((n) => {
            const unread = n.is_read ? '' : ' unread';
            const open = n.thread_id ? `<a class="control-btn" href="forum.html?t=${n.thread_id}">Open</a>` : '';
            return `<div class="mini-item${unread}"><span>${n.message} - ${new Date(n.created_at).toLocaleString()}</span>${open}</div>`;
          })
          .join('');
};

refreshBtn?.addEventListener('click', load);
markReadBtn?.addEventListener('click', async () => {
  if (!sb) {
    return;
  }
  const {
    data: { session }
  } = await sb.auth.getSession();
  if (!session?.user) {
    return;
  }
  await sb.from('notifications').update({ is_read: true }).eq('recipient_id', session.user.id);
  await load();
  setMessage('Marked as read.');
});

load();
