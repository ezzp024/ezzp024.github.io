const sb = window.sb;
const ADMIN_EMAIL = (window.ADMIN_EMAIL || 'ezzp024@gmail.com').toLowerCase();

const registerForm = document.querySelector('#registerForm');
const loginForm = document.querySelector('#loginForm');
const sendCodeBtn = document.querySelector('#sendCodeBtn');
const googleBtn = document.querySelector('#googleBtn');
const googleFallbackBtn = document.querySelector('#googleFallbackBtn');
const authMessage = document.querySelector('#authMessage');
const sessionPanel = document.querySelector('#sessionPanel');
const sessionText = document.querySelector('#sessionText');
const logoutBtn = document.querySelector('#logoutBtn');
const authTabs = document.querySelectorAll('.auth-tab');
const forms = document.querySelectorAll('.auth-form');

const REG_DRAFT_KEY = 'polly_reg_draft';

const setMessage = (message, isError = false) => {
  if (!authMessage) {
    return;
  }

  authMessage.textContent = message;
  authMessage.style.color = isError ? '#ffb7b7' : '#90ffd2';
};

const setFormActive = (tabName) => {
  authTabs.forEach((item) => {
    const active = item.dataset.authTab === tabName;
    item.classList.toggle('active', active);
    item.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  forms.forEach((form) => {
    form.classList.toggle('active', form.id === `${tabName}Form`);
  });
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

const guardSupabase = () => {
  if (!sb) {
    setMessage(window.__supabaseInitError || 'Supabase not configured.', true);
    return false;
  }
  return true;
};

const ensureProfile = async (user, fallbackName = '') => {
  const email = String(user.email || '').toLowerCase();
  const displayName =
    String(user.user_metadata?.display_name || '').trim() || fallbackName || email.split('@')[0] || 'Member';
  const approved = email === ADMIN_EMAIL;
  const isAdmin = email === ADMIN_EMAIL;

  const { error } = await sb.from('profiles').upsert(
    {
      id: user.id,
      email,
      display_name: displayName,
      approved,
      is_admin: isAdmin
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw error;
  }
};

const getProfile = async (userId) => {
  const { data, error } = await sb
    .from('profiles')
    .select('id,email,display_name,approved,is_admin')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }
  return data;
};

const renderSession = async () => {
  if (!guardSupabase()) {
    sessionPanel.hidden = true;
    return;
  }

  const {
    data: { session }
  } = await sb.auth.getSession();

  if (!session?.user) {
    sessionPanel.hidden = true;
    sessionText.textContent = '';
    return;
  }

  try {
    await ensureProfile(session.user);
    const profile = await getProfile(session.user.id);
    sessionPanel.hidden = false;
    sessionText.textContent = `Logged in as ${profile.display_name} (${profile.email})${profile.is_admin ? ' | Admin' : ''}${profile.approved ? '' : ' | Pending approval'}`;
  } catch (error) {
    sessionPanel.hidden = true;
    sessionText.textContent = '';
    setMessage(error.message || 'Could not load profile.', true);
  }
};

authTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    setFormActive(tab.dataset.authTab);
    setMessage('');
  });
});

if (sendCodeBtn && registerForm) {
  sendCodeBtn.addEventListener('click', async () => {
    if (!guardSupabase()) {
      return;
    }

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
      options: {
        shouldCreateUser: true,
        data: { display_name: name }
      }
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
    if (!guardSupabase()) {
      return;
    }

    const data = new FormData(registerForm);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const code = String(data.get('code') || '').trim();
    const draft = getDraft();

    if (!email || code.length !== 6) {
      setMessage('Enter email and 6-digit code.', true);
      return;
    }

    const { data: verifyData, error } = await sb.auth.verifyOtp({
      email,
      token: code,
      type: 'email'
    });

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

    try {
      await ensureProfile(verifyData.user, draft?.name || 'Member');
      const profile = await getProfile(verifyData.user.id);
      if (profile.approved) {
        setMessage('Account verified and ready. You can use the forum now.');
      } else {
        setMessage('Email verified. Waiting for admin approval.');
      }
      clearDraft();
      registerForm.reset();
      await renderSession();
    } catch (profileError) {
      setMessage(profileError.message || 'Could not finish registration.', true);
    }
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!guardSupabase()) {
      return;
    }

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

    try {
      await ensureProfile(loginData.user);
      const profile = await getProfile(loginData.user.id);
      if (!profile.approved) {
        setMessage('Login successful, but your account is pending admin approval.', true);
      } else {
        setMessage(`Welcome back ${profile.display_name}.`);
      }
      loginForm.reset();
      await renderSession();
    } catch (profileError) {
      setMessage(profileError.message || 'Could not load your profile.', true);
    }
  });
}

if (googleFallbackBtn) {
  googleFallbackBtn.style.display = 'none';
}

if (googleBtn) {
  googleBtn.innerHTML = '<button class="btn btn-google" type="button">Continue with Google</button>';
  const button = googleBtn.querySelector('button');
  button?.addEventListener('click', async () => {
    if (!guardSupabase()) {
      return;
    }

    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/account.html`
      }
    });

    if (error) {
      setMessage(error.message, true);
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    if (!guardSupabase()) {
      return;
    }

    await sb.auth.signOut();
    await renderSession();
    setMessage('Logged out.');
  });
}

renderSession();
