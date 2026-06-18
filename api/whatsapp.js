import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const VERIFY_TOKEN    = process.env.WA_VERIFY_TOKEN;
const WA_TOKEN        = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const HUMAN_WA        = process.env.WA_HUMAN_NUMBER || '56974992231';
const N8N_WEBHOOK     = process.env.N8N_WEBHOOK_URL; // para notificar al Ucariano

// ── Intents ────────────────────────────────────────────────────────────────
const VISIT_TRIGGERS = [
  'verlo','verla','ver el auto','ver la camioneta','ir a verlo',
  'cuándo puedo','cuando puedo','dirección','direccion',
  'dónde están','donde estan','me interesa','quiero ir',
  'agendar','visita','disponible para ver','puedo pasar',
];
const ALTERNATIVES_TRIGGERS = [
  'alternativa','otro auto','algo similar','parecido',
  'otro modelo','tienen más','tienen mas','qué más tienen',
  'otras opciones','más opciones',
];
const PRICE_TRIGGERS = [
  'cuánto les costó','cuanto les costo','precio de compra','precio real',
  'precio interno','cuánto pagaron','cuanto pagaron','margen','ganancia',
  'comisión','comision','por qué tan barato','por que tan barato',
  'rebaja','descuento','negociable','negociar',
  'última oferta','ultima oferta','precio final','lo dan en','lo dejan en',
];
const DEFECT_TRIGGERS = [
  'arreglo','arreglaron','reparacion','reparación','repararon',
  'falla','fallas','fallo','problema','problemas',
  'choque','chocado','accidente','golpe','abolladur',
  'rayado','oxidado','oxido','óxido','mecánico','mecanico',
  'taller','revisión técnica reprobada','airbag','kilometraje alterado',
  'odómetro','tiene algo','algo malo','algo oculto',
  'por qué lo venden','por que lo venden','defecto','detalle',
];
const OWNER_TRIGGERS = [
  'dueño anterior','dueno anterior','ex dueño','ex dueno',
  'quién lo vendió','quien lo vendio','por qué lo vendió','por que lo vendio',
  'nombre del dueño','datos del dueño','historial completo','informe full',
  'ucariano','consignado','consignatario',
];

// ── Handler principal ──────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Verificación del webhook (Meta lo llama una vez al configurar)
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
    return res.status(403).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  res.status(200).end(); // Meta requiere respuesta < 5 s

  try {
    const msg = extractMessage(req.body);
    if (!msg) return;
    const { from, text, type } = msg;

    if (type !== 'text') {
      await sendText(from, '👋 Solo entiendo mensajes de texto por ahora. Visita *ucars.cl* para ver el catálogo.');
      return;
    }

    const reply = await handleMessage(from, text.trim());
    if (reply) await sendText(from, reply);
  } catch (err) {
    console.error('[ucars-bot]', err);
  }
}

// ── Máquina de estados ─────────────────────────────────────────────────────
async function handleMessage(from, text) {
  const conv = await getConversation(from);
  const lower = text.toLowerCase();

  // ── ESTADO: ask_name — esperando el nombre del prospecto ─────────────────
  if (conv.state === 'ask_name') {
    const name = text.trim();
    await updateConversation(from, { state: 'ask_availability', prospect_name: name });
    return buildAskAvailability(name);
  }

  // ── ESTADO: ask_availability — esperando disponibilidad horaria ──────────
  if (conv.state === 'ask_availability') {
    const car = conv.vehicle_id ? await getVehicle(conv.vehicle_id) : null;
    await notifyUcariano(car, conv.prospect_name, from, text);
    await updateConversation(from, { state: 'idle', prospect_name: null, vehicle_id: null });
    return '¡Listo! El Ucariano a cargo de este auto te confirma la visita en breve. 👍';
  }

  // ── ESTADO: idle — flujo general ─────────────────────────────────────────

  // 1. Detectar auto del anuncio Meta Ads
  //    El mensaje pre-llenado que configuras en el anuncio tiene el modelo:
  //    Ej: "Hola, me interesa el Toyota Corolla 2021 que vi en tu anuncio"
  //    Ej: "Hola, vi el anuncio del Volkswagen Tiguan"
  if (!conv.vehicle_id) {
    const car = await detectCarFromText(text);
    if (car) {
      if (car.estado !== 'Disponible') {
        return `Este ${car.marca} ${car.modelo} ya está *${car.estado.toLowerCase()}*.\n\n¿Quieres ver opciones similares? 😊`;
      }
      await updateConversation(from, { state: 'idle', vehicle_id: car.id });
      return buildFicha(car);
    }
  }

  // 2. Intents generales
  const intent = detectIntent(lower);

  if (intent === 'BLOCKED_PRICE') {
    const car = conv.vehicle_id ? await getVehicle(conv.vehicle_id) : null;
    const precio = car ? `$${fmt(car.precio)} CLP` : 'el indicado en el anuncio';
    return `El precio de venta es *${precio}* y es el precio final.\nPara condiciones de pago, nuestro ejecutivo te orienta en persona. ¿Coordinamos una visita? 📅`;
  }

  if (intent === 'BLOCKED_DEFECT') {
    return `Todos nuestros autos pasan por revisión antes de publicarse.\nPara ver el estado del vehículo en detalle, lo mejor es venir a verlo tú mismo. ¿Coordinamos? 🔍`;
  }

  if (intent === 'BLOCKED_OWNER') {
    return `Por privacidad no compartimos información del propietario anterior.\nSi necesitas el historial, puedes consultarlo en el Registro Civil con la patente. ¿En qué más te ayudo? 😊`;
  }

  if (intent === 'VISIT') {
    const car = conv.vehicle_id ? await getVehicle(conv.vehicle_id) : null;
    if (!car) {
      return `Para coordinar una visita escríbenos directo 👉 *wa.me/${HUMAN_WA}*\n📍 Lo Barnechea, Santiago`;
    }
    await updateConversation(from, { state: 'ask_name', vehicle_id: car.id });
    return '¡Perfecto! Para coordinar la visita, ¿me das tu nombre? 😊';
  }

  if (intent === 'ALTERNATIVES') {
    const { data: disponibles } = await supabase
      .from('vehicles').select('marca,modelo,version,año,precio,km,tipo')
      .eq('estado','Disponible').order('precio',{ ascending: true }).limit(5);
    return msgFiltrados(disponibles || [], 'Otras opciones disponibles');
  }

  // 3. Comandos de catálogo
  if (/^(hola|buenos|buenas|hey|hi|saludos)/i.test(text)) {
    const { count } = await supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('estado','Disponible');
    return msgBienvenida(count || 0);
  }

  if (/(todo|todos|stock|catálogo|catalogo|lista|ver autos|cuántos|cuantos|qué tienen|que tienen)/i.test(lower)) {
    const { data } = await supabase.from('vehicles').select('marca,modelo,version,año,precio,km').eq('estado','Disponible').order('precio',{ ascending: true });
    return msgStock(data || []);
  }

  if (/(ayuda|menu|menú|opciones|comandos)/i.test(lower)) return msgMenu();

  // 4. Filtrar por tipo de carrocería
  const tipoMap = {
    'suv':'SUV','camioneta':'Pickup','pickup':'Pickup','sedán':'Sedán','sedan':'Sedán',
    'hatchback':'Hatchback','hatch':'Hatchback','furgon':'Furgón','furgón':'Furgón',
    'coupe':'Coupé','coupé':'Coupé','convertible':'Convertible','descapotable':'Convertible',
    'minivan':'Minivan','station wagon':'Station Wagon','familiar':'Station Wagon',
  };
  const tipoHit = Object.keys(tipoMap).find(k => lower.includes(k));
  if (tipoHit) {
    const { data } = await supabase.from('vehicles').select('marca,modelo,version,año,precio,km,tipo')
      .eq('estado','Disponible').eq('tipo', tipoMap[tipoHit]);
    if (data?.length) return msgFiltrados(data, tipoMap[tipoHit]);
    const { data: tipos } = await supabase.from('vehicles').select('tipo').eq('estado','Disponible');
    const disponibles = [...new Set((tipos||[]).map(v=>v.tipo))].join(', ');
    return `No tenemos *${tipoMap[tipoHit]}* disponibles ahora.\nTenemos: ${disponibles}\n¿Te acomoda alguno?`;
  }

  // 5. Filtrar por combustible
  if (/(diesel|diésel)/i.test(lower)) {
    const { data } = await supabase.from('vehicles').select('marca,modelo,version,año,precio,km').eq('estado','Disponible').eq('combustible','Diesel');
    return data?.length ? msgFiltrados(data, 'Diesel') : '⛽ No tenemos autos diesel disponibles ahora.';
  }
  if (/eléctrico|electrico|ev\b/i.test(lower)) {
    const { data } = await supabase.from('vehicles').select('marca,modelo,version,año,precio,km').eq('estado','Disponible').eq('combustible','Eléctrico');
    return data?.length ? msgFiltrados(data, 'Eléctrico') : '⚡ No tenemos eléctricos disponibles ahora.';
  }
  if (/híbrido|hibrido/i.test(lower)) {
    const { data } = await supabase.from('vehicles').select('marca,modelo,version,año,precio,km').eq('estado','Disponible').eq('combustible','Híbrido');
    return data?.length ? msgFiltrados(data, 'Híbrido') : '🌿 No tenemos híbridos disponibles ahora.';
  }

  // 6. Filtrar por transmisión
  if (/\bmanual\b/i.test(lower)) {
    const { data } = await supabase.from('vehicles').select('marca,modelo,version,año,precio,km').eq('estado','Disponible').eq('transmision','Manual');
    return data?.length ? msgFiltrados(data, 'Manual') : '⚙️ No tenemos manuales disponibles ahora.';
  }

  // 7. Filtrar por precio máximo
  const precioMatch = lower.match(/(\d[\d\.]*)\s*(millon|millón|mm)\b/i)
                   || (/(hasta|menos|máximo|max|presupuesto)/i.test(lower) && lower.match(/(\d[\d\.]{4,})/));
  if (precioMatch) {
    let tope = parseInt(precioMatch[1].replace(/\./g,''));
    if (/millon|millón|mm/i.test(precioMatch[2]||'')) tope *= 1_000_000;
    if (tope > 500000) {
      const { data } = await supabase.from('vehicles').select('marca,modelo,version,año,precio,km')
        .eq('estado','Disponible').lte('precio', tope).order('precio',{ ascending: true });
      if (data?.length) return msgFiltrados(data, `hasta $${fmt(tope)}`);
      const { data: min } = await supabase.from('vehicles').select('precio').eq('estado','Disponible').order('precio',{ ascending: true }).limit(1);
      return `💰 No tenemos autos en ese presupuesto ahora.\nEl más económico disponible es *$${fmt(min?.[0]?.precio||0)}*. ¿Te acomoda?`;
    }
  }

  // 8. Filtrar por marca
  const { data: marcasDB } = await supabase.from('vehicles').select('marca').eq('estado','Disponible');
  const marcas = [...new Set((marcasDB||[]).map(v => v.marca.toLowerCase()))];
  const marcaHit = marcas.find(m => lower.includes(m));
  if (marcaHit) {
    const { data } = await supabase.from('vehicles').select('marca,modelo,version,año,precio,km')
      .eq('estado','Disponible').ilike('marca', marcaHit);
    return data?.length
      ? msgFiltrados(data, data[0].marca)
      : `No tenemos *${capitalize(marcaHit)}* disponibles ahora, pero pueden ingresar pronto.\n¿Quieres que te avisemos? 👉 *wa.me/${HUMAN_WA}*`;
  }

  // 9. Precio rango / fotos
  if (/(precio|cuánto|cuanto|valor)/i.test(lower)) {
    const { data } = await supabase.from('vehicles').select('precio').eq('estado','Disponible');
    if (data?.length) {
      const precios = data.map(v=>v.precio);
      return `💰 Precios desde *$${fmt(Math.min(...precios))}* hasta *$${fmt(Math.max(...precios))}*.\nEscribe la marca y te doy el precio exacto 👇`;
    }
  }
  if (/(foto|imag|web|página|pagina|sitio|link)/i.test(lower)) {
    return `🌐 Mira todos los autos con fotos en:\n*ucars.cl/autos*`;
  }

  // Cotizar / hablar con persona
  if (/(cotiz|agendar|visita|ver en person|hablar|asesor|vendedor|humano|llamen|llámame)/i.test(lower)) {
    return `📞 Te conectamos con un asesor:\n\n👉 *wa.me/${HUMAN_WA}*\n📍 Lo Barnechea, Santiago`;
  }

  // Default
  const { count } = await supabase.from('vehicles').select('*', { count:'exact', head:true }).eq('estado','Disponible');
  return msgBienvenida(count || 0);
}

// ── Intent detector ────────────────────────────────────────────────────────
function detectIntent(text) {
  if (VISIT_TRIGGERS.some(t => text.includes(t)))        return 'VISIT';
  if (ALTERNATIVES_TRIGGERS.some(t => text.includes(t))) return 'ALTERNATIVES';
  if (PRICE_TRIGGERS.some(t => text.includes(t)))        return 'BLOCKED_PRICE';
  if (DEFECT_TRIGGERS.some(t => text.includes(t)))       return 'BLOCKED_DEFECT';
  if (OWNER_TRIGGERS.some(t => text.includes(t)))        return 'BLOCKED_OWNER';
  return 'QUESTION';
}

// ── Mensajes ───────────────────────────────────────────────────────────────
function buildFicha(car) {
  return [
    `*Hola! Vi que te interesó nuestro ${car.marca} ${car.modelo}* 👋`,
    `Aquí va la ficha completa:\n`,
    `🔑 *Patente:* ${car.patente || '—'}`,
    `🚗 *Modelo:* ${car.marca} ${car.modelo} ${car.version||''}`.trim(),
    `📅 *Año:* ${car.año}`,
    `🛣️  *Kilometraje:* ${fmtKm(car.km)}`,
    `🎨 *Color:* ${car.color || '—'}`,
    `🪑 *Tapiz:* ${car.tapiz || '—'}`,
    `⚙️  *Transmisión:* ${car.transmision}`,
    `⛽ *Combustible:* ${car.combustible}`,
    `👤 *N° de dueños:* ${car.num_duenos ?? '—'}`,
    `💰 *Precio:* $${fmt(car.precio)} CLP`,
    `\n¿Tienes alguna duda o quieres venir a verlo? 😊`,
  ].join('\n');
}

function buildAskAvailability(name) {
  return `Gracias, ${name}. ¿Qué días y horarios te acomodan?\nDame 2 o 3 opciones y le aviso al Ucariano para confirmar. 📅`;
}

function msgBienvenida(total) {
  return `👋 ¡Hola! Soy el asistente de *UCars* 🚗\n\nTenemos *${total} auto${total!==1?'s':''} disponible${total!==1?'s':''}* en Lo Barnechea.\n\nPuedes preguntarme:\n• _Ver todos los autos_\n• _Toyota_ (o cualquier marca)\n• _Hasta 15 millones_\n• _SUV_ / _Diesel_ / _Manual_\n• _Cotizar_ (te paso con un asesor)\n\n🌐 *ucars.cl/autos* — fotos y detalles`;
}

function msgMenu() {
  return `📋 *Comandos:*\n\n🚗 *"Ver stock"* — todos disponibles\n🏷️ *"Toyota"* — filtrar por marca\n🚙 *"SUV"* / *"Sedan"* / *"Pickup"* — por tipo\n💰 *"Hasta 15 millones"* — por precio\n⛽ *"Diesel"* / *"Eléctrico"* / *"Híbrido"*\n⚙️ *"Manual"*\n📞 *"Cotizar"* — hablar con un asesor\n🌐 ucars.cl/autos — catálogo completo`;
}

function msgStock(vehicles) {
  if (!vehicles.length) return '😔 Sin autos disponibles ahora. Escríbenos 👉 *wa.me/56974992231*';
  if (vehicles.length > 8) {
    const marcas = [...new Set(vehicles.map(v=>v.marca))].sort().join(', ');
    const min = Math.min(...vehicles.map(v=>v.precio));
    const max = Math.max(...vehicles.map(v=>v.precio));
    return `🚗 *Stock UCars — ${vehicles.length} autos disponibles*\n\n📍 Lo Barnechea, Santiago\n💰 Desde *$${fmt(min)}* hasta *$${fmt(max)}*\n🏷️ Marcas: ${marcas}\n\n👉 *ucars.cl/autos* — catálogo completo con fotos\n\n¿Buscas alguna marca o presupuesto?`;
  }
  const lista = vehicles.map(v => `• *${v.marca} ${v.modelo}* ${v.año} — $${fmt(v.precio)} · ${fmtKm(v.km)}`).join('\n');
  return `🚗 *Disponibles:*\n\n${lista}\n\n🌐 ucars.cl/autos — fotos`;
}

function msgFiltrados(vehicles, label) {
  if (!vehicles.length) return `No encontramos autos disponibles para *${label}* ahora.`;
  const items = vehicles.slice(0,6).map(v =>
    `• *${v.marca} ${v.modelo}* ${v.version||''} ${v.año}\n  $${fmt(v.precio)} · ${fmtKm(v.km)}`
  ).join('\n\n');
  const extra = vehicles.length > 6 ? `\n\n…y ${vehicles.length-6} más en ucars.cl/autos` : '';
  return `🚗 *${label} — ${vehicles.length} auto${vehicles.length!==1?'s':''}:*\n\n${items}${extra}\n\n¿Te interesa alguno? 👇`;
}

// ── Notificación n8n → Ucariano ────────────────────────────────────────────
async function notifyUcariano(car, prospectName, prospectPhone, availability) {
  if (!N8N_WEBHOOK) return;
  const carLabel = car ? `${car.marca} ${car.modelo} ${car.año} · ${car.patente||'sin patente'}` : 'Stock UCars';
  const payload = {
    tipo: 'nuevo_lead',
    auto: carLabel,
    precio: car ? `$${fmt(car.precio)} CLP` : '—',
    vendedor_nombre: car?.vendedor_nombre || '',
    vendedor_telefono: car?.vendedor_telefono || '',
    prospecto_nombre: prospectName || '—',
    prospecto_whatsapp: prospectPhone,
    disponibilidad: availability,
  };
  try {
    await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('[ucars-bot] n8n notify error:', e.message);
  }
}

// ── Detecta el auto del anuncio buscando marca+modelo en el texto ──────────
// Meta Ads → pre-filled message: "Hola, me interesa el Toyota Corolla 2021"
async function detectCarFromText(text) {
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id,marca,modelo,version,año,precio,km,combustible,transmision,color,tapiz,num_duenos,estado,patente,vendedor_nombre,vendedor_telefono')
    .eq('estado', 'Disponible');

  if (!vehicles?.length) return null;

  const lower = text.toLowerCase();

  // Buscar primero marca+modelo juntos (más específico)
  for (const v of vehicles) {
    const marca  = v.marca.toLowerCase();
    const modelo = v.modelo.toLowerCase();
    if (lower.includes(marca) && lower.includes(modelo)) return v;
  }

  // Buscar solo modelo (algunos anuncios solo dicen "el Corolla")
  for (const v of vehicles) {
    if (lower.includes(v.modelo.toLowerCase())) return v;
  }

  return null;
}

// ── Supabase helpers ───────────────────────────────────────────────────────
async function getConversation(from) {
  const { data } = await supabase
    .from('conversations').select('*').eq('from_number', from).maybeSingle();
  return data || { from_number: from, state: 'idle', vehicle_id: null, prospect_name: null };
}

async function updateConversation(from, fields) {
  await supabase.from('conversations').upsert(
    { from_number: from, ...fields },
    { onConflict: 'from_number' }
  );
}

async function getVehicle(id) {
  const { data } = await supabase.from('vehicles').select('*').eq('id', id).maybeSingle();
  return data;
}

// ── Meta Cloud API ─────────────────────────────────────────────────────────
function extractMessage(body) {
  const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return null;
  return { from: msg.from, type: msg.type, text: msg.text?.body ?? '' };
}

async function sendText(to, body) {
  if (!WA_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('[ucars-bot] WA_TOKEN o WA_PHONE_NUMBER_ID no configurados');
    return;
  }
  await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body, preview_url: false } }),
  });
}

// ── Utils ──────────────────────────────────────────────────────────────────
const fmt       = n => n.toLocaleString('es-CL');
const fmtKm     = n => n.toLocaleString('es-CL') + ' km';
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
