const sb = window.sb;

const guestAuthSection = document.querySelector('#guestAuthSection');
const accountHeading = document.querySelector('#accountHeading');
const accountSub = document.querySelector('#accountSub');
const registerForm = document.querySelector('#registerForm');
const loginForm = document.querySelector('#loginForm');
const sendCodeBtn = document.querySelector('#sendCodeBtn');
const googleBtn = document.querySelector('#googleBtn');
const googleFallbackBtn = document.querySelector('#googleFallbackBtn');
const authMessage = document.querySelector('#authMessage');
const sessionPanel = document.querySelector('#sessionPanel');
const sessionText = document.querySelector('#sessionText');
const logoutBtn = document.querySelector('#logoutBtn');

const profileForm = document.querySelector('#profileForm');
const profileName = document.querySelector('#profileName');
const profileEmail = document.querySelector('#profileEmail');
const avatarForm = document.querySelector('#avatarForm');
const avatarInput = document.querySelector('#avatarInput');
const profileAvatar = document.querySelector('#profileAvatar');
const passwordForm = document.querySelector('#passwordForm');
const newPassword = document.querySelector('#newPassword');
const confirmPassword = document.querySelector('#confirmPassword');
const linkGoogleBtn = document.querySelector('#linkGoogleBtn');

const followForm = document.querySelector('#followForm');
const followEmail = document.querySelector('#followEmail');
const networkStats = document.querySelector('#networkStats');
const followingList = document.querySelector('#followingList');
const followersList = document.querySelector('#followersList');
const activityStats = document.querySelector('#activityStats');
const myThreads = document.querySelector('#myThreads');
const likedThreads = document.querySelector('#likedThreads');

const authTabs = document.querySelectorAll('.auth-tab');
const authForms = document.querySelectorAll('.auth-form');
const accountTabs = document.querySelectorAll('.account-tab');
const accountPanels = document.querySelectorAll('.account-panel');

const uiPrefsForm = document.querySelector('#uiPrefsForm');
const compactLayout = document.querySelector('#compactLayout');
const reduceMotion = document.querySelector('#reduceMotion');
const hideSocial = document.querySelector('#hideSocial');
const defaultFeedSort = document.querySelector('#defaultFeedSort');

const REG_DRAFT_KEY = 'polly_reg_draft';
const ACCOUNT_UI_PREFS_KEY = 'polly_ui_prefs';

const setMessage = (message, isError = false) => {
  if (!authMessage) {
    return;
  }
  authMessage.textContent = message;
  authMessage.style.color = isError ? '#ffb7b7' : '#90ffd2';
};

const guardSupabase = () => {
  if (!sb) {
    setMessage(window.__supabaseInitError || 'Supabase not configured.', true);
    return false;
  }
  return true;
};

const getDraft = () => {
  try {
    const raw = localStorage.getItem(REG_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveDraft = (value) => {
  localStorage.setItem(REG_DRAFT_KEY, JSON.stringify(value));
};

const clearDraft = () => {
  localStorage.removeItem(REG_DRAFT_KEY);
};

const getAccountRedirectUrl = () => {
  const url = new URL('account.html', window.location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
};

const startGoogleLogin = async () => {
  setMessage('Starting Google sign-in...');

  if (!guardSupabase()) {
    return;
  }

  try {
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAccountRedirectUrl() }
    });

    if (error) {
      setMessage(error.message, true);
      return;
    }

    if (data?.url) {
      window.location.assign(data.url);
      return;
    }

    const base = String(window.SUPABASE_URL || '').trim();
    if (!base) {
      setMessage('Supabase URL missing; cannot start Google sign-in.', true);
      return;
    }

    const fallbackUrl = `${base}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(getAccountRedirectUrl())}`;
    window.location.assign(fallbackUrl);
  } catch (error) {
    setMessage(error?.message || 'Google login failed to start.', true);
  }
};

const showCallbackErrorFromUrl = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const error = searchParams.get('error') || hashParams.get('error');
  const description = searchParams.get('error_description') || hashParams.get('error_description');

  if (!error) {
    return;
  }

  const message = description ? `${error}: ${description}` : error;
  setMessage(message, true);

  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('error');
  cleanUrl.searchParams.delete('error_description');
  cleanUrl.searchParams.delete('error_code');
  cleanUrl.hash = '';
  window.history.replaceState({}, '', cleanUrl.toString());
};

const setAuthForm = (tabName) => {
  authTabs.forEach((item) => {
    const active = item.dataset.authTab === tabName;
    item.classList.toggle('active', active);
    item.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  authForms.forEach((form) => {
    form.classList.toggle('active', form.id === `${tabName}Form`);
  });
};

const setAccountPanel = (panelName) => {
  if (accountTabs.length === 0 || accountPanels.length === 0) {
    return;
  }

  const target = panelName || 'profile';
  accountTabs.forEach((item) => item.classList.toggle('active', item.dataset.panel === target));
  accountPanels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === target));

  if (window.location.hash !== `#${target}`) {
    window.history.replaceState({}, '', `#${target}`);
  }
};

const getPanelFromHash = () => {
  const value = window.location.hash.replace('#', '').trim();
  const valid = new Set(['profile', 'settings', 'network', 'activity']);
  return valid.has(value) ? value : 'profile';
};

const setUiForLoggedState = (loggedIn) => {
  if (guestAuthSection) {
    guestAuthSection.hidden = loggedIn;
  }
  if (sessionPanel) {
    sessionPanel.hidden = !loggedIn;
  }

  if (!loggedIn) {
    setAuthForm('register');
    if (accountHeading) {
      accountHeading.textContent = 'Register or Login';
    }
    if (accountSub) {
      accountSub.textContent = 'Secure sign-in and account setup for posting, messaging, and moderation workflows.';
    }
  } else {
    if (accountHeading) {
      accountHeading.textContent = 'My Account';
    }
    if (accountSub) {
      accountSub.textContent = 'Manage your profile, settings, social graph, and activity.';
    }
  }
};

const readUiPrefs = () => {
  if (typeof window.getUiPrefs === 'function') {
    return window.getUiPrefs();
  }
  try {
    const raw = localStorage.getItem(ACCOUNT_UI_PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeUiPrefs = (value) => {
  localStorage.setItem(ACCOUNT_UI_PREFS_KEY, JSON.stringify(value));
  if (typeof window.applyUiPrefs === 'function') {
    window.applyUiPrefs();
  }
};

const hydrateUiPrefsForm = () => {
  const prefs = readUiPrefs();
  if (compactLayout) compactLayout.checked = Boolean(prefs.compactLayout);
  if (reduceMotion) reduceMotion.checked = Boolean(prefs.reduceMotion);
  if (hideSocial) hideSocial.checked = Boolean(prefs.hideSocial);
  if (defaultFeedSort) defaultFeedSort.value = prefs.defaultFeedSort === 'new' ? 'new' : 'hot';
};

const ensureProfile = async (user, fallbackName = '') => {
  const email = String(user.email || '').toLowerCase();
  const displayName =
    String(user.user_metadata?.display_name || '').trim() || fallbackName || email.split('@')[0] || 'Member';

  const { error } = await sb
    .from('profiles')
    .upsert({ id: user.id, email, display_name: displayName }, { onConflict: 'id' });
  if (error) {
    throw error;
  }
};

const getProfile = async (userId) => {
  const { data, error } = await sb
    .from('profiles')
    .select('id,email,display_name,avatar_url,approved,is_admin')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }
  return data;
};

const renderAvatar = (url, displayName) => {
  if (!profileAvatar) {
    return;
  }

  if (url) {
    profileAvatar.src = url;
    return;
  }

  const initial = encodeURIComponent(String(displayName || 'U').charAt(0).toUpperCase());
  profileAvatar.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%' height='100%' fill='%230b2948'/><text x='50%' y='55%' text-anchor='middle' font-family='Arial' font-size='52' fill='%2383ffd8'>${initial}</text></svg>`;
};

const loadNetwork = async (userId) => {
  if (!networkStats) return;

  const { data: followingRows, error: followingError } = await sb
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (followingError) {
    networkStats.textContent = 'Network setup pending. Run SUPABASE_SETUP.sql again.';
    return;
  }

  const { data: followerRows } = await sb.from('follows').select('follower_id').eq('following_id', userId);
  const followingIds = (followingRows || []).map((i) => i.following_id);
  const followerIds = (followerRows || []).map((i) => i.follower_id);

  const [followingProfiles, followerProfiles] = await Promise.all([
    followingIds.length ? sb.from('profiles').select('id,display_name,email').in('id', followingIds) : Promise.resolve({ data: [] }),
    followerIds.length ? sb.from('profiles').select('id,display_name,email').in('id', followerIds) : Promise.resolve({ data: [] })
  ]);

  const followingData = followingProfiles.data || [];
  const followerData = followerProfiles.data || [];
  const followerSet = new Set(followerData.map((item) => item.id));
  const friendsCount = followingData.filter((item) => followerSet.has(item.id)).length;
  networkStats.textContent = `${followingData.length} following | ${followerData.length} followers | ${friendsCount} friends`;

  if (followingList) {
    followingList.innerHTML =
      followingData.length === 0
        ? '<p class="note">No following yet.</p>'
        : followingData
            .map(
              (person) =>
                `<div class="mini-item"><span>${person.display_name} (${person.email})</span><button class="control-btn" data-unfollow-id="${person.id}" type="button">Unfollow</button></div>`
            )
            .join('');
  }

  if (followersList) {
    followersList.innerHTML =
      followerData.length === 0
        ? '<p class="note">No followers yet.</p>'
        : followerData.map((person) => `<div class="mini-item"><span>${person.display_name} (${person.email})</span></div>`).join('');
  }
};

const loadActivity = async (userId) => {
  if (!activityStats) return;

  const { data: threadRows } = await sb
    .from('threads')
    .select('id,title,created_at')
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .limit(12);

  const { data: upvoteRows } = await sb.from('thread_upvotes').select('thread_id').eq('user_id', userId).limit(12);
  const likedIds = (upvoteRows || []).map((i) => i.thread_id);
  const likedRows = likedIds.length
    ? (
        await sb.from('threads').select('id,title,created_at').in('id', likedIds).order('created_at', { ascending: false })
      ).data || []
    : [];

  activityStats.textContent = `${threadRows?.length || 0} threads created | ${likedRows.length} threads liked`;

  if (myThreads) {
    myThreads.innerHTML =
      !threadRows || threadRows.length === 0
        ? '<p class="note">No threads posted yet.</p>'
        : threadRows.map((thread) => `<a class="mini-item" href="forum.html?t=${thread.id}">${thread.title}</a>`).join('');
  }

  if (likedThreads) {
    likedThreads.innerHTML =
      likedRows.length === 0
        ? '<p class="note">No liked threads yet.</p>'
        : likedRows.map((thread) => `<a class="mini-item" href="forum.html?t=${thread.id}">${thread.title}</a>`).join('');
  }
};

const renderSession = async () => {
  if (!guardSupabase()) {
    return;
  }

  const {
    data: { session }
  } = await sb.auth.getSession();

  if (!session?.user) {
    setUiForLoggedState(false);
    if (sessionText) {
      sessionText.textContent = '';
    }
    return;
  }

  setUiForLoggedState(true);

  try {
    await ensureProfile(session.user);
    const profile = await getProfile(session.user.id);
    setAccountPanel(getPanelFromHash());

    if (sessionText) {
      sessionText.textContent = `Logged in as ${profile.display_name} (${profile.email})${profile.is_admin ? ' | Admin' : ''}${profile.approved ? '' : ' | Pending approval'}`;
    }
    if (profileName) profileName.value = profile.display_name || '';
    if (profileEmail) profileEmail.value = profile.email || '';
    renderAvatar(profile.avatar_url, profile.display_name);

    await Promise.all([loadNetwork(session.user.id), loadActivity(session.user.id)]);
    hydrateUiPrefsForm();
  } catch (error) {
    setMessage(error.message || 'Could not load account data.', true);
  }
};

authTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    setAuthForm(tab.dataset.authTab || 'register');
    setMessage('');
  });
});

accountTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    setAccountPanel(tab.dataset.panel || 'profile');
    setMessage('');
  });
});

if (sendCodeBtn && registerForm) {
  sendCodeBtn.addEventListener('click', async () => {
    if (!guardSupabase()) return;

    const data = new FormData(registerForm);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');

    if (!name || !email || password.length < 6) {
      setMessage('Add name, email, and password first.', true);
      return;
    }

    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data: { display_name: name } }
    });

    if (error) {
      setMessage(error.message, true);
      return;
    }

    saveDraft({ name, email, password });
    setMessage('Verification code sent to your email.');
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!guardSupabase()) return;

    const data = new FormData(registerForm);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const code = String(data.get('code') || '').trim();
    const draft = getDraft();

    if (!email || code.length !== 6) {
      setMessage('Enter email and 6-digit code.', true);
      return;
    }

    const { data: verifyData, error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error || !verifyData?.user) {
      setMessage(error?.message || 'Verification failed.', true);
      return;
    }

    if (draft?.password) {
      const { error: updateError } = await sb.auth.updateUser({ password: draft.password });
      if (updateError) {
        setMessage(updateError.message, true);
        return;
      }
    }

    await ensureProfile(verifyData.user, draft?.name || 'Member');
    clearDraft();
    registerForm.reset();
    setMessage('Email verified. If not admin, wait for approval.');
    await renderSession();
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!guardSupabase()) return;

    const data = new FormData(loginForm);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');
    if (!email || !password) {
      setMessage('Please fill login fields.', true);
      return;
    }

    const { data: loginData, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !loginData?.user) {
      setMessage(error?.message || 'Login failed.', true);
      return;
    }

    setMessage('Login successful.');
    loginForm.reset();
    await renderSession();
  });
}

if (googleFallbackBtn) {
  googleFallbackBtn.addEventListener('click', async () => {
    await startGoogleLogin();
  });
}

if (googleBtn) {
  googleBtn.innerHTML = '<button class="btn btn-google" type="button">Continue with Google</button>';
  const button = googleBtn.querySelector('button');
  button?.addEventListener('click', async () => {
    await startGoogleLogin();
  });
}

if (profileForm) {
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!guardSupabase()) return;

    const {
      data: { session }
    } = await sb.auth.getSession();
    if (!session?.user) {
      setMessage('Please login first.', true);
      return;
    }

    const name = String(profileName?.value || '').trim();
    if (!name) {
      setMessage('Display name is required.', true);
      return;
    }

    const { error } = await sb.from('profiles').update({ display_name: name }).eq('id', session.user.id);
    if (error) {
      setMessage(error.message, true);
      return;
    }

    setMessage('Profile updated successfully.');
    await renderSession();
  });
}

if (avatarForm) {
  avatarForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!guardSupabase()) return;

    const {
      data: { session }
    } = await sb.auth.getSession();
    if (!session?.user) {
      setMessage('Please login first.', true);
      return;
    }

    const file = avatarInput?.files?.[0];
    if (!file) {
      setMessage('Select an image first.', true);
      return;
    }

    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
    const path = `${session.user.id}/${Date.now()}-${cleanName}`;
    const { error: uploadError } = await sb.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) {
      setMessage(uploadError.message, true);
      return;
    }

    const { data: publicUrlData } = sb.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = publicUrlData?.publicUrl || '';
    const { error: profileError } = await sb.from('profiles').update({ avatar_url: avatarUrl }).eq('id', session.user.id);
    if (profileError) {
      setMessage(profileError.message, true);
      return;
    }

    renderAvatar(avatarUrl, profileName?.value || 'U');
    setMessage('Avatar uploaded successfully.');
  });
}

if (passwordForm) {
  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!guardSupabase()) return;

    const password = String(newPassword?.value || '');
    const confirm = String(confirmPassword?.value || '');
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.', true);
      return;
    }
    if (password !== confirm) {
      setMessage('Passwords do not match.', true);
      return;
    }

    const { error } = await sb.auth.updateUser({ password });
    if (error) {
      setMessage(error.message, true);
      return;
    }

    passwordForm.reset();
    setMessage('Password changed successfully.');
  });
}

if (linkGoogleBtn) {
  linkGoogleBtn.addEventListener('click', async () => {
    if (!guardSupabase()) return;

    if (typeof sb.auth.linkIdentity !== 'function') {
      setMessage('Google linking not available in this session.', true);
      return;
    }

    const { error } = await sb.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: getAccountRedirectUrl() }
    });

    if (error) {
      setMessage(error.message, true);
    }
  });
}

if (uiPrefsForm) {
  uiPrefsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const prefs = {
      compactLayout: Boolean(compactLayout?.checked),
      reduceMotion: Boolean(reduceMotion?.checked),
      hideSocial: Boolean(hideSocial?.checked),
      defaultFeedSort: defaultFeedSort?.value === 'new' ? 'new' : 'hot'
    };
    writeUiPrefs(prefs);
    setMessage('Interface preferences saved.');
  });
}

if (followForm) {
  followForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!guardSupabase()) return;

    const {
      data: { session }
    } = await sb.auth.getSession();
    if (!session?.user) {
      setMessage('Please login first.', true);
      return;
    }

    const email = String(followEmail?.value || '').trim().toLowerCase();
    if (!email) {
      setMessage('Enter an email to follow.', true);
      return;
    }

    if (email === String(session.user.email || '').toLowerCase()) {
      setMessage('You cannot follow yourself.', true);
      return;
    }

    const { data: target, error: targetError } = await sb
      .from('profiles')
      .select('id,display_name')
      .eq('email', email)
      .single();

    if (targetError || !target) {
      setMessage('User not found.', true);
      return;
    }

    const { error } = await sb.from('follows').insert({
      follower_id: session.user.id,
      following_id: target.id
    });

    if (error) {
      setMessage(error.message.includes('duplicate') ? 'You already follow this user.' : error.message, true);
      return;
    }

    followForm.reset();
    setMessage(`You are now following ${target.display_name}.`);
    await sb.from('notifications').insert({
      recipient_id: target.id,
      actor_id: session.user.id,
      kind: 'follow',
      message: `${session.user.email} followed you.`
    });
    await loadNetwork(session.user.id);
  });
}

if (followingList) {
  followingList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-unfollow-id]');
    if (!button || !guardSupabase()) return;

    const {
      data: { session }
    } = await sb.auth.getSession();
    if (!session?.user) {
      setMessage('Please login first.', true);
      return;
    }

    const targetId = button.getAttribute('data-unfollow-id');
    if (!targetId) return;

    const { error } = await sb
      .from('follows')
      .delete()
      .eq('follower_id', session.user.id)
      .eq('following_id', targetId);

    if (error) {
      setMessage(error.message, true);
      return;
    }

    setMessage('User unfollowed.');
    await loadNetwork(session.user.id);
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    if (!guardSupabase()) return;
    await sb.auth.signOut();
    setMessage('Logged out.');
    await renderSession();
  });
}

if (sb?.auth?.onAuthStateChange) {
  sb.auth.onAuthStateChange(() => {
    renderSession();
  });
}

setUiForLoggedState(false);
showCallbackErrorFromUrl();
renderSession();
