const container = document.getElementById('scroll-container');
const sections = container.querySelectorAll('.section');
const dotsContainer = document.getElementById('dots');

// Create dots
sections.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.classList.add('dot');
    if (index === 0) dot.classList.add('active');
    dot.addEventListener('click', () => {
    container.scrollTo({ left: index * window.innerWidth, behavior: 'smooth' });
    });
    dotsContainer.appendChild(dot);
});

// Update dot on scroll
container.addEventListener('scroll', () => {
    const index = Math.round(container.scrollLeft / window.innerWidth);
    document.querySelectorAll('.dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
    });
});

// Convert vertical scroll to horizontal
window.addEventListener('wheel', (e) => {
    e.preventDefault();
    container.scrollBy({ left: e.deltaY, behavior: 'smooth' });
}, { passive: false });