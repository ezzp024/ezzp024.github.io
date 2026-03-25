const sb = window.sb;

const userTitle = document.querySelector('#userTitle');
const userAvatar = document.querySelector('#userAvatar');
const userMeta = document.querySelector('#userMeta');
const userThreads = document.querySelector('#userThreads');
const userStats = document.querySelector('#userStats');

const getUserId = () => new URLSearchParams(window.location.search).get('id');

const fallbackAvatar = (name) => {
  const initial = encodeURIComponent(String(name || 'U').charAt(0).toUpperCase());
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%' height='100%' fill='%230b2948'/><text x='50%' y='55%' text-anchor='middle' font-family='Arial' font-size='52' fill='%2383ffd8'>${initial}</text></svg>`;
};

const loadUser = async () => {
  const id = getUserId();
  if (!id || !sb) {
    return;
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('id,display_name,email,avatar_url,created_at')
    .eq('id', id)
    .single();

  if (!profile) {
    if (userTitle) {
      userTitle.textContent = 'User Not Found';
    }
    return;
  }

  if (userTitle) {
    userTitle.textContent = profile.display_name;
  }
  if (userAvatar) {
    userAvatar.src = profile.avatar_url || fallbackAvatar(profile.display_name);
  }
  if (userMeta) {
    userMeta.textContent = `${profile.email} | Joined ${new Date(profile.created_at).toLocaleDateString()}`;
  }

  const { data: threads } = await sb
    .from('threads')
    .select('id,title,created_at')
    .eq('author_id', id)
    .order('created_at', { ascending: false })
    .limit(12);

  const { data: followers } = await sb.from('follows').select('follower_id').eq('following_id', id);
  const { data: following } = await sb.from('follows').select('following_id').eq('follower_id', id);

  if (userThreads) {
    userThreads.innerHTML =
      !threads || threads.length === 0
        ? '<p class="note">No threads yet.</p>'
        : threads.map((thread) => `<a class="mini-item" href="forum.html">${thread.title}</a>`).join('');
  }

  if (userStats) {
    userStats.innerHTML = `
      <div class="mini-item"><span>Threads: ${threads?.length || 0}</span></div>
      <div class="mini-item"><span>Followers: ${followers?.length || 0}</span></div>
      <div class="mini-item"><span>Following: ${following?.length || 0}</span></div>
    `;
  }
};

loadUser();
