// NAV scroll effect
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) navbar.classList.add('nav-scrolled');
    else navbar.classList.remove('nav-scrolled');
  });
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
  });
  scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// Format CLP price
function formatPrice(n) {
  return '$ ' + n.toLocaleString('es-CL');
}

// Format km
function formatKm(n) {
  return n.toLocaleString('es-CL') + ' km';
}

// Build car card HTML
function buildCarCard(car) {
  const badgeMap = {
    'Recién ingresado': 'badge-new',
    'Destacado': 'badge-feat',
    'Reservado': 'badge-res'
  };
  const badgeClass = badgeMap[car.badge] || '';
  const badgeHtml = car.badge
    ? `<span class="absolute top-3 left-3 text-xs font-bold px-2 py-1 rounded-full ${badgeClass}">${car.badge}</span>`
    : '';

  const soldOverlay = car.estado === 'Reservado'
    ? `<div class="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
         <span class="bg-slate-600 text-white text-sm font-bold px-3 py-1 rounded-full">Reservado</span>
       </div>`
    : '';

  const ctaBtn = car.estado === 'Reservado'
    ? `<button disabled class="btn-outline w-full justify-center text-sm opacity-50 cursor-not-allowed">Reservado</button>`
    : `<a href="https://wa.me/56974992231?text=${encodeURIComponent(car.whatsapp_msg)}"
          target="_blank" class="btn-wa w-full justify-center text-sm">
         <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
         Ver este auto
       </a>`;

  return `
    <div class="car-card">
      <div class="relative overflow-hidden">
        <img src="${car.imagen}" alt="${car.marca} ${car.modelo} ${car.año}" loading="lazy">
        ${badgeHtml}
        ${soldOverlay}
      </div>
      <div class="p-5">
        <div class="flex items-start justify-between mb-1">
          <div>
            <h3 class="text-white font-bold text-lg leading-tight">${car.marca} ${car.modelo}</h3>
            <p class="text-slate-400 text-sm">${car.version}</p>
          </div>
          <div class="price-tag text-right">${formatPrice(car.precio)}</div>
        </div>
        <div class="flex gap-3 mt-3 flex-wrap">
          <span class="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full">${car.año}</span>
          <span class="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full">${formatKm(car.km)}</span>
          <span class="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full">${car.combustible}</span>
          <span class="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full">${car.transmision}</span>
        </div>
        <div class="mt-4">${ctaBtn}</div>
      </div>
    </div>
  `;
}

// Load cars from JSON
async function loadCars() {
  const base = window.location.pathname.includes('/autos') ? '' :
               window.location.pathname.endsWith('/') ? '' : '../';
  try {
    const res = await fetch('data/autos.json');
    if (!res.ok) throw new Error('fetch failed');
    return await res.json();
  } catch {
    return [];
  }
}

// Populate hero preview (index.html)
async function populateHeroCars() {
  const container = document.getElementById('hero-cars');
  if (!container) return;
  const cars = await loadCars();
  const featured = cars.filter(c => c.estado === 'Disponible').slice(0, 4);
  if (!featured.length) return;
  const offsets = ['', 'mt-6', '-mt-2', 'mt-4'];
  container.innerHTML = featured.map((car, i) => `
    <div class="${offsets[i]}">
      <div class="rounded-xl overflow-hidden border border-slate-700/50 shadow-lg">
        <img src="${car.imagen}" alt="${car.marca} ${car.modelo}" class="w-full h-44 object-cover">
        <div class="bg-slate-800/80 px-3 py-2">
          <p class="text-white text-xs font-semibold">${car.marca} ${car.modelo} ${car.año}</p>
          <p class="text-orange-400 text-xs font-bold">${formatPrice(car.precio)}</p>
        </div>
      </div>
    </div>
  `).join('');
}

// Populate featured cars section (index.html)
async function populateFeaturedCars() {
  const container = document.getElementById('featured-cars');
  if (!container) return;
  const cars = await loadCars();
  const featured = cars.filter(c => c.estado === 'Disponible').slice(0, 6);
  if (!featured.length) {
    container.innerHTML = '<p class="text-slate-400 col-span-3">No hay autos disponibles por ahora.</p>';
    return;
  }
  container.innerHTML = featured.map(buildCarCard).join('');
}

// Init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  populateHeroCars();
  populateFeaturedCars();
});
