// NAV scroll effect
const navbar = document.getElementById('navbar');
if (navbar) {
  const onScroll = () => navbar.classList.toggle('nav-scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// Mobile menu toggle
const menuToggle = document.getElementById('menu-toggle');
const mobileMenu = document.getElementById('mobile-menu');
if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', () => mobileMenu.classList.toggle('open'));
}

// Scroll top button
const scrollTopBtn = document.getElementById('scroll-top');
if (scrollTopBtn) {
  window.addEventListener('scroll', () => {
    scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
  scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// Scroll reveal with IntersectionObserver
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// Format CLP price
function formatPrice(n) {
  return '$ ' + n.toLocaleString('es-CL');
}

// Format km
function formatKm(n) {
  return n.toLocaleString('es-CL') + ' km';
}

const WA_SVG = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

// Build car card HTML — v2 design system
function buildCarCard(car) {
  const badgeMap = {
    'Recién ingresado': 'badge-new',
    'Destacado':        'badge-feat',
    'Reservado':        'badge-res'
  };
  const badgeClass = badgeMap[car.badge] || '';
  const badgeHtml  = car.badge
    ? `<span class="card-badge ${badgeClass}">${car.badge}</span>`
    : '';

  const soldOverlay = car.estado === 'Reservado'
    ? `<div style="position:absolute;inset:0;background:rgba(7,9,15,0.65);display:flex;align-items:center;justify-content:center;">
         <span style="background:#334155;color:#fff;font-size:.75rem;font-weight:700;padding:5px 14px;border-radius:999px;letter-spacing:.04em;">RESERVADO</span>
       </div>`
    : '';

  const ctaBtn = car.estado === 'Reservado'
    ? `<button disabled class="btn-outline w-full justify-center text-sm" style="opacity:.4;cursor:not-allowed;">Reservado</button>`
    : `<a href="https://wa.me/56974992231?text=${encodeURIComponent(car.whatsapp_msg)}"
          target="_blank"
          class="btn-wa w-full justify-center"
          style="font-size:.85rem;"
          data-track-car data-auto-id="${car.id}" data-marca="${car.marca}" data-modelo="${car.modelo}" data-año="${car.año}" data-precio="${car.precio}">
         ${WA_SVG} Consultar por WhatsApp
       </a>`;

  return `
    <div class="car-card">
      <div class="car-card-img-wrap">
        <img src="${car.imagen}" alt="${car.marca} ${car.modelo} ${car.año}" loading="lazy">
        ${badgeHtml}
        ${soldOverlay}
        <div class="card-price-overlay">
          <span class="card-price-value">${formatPrice(car.precio)}</span>
        </div>
      </div>
      <div class="car-card-body">
        <div>
          <h3 class="car-card-title">${car.marca} ${car.modelo}</h3>
          <p class="car-card-version">${car.version}</p>
        </div>
        <div class="car-chips">
          <span class="car-chip">${car.año}</span>
          <span class="car-chip">${formatKm(car.km)}</span>
          <span class="car-chip">${car.combustible}</span>
          <span class="car-chip">${car.transmision}</span>
        </div>
        <div class="car-card-cta">${ctaBtn}</div>
      </div>
    </div>
  `;
}

// Load cars — API con fallback local
async function loadCars() {
  try {
    const res = await fetch('/api/stock');
    if (!res.ok) throw new Error('api error');
    const data = await res.json();
    return data.map(v => ({
      ...v,
      whatsapp_msg: v.whatsapp_msg || `Hola, me interesa el ${v.marca} ${v.modelo} ${v.año} que vi en ucars.cl`
    }));
  } catch {
    try {
      const res = await fetch('data/autos.json');
      if (!res.ok) throw new Error();
      return await res.json();
    } catch { return []; }
  }
}

// Populate hero preview grid (index.html) with stagger animation
async function populateHeroCars() {
  const container = document.getElementById('hero-cars');
  if (!container) return;
  const cars = await loadCars();
  const featured = cars.filter(c => c.estado === 'Disponible').slice(0, 4);
  if (!featured.length) return;
  const offsets = ['', 'mt-6', '-mt-2', 'mt-4'];
  container.innerHTML = featured.map((car, i) => `
    <div class="${offsets[i]}">
      <div class="hero-preview-card">
        <img src="${car.imagen}" alt="${car.marca} ${car.modelo}" style="width:100%;height:176px;object-fit:cover;display:block;">
        <div style="background:var(--bg-elevated);padding:10px 14px;border-top:1px solid var(--border);">
          <p style="color:var(--text-primary);font-size:.8rem;font-weight:600;line-height:1.3;">${car.marca} ${car.modelo} ${car.año}</p>
          <p style="color:var(--price-color);font-size:.8rem;font-weight:700;margin-top:2px;">${formatPrice(car.precio)}</p>
        </div>
      </div>
    </div>
  `).join('');

  // Trigger stagger entrance
  requestAnimationFrame(() => {
    container.querySelectorAll('.hero-preview-card').forEach((el, i) => {
      setTimeout(() => el.classList.add('loaded'), i * 100 + 50);
    });
  });
}

// Populate featured cars section (index.html)
async function populateFeaturedCars() {
  const container = document.getElementById('featured-cars');
  if (!container) return;
  const cars = await loadCars();
  const featured = cars.filter(c => c.estado === 'Disponible').slice(0, 6);
  if (!featured.length) {
    container.innerHTML = '<p style="color:var(--text-secondary);grid-column:1/-1;">No hay autos disponibles por ahora.</p>';
    return;
  }
  container.innerHTML = featured.map(buildCarCard).join('');
  // Observe newly added cards for reveal
  container.querySelectorAll('.car-card').forEach(el => {
    el.classList.add('reveal');
    revealObserver.observe(el);
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  populateHeroCars();
  populateFeaturedCars();
});
