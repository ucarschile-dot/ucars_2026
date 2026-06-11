// Lead form → WhatsApp redirect
// All forms serialize data and open WhatsApp with pre-filled message

const WA_NUMBER = '56974992231';

function serializeForm(form) {
  const data = {};
  new FormData(form).forEach((v, k) => { if (v) data[k] = v; });
  return data;
}

function buildVendeMessage(data) {
  return `Hola Ucars 👋, quiero vender mi auto:

🚗 *Auto*: ${data.auto || 'No indicado'}
📍 *Kilómetros*: ${data.km || 'No indicado'}
👤 *Nombre*: ${data.nombre || 'No indicado'}
📱 *Teléfono*: ${data.telefono || 'No indicado'}

¿Pueden darme una tasación?`;
}

function buildUcarianoMessage(data) {
  return `Hola Ucars 👋, quiero inscribirme en el programa Ucariano:

🚗 *Auto*: ${data.marca || ''} ${data.modelo || ''} ${data.año || ''}
📍 *Kilómetros*: ${data.km || 'No indicado'}
💰 *Precio esperado*: ${data.precio || 'A conversar'}
👤 *Nombre*: ${data.nombre || ''}
📱 *Teléfono*: ${data.telefono || ''}
${data.email ? `📧 Email: ${data.email}` : ''}
${data.comentarios ? `📝 Notas: ${data.comentarios}` : ''}

¿Pueden contactarme?`;
}

function openWhatsApp(msg) {
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

document.addEventListener('DOMContentLoaded', () => {
  // Vende tu auto form (index.html)
  const formVende = document.getElementById('lead-form-vende');
  if (formVende) {
    formVende.addEventListener('submit', e => {
      e.preventDefault();
      openWhatsApp(buildVendeMessage(serializeForm(formVende)));
    });
  }

  // Ucariano inscription form
  const formUcariano = document.getElementById('lead-form-ucariano');
  if (formUcariano) {
    formUcariano.addEventListener('submit', e => {
      e.preventDefault();
      openWhatsApp(buildUcarianoMessage(serializeForm(formUcariano)));
    });
  }
});
