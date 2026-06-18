// Meta Pixel Event Tracking — UCars
// Pixel ID: 1530516365541084

const PIXEL_ID = '1530516365541084';

function pxReady(fn) {
  if (typeof fbq !== 'undefined') { fn(); }
  else { window.addEventListener('load', fn); }
}

// Track Lead event with metadata
function trackLead(params = {}) {
  pxReady(() => {
    fbq('track', 'Lead', {
      content_name: params.content_name || 'contacto-general',
      content_category: params.content_category || 'ucars',
      ...params
    });
  });
}

// Track ViewContent for a specific car
function trackViewContent(auto) {
  pxReady(() => {
    fbq('track', 'ViewContent', {
      content_ids: [auto.id || auto.modelo],
      content_name: `${auto.marca || ''} ${auto.modelo || ''} ${auto.año || ''}`.trim(),
      content_type: 'vehicle',
      value: auto.precio || 0,
      currency: 'CLP'
    });
  });
}

// Track Contact (WhatsApp direct)
function trackContact(source) {
  pxReady(() => {
    fbq('track', 'Contact', { content_name: source });
  });
}

// Track InitiateCheckout = test drive request
function trackTestDrive(auto) {
  pxReady(() => {
    fbq('track', 'InitiateCheckout', {
      content_ids: [auto?.id || 'test-drive'],
      content_name: auto ? `Test drive ${auto.marca} ${auto.modelo}` : 'Test drive',
      content_type: 'vehicle'
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Event delegation — captura WhatsApp links estáticos Y dinámicos (cards async)
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href*="wa.me"]');
    if (!link) return;

    const href = link.href || '';
    const isUcariano = href.includes('Ucariano') || href.includes('ucariano');

    // Car card link (data-track-car attribute set in buildCarCard)
    if (link.dataset.trackCar !== undefined) {
      const auto = {
        id: link.dataset.autoId,
        marca: link.dataset.marca,
        modelo: link.dataset.modelo,
        año: link.dataset.año,
        precio: parseInt(link.dataset.precio) || 0
      };
      trackViewContent(auto);
      trackLead({
        content_name: `whatsapp-auto-${auto.marca}-${auto.modelo}`,
        content_category: 'compradores',
        value: auto.precio,
        currency: 'CLP'
      });
    } else if (isUcariano) {
      trackLead({ content_name: 'whatsapp-ucariano', content_category: 'reclutamiento' });
    } else {
      trackContact('whatsapp-comprador');
      trackLead({ content_name: 'whatsapp-comprador', content_category: 'compradores' });
    }
  });

  // Wire form submits (leads.js handles the actual WA redirect)
  const formVende = document.getElementById('lead-form-vende');
  if (formVende) {
    formVende.addEventListener('submit', () => {
      trackLead({ content_name: 'form-vende-auto', content_category: 'venta' });
    });
  }

  const formUcariano = document.getElementById('lead-form-ucariano');
  if (formUcariano) {
    formUcariano.addEventListener('submit', () => {
      trackLead({ content_name: 'form-ucariano', content_category: 'reclutamiento' });
    });
  }

  const formContact = document.getElementById('contact-form');
  if (formContact) {
    formContact.addEventListener('submit', () => {
      trackLead({ content_name: 'form-contacto', content_category: 'compradores' });
    });
  }
});

// Expose globally for inline use in catalog.js
window.ucarsPixel = { trackLead, trackViewContent, trackContact, trackTestDrive };
