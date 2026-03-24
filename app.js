const menuToggle = document.querySelector('.menu-toggle');
const topnav = document.querySelector('.topnav');
const revealItems = document.querySelectorAll('.reveal');
const ADMIN_EMAIL = (window.ADMIN_EMAIL || 'ezzp024@gmail.com').toLowerCase();

if (menuToggle && topnav) {
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    topnav.classList.toggle('open');
  });

  topnav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      topnav.classList.remove('open');
    });
  });
}

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

    const email = String(session.user.email || '').toLowerCase();
    if (email !== ADMIN_EMAIL) {
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

if (window.sb?.auth?.onAuthStateChange) {
  window.sb.auth.onAuthStateChange(() => {
    updateAdminTab();
  });
}
