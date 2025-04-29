const container = document.getElementById('scroll-container');
const sections = container.querySelectorAll('.section');
const nav = document.getElementById('nav');
const galleryImages = document.querySelectorAll('.gallery img');
const overlay = document.getElementById('overlay');
const overlayImg = document.getElementById('overlay-img');
const spinner = document.getElementById('spinner');
let currentImgIndex = 0;

const sectionNames = ['Domov', 'Cenník', 'členstvo', 'Vybavenie', 'Galéria', 'Kontakt'];

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

galleryImages.forEach(img => {
  img.addEventListener('click', () => {
    document.getElementById('spinner').style.display = 'block'; // Show spinner while image loads
    overlayImg.src = img.src;
    overlay.classList.add('show');
    document.body.classList.add('overlay-open');
  });
});
document.addEventListener('keydown', (e) => {
  const sectionWidth = window.innerWidth;
  const maxIndex = sections.length - 1;
  const currentIndex = Math.round(container.scrollLeft / sectionWidth);

  if (e.key === 'ArrowRight' && currentIndex < maxIndex) {
    container.scrollTo({ left: (currentIndex + 1) * sectionWidth, behavior: 'smooth' });
  }

  if (e.key === 'ArrowLeft' && currentIndex > 0) {
    container.scrollTo({ left: (currentIndex - 1) * sectionWidth, behavior: 'smooth' });
  }
});

overlay.addEventListener('click', () => {
  overlay.classList.remove('show');
  document.body.classList.remove('overlay-open');
  setTimeout(() => {
    overlayImg.src = ''; // Clear the image after closing overlay
  }, 300);
});

overlayImg.onload = () => {
  spinner.style.display = 'none'; // Hide spinner when the image finishes loading
};

document.querySelector('.button').addEventListener('click', function(e) {
  e.preventDefault(); // Prevent default action
  const target = document.getElementById('kontakt');
  
  // Smooth scroll to the 'kontakt' section
  target.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
});

document.getElementById('contact-form').addEventListener('submit', function(e) {
  e.preventDefault();  // Prevent the form from submitting normally
  sendMail(); // Call sendMail function
});
function showImage(index) {
  if (index < 0) index = galleryImages.length - 1;
  if (index >= galleryImages.length) index = 0;
  currentImgIndex = index;

  spinner.style.display = 'block';
  overlayImg.src = galleryImages[currentImgIndex].src;
  overlay.classList.add('show');
  document.body.classList.add('overlay-open');
}

galleryImages.forEach((img, index) => {
  img.addEventListener('click', () => {
    showImage(index);
  });
});

// Arrow navigation
document.getElementById('prev-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  showImage(currentImgIndex - 1);
});

document.getElementById('next-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  showImage(currentImgIndex + 1);
});

// Close button
document.getElementById('close-btn').addEventListener('click', () => {
  overlay.classList.remove('show');
  document.body.classList.remove('overlay-open');
  setTimeout(() => {
    overlayImg.src = '';
  }, 300);
});

function sendMail() {
  // Get form data
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const message = document.getElementById('text').value;

  // Create params object for emailjs
  let params = {
    name: name,
    email: email,
    phone: phone,
    message: message
  };

  // Send data via emailjs
  emailjs.send('service_10d0kqj', 'template_n76glgh', params)
    .then((response) => {
      alert('Rezervácia bola úspešne odoslaná!'); // Success message
      console.log('Success:', response);
    })
    .catch((error) => {
      console.error('Error:', error);
      alert('Niečo sa pokazilo. Skúste to znova.'); // Error message
    });
}
