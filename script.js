const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
const revealItems = document.querySelectorAll('.reveal');
const form = document.querySelector('#contactForm');
const note = document.querySelector('#formNote');

if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('open');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
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
  { threshold: 0.2 }
);

revealItems.forEach((el) => observer.observe(el));

if (form && note) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();

    note.textContent = name
      ? `Thanks, ${name}. We will email you shortly.`
      : 'Thanks. We will email you shortly.';

    form.reset();
  });
}
