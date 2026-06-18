import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET /api/stock — lectura pública ──────────────────────────────────────
  if (req.method === 'GET') {
    const { tipo, filter, marca, min, max, search } = req.query;

    let query = supabase
      .from('vehicles')
      .select('id,marca,modelo,version,tipo,año,precio,km,combustible,transmision,color,estado,badge,imagen,dias_en_stock,created_at')
      .order('created_at', { ascending: false });

    if (filter === 'disponible') query = query.eq('estado', 'Disponible');
    if (filter === 'reservado')  query = query.eq('estado', 'Reservado');
    if (filter === 'vendido')    query = query.eq('estado', 'Vendido');
    if (tipo)   query = query.eq('tipo', tipo);
    if (marca)  query = query.ilike('marca', `%${marca}%`);
    if (min)    query = query.gte('precio', parseInt(min));
    if (max)    query = query.lte('precio', parseInt(max));
    if (search) query = query.or(`marca.ilike.%${search}%,modelo.ilike.%${search}%,version.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ── Operaciones de escritura: requieren ADMIN_KEY ─────────────────────────
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.ADMIN_KEY}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // POST /api/stock — crear vehículo
  if (req.method === 'POST') {
    const vehicle = sanitize(req.body);
    const { data, error } = await supabase
      .from('vehicles')
      .insert([vehicle])
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  }

  // PATCH /api/stock — editar vehículo
  if (req.method === 'PATCH') {
    const { id, ...fields } = req.body;
    if (!id) return res.status(400).json({ error: 'id requerido' });
    const { data, error } = await supabase
      .from('vehicles')
      .update(sanitize(fields))
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }

  // DELETE /api/stock?id=uuid — eliminar vehículo
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id requerido' });
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

function sanitize(obj) {
  const allowed = [
    'patente','marca','modelo','version','tipo','año','precio','km',
    'combustible','transmision','color','tapiz','num_duenos',
    'estado','badge','imagen',
    'vendedor_nombre','vendedor_telefono',
    'notas',
  ];
  const clean = {};
  for (const k of allowed) {
    if (obj[k] !== undefined) clean[k] = obj[k];
  }
  return clean;
}
