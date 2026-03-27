const sb = window.sb;
const form = document.querySelector('#messageForm');
const recipient = document.querySelector('#messageRecipient');
const body = document.querySelector('#messageBody');
const list = document.querySelector('#messagesList');
const msg = document.querySelector('#messagesMessage');
const refreshBtn = document.querySelector('#refreshMessagesBtn');
const markReadBtn = document.querySelector('#markMessagesReadBtn');

const setMessage = (text, error = false) => {
  if (!msg) {
    return;
  }
  msg.textContent = text;
  msg.style.color = error ? '#ffb7b7' : '#90ffd2';
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
    .from('direct_messages')
    .select('id,sender_id,recipient_id,sender_name,recipient_name,body,is_read,created_at')
    .or(`sender_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    setMessage(error.message, true);
    return;
  }

  list.innerHTML =
    !data || data.length === 0
      ? '<p class="note">No messages yet.</p>'
      : data
          .map((m) => {
            const incoming = m.recipient_id === session.user.id;
            const unread = incoming && !m.is_read ? ' unread' : '';
            const peer = incoming ? m.sender_name : m.recipient_name;
            const dir = incoming ? 'From' : 'To';
            return `<div class="mini-item${unread}"><span>${dir} ${peer}: ${m.body} - ${new Date(m.created_at).toLocaleString()}</span></div>`;
          })
          .join('');
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!sb) {
    return;
  }

  const {
    data: { session }
  } = await sb.auth.getSession();
  if (!session?.user) {
    setMessage('Please login first.', true);
    return;
  }

  const to = String(recipient?.value || '').trim().toLowerCase();
  const text = String(body?.value || '').trim();
  if (!to || !text) {
    setMessage('Add recipient and message body.', true);
    return;
  }

  const { data: target } = await sb.from('profiles').select('id,display_name').eq('email', to).single();
  const { data: me } = await sb.from('profiles').select('display_name').eq('id', session.user.id).single();
  if (!target) {
    setMessage('Recipient not found.', true);
    return;
  }

  const { error } = await sb.from('direct_messages').insert({
    sender_id: session.user.id,
    recipient_id: target.id,
    sender_name: me?.display_name || session.user.email,
    recipient_name: target.display_name,
    body: text
  });

  if (error) {
    setMessage(error.message, true);
    return;
  }

  await sb.from('notifications').insert({
    recipient_id: target.id,
    actor_id: session.user.id,
    kind: 'message',
    message: `${me?.display_name || session.user.email} sent you a message.`
  });

  form.reset();
  setMessage('Message sent.');
  await load();
});

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
  await sb.from('direct_messages').update({ is_read: true }).eq('recipient_id', session.user.id).eq('is_read', false);
  await load();
  setMessage('Received messages marked as read.');
});

load();
