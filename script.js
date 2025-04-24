const container = document.getElementById('scroll-container');
const sections = container.querySelectorAll('.section');
const nav = document.getElementById('nav');

const sectionNames = ['Domov', 'Cenník', 'členstvo', 'Vybavenie', 'Galéria'];

// Create nav links
sections.forEach((section, index) => {
  const link = document.createElement('a');
  link.textContent = sectionNames[index];
  link.href = "#";
  link.classList.add('nav-link');
  if (index === 0) link.classList.add('active');

  link.addEventListener('click', (e) => {
    e.preventDefault();
    container.scrollTo({ left: index * window.innerWidth, behavior: 'smooth' });
  });

  nav.appendChild(link);
});

const navLinks = document.querySelectorAll('.nav-link');

// Update nav based on scroll position
container.addEventListener('scroll', () => {
  const index = Math.round(container.scrollLeft / window.innerWidth);
  navLinks.forEach((link, i) => {
    link.classList.toggle('active', i === index);
  });
});

// Optional: convert vertical wheel scroll to horizontal
window.addEventListener('wheel', (e) => {
  e.preventDefault();
  container.scrollBy({ left: e.deltaY, behavior: 'smooth' });
}, { passive: false });
