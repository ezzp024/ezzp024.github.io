const menuToggle = document.querySelector('.menu-toggle');
const topnav = document.querySelector('.topnav');
const topbar = document.querySelector('.topbar');
const revealItems = document.querySelectorAll('.reveal');

const UI_PREFS_KEY = 'polly_ui_prefs';

const readUiPrefs = () => {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const applyUiPrefs = () => {
  const prefs = readUiPrefs();
  document.body.classList.toggle('layout-compact', Boolean(prefs.compactLayout));
  document.body.classList.toggle('motion-reduced', Boolean(prefs.reduceMotion));
  document.body.classList.toggle('hide-social', Boolean(prefs.hideSocial));
};

window.getUiPrefs = readUiPrefs;
window.applyUiPrefs = applyUiPrefs;
applyUiPrefs();

if (menuToggle && topnav) {
  if (!topnav.id) {
    topnav.id = 'mainTopnav';
  }
  menuToggle.setAttribute('aria-controls', topnav.id);

  const closeMobileNav = () => {
    menuToggle.setAttribute('aria-expanded', 'false');
    topnav.classList.remove('open');
  };

  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    topnav.classList.toggle('open');
  });

  topnav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      closeMobileNav();
    });
  });

  document.addEventListener('click', (event) => {
    if (!topnav.classList.contains('open')) {
      return;
    }
    if (!topnav.contains(event.target) && !menuToggle.contains(event.target)) {
      closeMobileNav();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMobileNav();
      menuToggle.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 860) {
      closeMobileNav();
    }
  });
}

if ('IntersectionObserver' in window && revealItems.length > 0) {
  document.body.classList.add('js-reveal-enabled');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

const updateAdminTab = async () => {
  if (!topnav) {
    return;
  }

  const existing = topnav.querySelector('a[href="admin.html"]');
  if (existing) {
    existing.remove();
  }

  if (!window.sb) {
    return;
  }

  try {
    const {
      data: { session }
    } = await window.sb.auth.getSession();

    if (!session?.user) {
      return;
    }

    const { data: profile, error } = await window.sb
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (error || !profile?.is_admin) {
      return;
    }

    const link = document.createElement('a');
    link.href = 'admin.html';
    link.textContent = 'Admin';
    const isAdminPage = window.location.pathname.endsWith('/admin.html') || window.location.pathname.endsWith('admin.html');
    if (isAdminPage) {
      link.classList.add('active');
    }

    topnav.appendChild(link);
  } catch {
    // Ignore nav admin tab failures.
  }
};

updateAdminTab();

const renderUserMenu = async () => {
  if (!topbar) {
    return;
  }

  let wrapper = topbar.querySelector('.topbar-user');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'topbar-user';
    topbar.appendChild(wrapper);
  }

  if (!window.sb) {
    wrapper.innerHTML = '<a class="user-link" href="account.html">Account</a>';
    return;
  }

  const {
    data: { session }
  } = await window.sb.auth.getSession();

  if (!session?.user) {
    wrapper.innerHTML = '<a class="user-link" href="account.html">Sign In</a>';
    return;
  }

  let profile = null;
  try {
    const { data } = await window.sb.from('profiles').select('display_name,is_admin').eq('id', session.user.id).single();
    profile = data || null;
  } catch {
    profile = null;
  }

  const name = profile?.display_name || session.user.email || 'Member';
  const initial = String(name).trim().charAt(0).toUpperCase();
  const adminLink = profile?.is_admin ? '<a role="menuitem" href="admin.html">Admin</a>' : '';

  const menuId = 'topbar-user-menu';
  wrapper.innerHTML = `
    <button class="user-link user-trigger" type="button" aria-expanded="false" aria-haspopup="menu" aria-controls="${menuId}">
      <span class="avatar tiny-avatar">${initial}</span>
      <span>${name}</span>
    </button>
    <div id="${menuId}" class="user-menu" role="menu" hidden>
      <a role="menuitem" href="profile.html">Profile</a>
      <a role="menuitem" href="settings.html">Settings</a>
      <a role="menuitem" href="network.html">Friends</a>
      <a role="menuitem" href="notifications.html">Notifications</a>
      <a role="menuitem" href="messages.html">Messages</a>
      <a role="menuitem" href="moderation.html">Moderation</a>
      ${adminLink}
      <button id="topbarLogoutBtn" role="menuitem" type="button">Logout</button>
    </div>
  `;

  const trigger = wrapper.querySelector('.user-trigger');
  const menu = wrapper.querySelector('.user-menu');
  const logoutBtn = wrapper.querySelector('#topbarLogoutBtn');

  const closeUserMenu = () => {
    trigger?.setAttribute('aria-expanded', 'false');
    if (menu) {
      menu.hidden = true;
    }
  };

  trigger?.addEventListener('click', () => {
    const open = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!open));
    if (menu) {
      menu.hidden = open;
    }
  });

  trigger?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (menu) {
        menu.hidden = false;
      }
      trigger.setAttribute('aria-expanded', 'true');
      const first = wrapper.querySelector('.user-menu a, .user-menu button');
      first?.focus();
    }
  });

  menu?.querySelectorAll('a,button').forEach((item) => {
    item.addEventListener('click', () => {
      closeUserMenu();
    });
  });

  wrapper.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeUserMenu();
      trigger?.focus();
    }
  });

  if (window.__userMenuDocClick) {
    document.removeEventListener('click', window.__userMenuDocClick);
  }

  if (window.__userMenuDocKeydown) {
    document.removeEventListener('keydown', window.__userMenuDocKeydown);
  }

  window.__userMenuDocClick = (event) => {
    if (!wrapper.contains(event.target)) {
      closeUserMenu();
    }
  };

  window.__userMenuDocKeydown = (event) => {
    if (event.key === 'Escape') {
      closeUserMenu();
    }
  };

  document.addEventListener('click', window.__userMenuDocClick);
  document.addEventListener('keydown', window.__userMenuDocKeydown);

  logoutBtn?.addEventListener('click', async () => {
    await window.sb.auth.signOut();
    window.location.href = 'account.html';
  });
};

renderUserMenu();

if (window.sb?.auth?.onAuthStateChange) {
  window.sb.auth.onAuthStateChange(() => {
    updateAdminTab();
    renderUserMenu();
  });
}
