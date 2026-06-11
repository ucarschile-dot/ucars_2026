// Full catalog page logic — autos.html
let allCars = [];

async function initCatalog() {
  allCars = await loadCars();
  populateMarcas(allCars);
  renderCars(allCars);
  bindFilters();
}

function populateMarcas(cars) {
  const sel = document.getElementById('filter-marca');
  if (!sel) return;
  const marcas = [...new Set(cars.map(c => c.marca))].sort();
  marcas.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  });
}

function applyFilters() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const marca = document.getElementById('filter-marca').value;
  const precio = parseInt(document.getElementById('filter-precio').value) || Infinity;
  const año = parseInt(document.getElementById('filter-año').value) || 0;
  const combustible = document.getElementById('filter-combustible').value;
  const transmision = document.getElementById('filter-transmision').value;
  const sort = document.getElementById('sort-select').value;

  let filtered = allCars.filter(c => {
    const text = `${c.marca} ${c.modelo} ${c.version}`.toLowerCase();
    return (
      (!search || text.includes(search)) &&
      (!marca || c.marca === marca) &&
      (c.precio <= precio) &&
      (c.año >= año) &&
      (!combustible || c.combustible === combustible) &&
      (!transmision || c.transmision === transmision)
    );
  });

  // Sort
  if (sort === 'precio-asc') filtered.sort((a, b) => a.precio - b.precio);
  else if (sort === 'precio-desc') filtered.sort((a, b) => b.precio - a.precio);
  else if (sort === 'año-desc') filtered.sort((a, b) => b.año - a.año);
  else if (sort === 'km-asc') filtered.sort((a, b) => a.km - b.km);

  renderCars(filtered);
}

function renderCars(cars) {
  const grid = document.getElementById('cars-grid');
  const empty = document.getElementById('empty-state');
  const countEl = document.getElementById('results-count');

  if (!grid) return;

  if (!cars.length) {
    grid.innerHTML = '';
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    if (countEl) countEl.textContent = 'Sin resultados';
    return;
  }

  grid.classList.remove('hidden');
  empty.classList.add('hidden');
  grid.innerHTML = cars.map(buildCarCard).join('');

  if (countEl) {
    const available = cars.filter(c => c.estado === 'Disponible').length;
    countEl.textContent = `${cars.length} vehículo${cars.length !== 1 ? 's' : ''} encontrado${cars.length !== 1 ? 's' : ''} · ${available} disponible${available !== 1 ? 's' : ''}`;
  }
}

function bindFilters() {
  const ids = ['search-input', 'filter-marca', 'filter-precio', 'filter-año',
               'filter-combustible', 'filter-transmision', 'sort-select'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', applyFilters);
  });

  document.getElementById('reset-filters')?.addEventListener('click', () => {
    ['filter-marca', 'filter-precio', 'filter-año', 'filter-combustible', 'filter-transmision', 'sort-select']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('search-input').value = '';
    renderCars(allCars);
  });
}

document.addEventListener('DOMContentLoaded', initCatalog);
