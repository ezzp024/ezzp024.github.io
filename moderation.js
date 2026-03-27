const sb = window.sb;
const info = document.querySelector('#moderationInfo');
const myReports = document.querySelector('#myReports');
const adminWrap = document.querySelector('#adminReportsWrap');
const adminReports = document.querySelector('#adminReports');
const refreshBtn = document.querySelector('#refreshReportsBtn');
const message = document.querySelector('#moderationMessage');

const setMessage = (text, error = false) => {
  if (!message) {
    return;
  }
  message.textContent = text;
  message.style.color = error ? '#ffb7b7' : '#90ffd2';
};

const load = async () => {
  if (!sb || !myReports) {
    return;
  }

  const {
    data: { session }
  } = await sb.auth.getSession();
  if (!session?.user) {
    myReports.innerHTML = '<p class="note">Please login first.</p>';
    return;
  }

  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', session.user.id).single();
  if (info) {
    info.textContent = profile?.is_admin
      ? 'You can resolve open reports as admin.'
      : 'Track reports you submitted. Moderators review open reports.';
  }

  const { data: mine, error: mineError } = await sb
    .from('reports')
    .select('id,target_type,target_id,reason,status,created_at')
    .eq('reporter_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(80);

  if (mineError) {
    setMessage(mineError.message, true);
    return;
  }

  myReports.innerHTML =
    !mine || mine.length === 0
      ? '<p class="note">No reports filed yet.</p>'
      : mine
          .map(
            (r) =>
              `<div class="mini-item"><span>${r.target_type} #${r.target_id} | ${r.reason} | ${r.status} | ${new Date(r.created_at).toLocaleString()}</span></div>`
          )
          .join('');

  if (!profile?.is_admin) {
    if (adminWrap) {
      adminWrap.hidden = true;
    }
    return;
  }

  if (adminWrap) {
    adminWrap.hidden = false;
  }

  const { data: queue, error: queueError } = await sb
    .from('reports')
    .select('id,target_type,target_id,reason,status,created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(100);

  if (queueError) {
    setMessage(queueError.message, true);
    return;
  }

  if (adminReports) {
    adminReports.innerHTML =
      !queue || queue.length === 0
        ? '<p class="note">No open reports.</p>'
        : queue
            .map(
              (r) =>
                `<div class="mini-item"><span>${r.target_type} #${r.target_id} - ${r.reason}</span><button class="control-btn" data-resolve-report="${r.id}" type="button">Resolve</button></div>`
            )
            .join('');
  }
};

adminReports?.addEventListener('click', async (event) => {
  const btn = event.target.closest('button[data-resolve-report]');
  if (!btn || !sb) {
    return;
  }

  const {
    data: { session }
  } = await sb.auth.getSession();
  if (!session?.user) {
    return;
  }

  const reportId = Number(btn.getAttribute('data-resolve-report'));
  if (!reportId) {
    return;
  }

  const { error } = await sb
    .from('reports')
    .update({ status: 'resolved', resolved_by: session.user.id, resolved_at: new Date().toISOString() })
    .eq('id', reportId);

  if (error) {
    setMessage(error.message, true);
    return;
  }

  setMessage('Report resolved.');
  await load();
});

refreshBtn?.addEventListener('click', load);

load();
