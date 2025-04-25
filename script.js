const container = document.getElementById('scroll-container');
const sections = container.querySelectorAll('.section');
const nav = document.getElementById('nav');
const galleryImages = document.querySelectorAll('.gallery img');
const overlay = document.getElementById('overlay');
const overlayImg = document.getElementById('overlay-img');


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
    overlayImg.src = img.src;
    overlay.classList.add('show');
  });
});

overlay.addEventListener('click', () => {
  overlay.classList.remove('show');
  setTimeout(() => {
    overlayImg.src = '';
  }, 300);
});
overlayImg.onload = () => {
  document.getElementById('spinner').style.display = 'none';
};

galleryImages.forEach(img => {
  img.addEventListener('click', () => {
    document.getElementById('spinner').style.display = 'block';
    overlayImg.src = img.src;
    overlay.classList.add('show');
    document.body.classList.add('overlay-open');
  });
});
document.querySelector('.button').addEventListener('click', function(e) {
  e.preventDefault(); // Prevent default action
  const target = document.getElementById('kontakt');
  
  // Smooth scroll to the 'kontakt' section
  target.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
});
function sendMail() {
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const message = document.getElementById('text').value;

  let params = {
    name: name,
    email: email,
    phone: phone,
    message: message
  };
  emailjs.send('service_10d0kqj', 'template_n76glgh', templateParams).then(
    alert('Rezervácia bola úspešne odoslaná!'),
    (response) => {
      console.log('SUCCESS!', response.status, response.text);
    },
    (error) => {
      console.log('FAILED...', error);
    },
  );

  
}


