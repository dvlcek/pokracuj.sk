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

// Convert vertical scroll (mouse wheel) to horizontal
window.addEventListener('wheel', (e) => {
    e.preventDefault();
    container.scrollBy({ left: e.deltaY, behavior: 'smooth' });
}, { passive: false });

// Swipe detection for horizontal scrolling
let touchStartX = 0;
let touchStartY = 0;

container.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
});

container.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    const touchEndX = touch.clientX;
    const touchEndY = touch.clientY;

    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;

    if (Math.abs(diffY) > Math.abs(diffX)) {  // Check for vertical swipe
        e.preventDefault();  // Prevent default scrolling behavior
        if (diffY > 0) {
            // Swipe up (scroll right)
            container.scrollBy({ left: window.innerWidth, behavior: 'smooth' });
        } else {
            // Swipe down (scroll left)
            container.scrollBy({ left: -window.innerWidth, behavior: 'smooth' });
        }
    }
});
