/**
 * GET /api/mercadopago/order-status?ref=ord_xxx
 * ------------------------------------------------------------------
 * Le dice al frontend el estado REAL de un pedido.
 *
 * Antes la tienda confiaba en el parametro ?status=success de la URL,
 * que cualquiera puede escribir a mano. Ahora el estado se lee de la
 * planilla, donde solo lo escribe el webhook firmado.
 * ------------------------------------------------------------------
 */

import { getFromAppsScript, appsScriptUrl } from '../_lib/store.js';

export default async function handler(req, res) {
  // Cobro online desactivado: los pedidos se cierran por WhatsApp.
  // Para reactivar Mercado Pago, cargar MP_ENABLED=true en Vercel.
  if (process.env.MP_ENABLED !== 'true') {
    return res.status(404).json({ error: 'No disponible' });
  }

  const origin = process.env.FRONTEND_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo no permitido' });

  const ref = String(req.query?.ref || '').trim();
  if (!ref || !/^ord_[a-z0-9_]+$/i.test(ref)) {
    return res.status(400).json({ error: 'Referencia invalida' });
  }

  if (!appsScriptUrl()) {
    return res.status(200).json({ ref, estado: 'desconocido', mensaje: 'Sin backend configurado' });
  }

  try {
    const data = await getFromAppsScript('order_status', { ref });

    if (!data || data.error || !data.encontrado) {
      return res.status(200).json({ ref, estado: 'desconocido' });
    }

    // Solo devolvemos lo minimo: nunca datos personales del pedido.
    return res.status(200).json({
      ref,
      estado: data.estado || 'pendiente',
      mpStatus: data.mpStatus || '',
      total: data.total || 0,
    });
  } catch (error) {
    console.error('[order-status] Error:', error.message);
    return res.status(200).json({ ref, estado: 'desconocido' });
  }
}
