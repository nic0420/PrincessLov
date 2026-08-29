/**
 * Vercel Serverless Function - Crear Preferencia Mercado Pago
 * 
 * Variables de entorno requeridas en Vercel:
 * - MP_ACCESS_TOKEN: Access Token de producción de Mercado Pago
 * - MP_PUBLIC_KEY: Public Key de producción
 * - FRONTEND_URL: URL de tu tienda (ej: https://princess-lov.vercel.app)
 * 
 * Deploy: vercel --prod
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[MP] MP_ACCESS_TOKEN no configurado en variables de entorno');
    return res.status(500).json({ error: 'Configuración de servidor incompleta' });
  }

  try {
    const {
      items,           // Array de items { title, quantity, unit_price, currency_id }
      payer,           // { name, email, phone, address }
      back_urls,       // { success, failure, pending }
      auto_return = 'approved',
      external_reference,
      notification_url,
      statement_descriptor = 'PrincessLov',
      expires = false,
      expiration_date_from,
      expiration_date_to,
    } = req.body;

    // Validaciones básicas
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items requeridos' });
    }

    if (!payer || !payer.email) {
      return res.status(400).json({ error: 'Email del comprador requerido' });
    }

    // Construir preferencia
    const preference = {
      items: items.map(item => ({
        title: item.title,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        currency_id: item.currency_id || 'ARS',
        description: item.description || '',
        picture_url: item.picture_url || '',
        category_id: item.category_id || 'others',
      })),
      payer: {
        name: payer.name,
        email: payer.email,
        phone: payer.phone ? { area_code: '', number: payer.phone.replace(/\D/g, '') } : undefined,
        address: payer.address ? {
          street_name: payer.address.street_name || '',
          street_number: Number(payer.address.street_number) || undefined,
          zip_code: payer.address.zip_code || '',
          city: payer.address.city || '',
          state: payer.address.state || '',
        } : undefined,
      },
      back_urls: back_urls || {
        success: `${process.env.FRONTEND_URL || 'https://princess-lov.vercel.app'}?status=success`,
        failure: `${process.env.FRONTEND_URL || 'https://princess-lov.vercel.app'}?status=failure`,
        pending: `${process.env.FRONTEND_URL || 'https://princess-lov.vercel.app'}?status=pending`,
      },
      auto_return,
      external_reference: external_reference || `order_${Date.now()}`,
      notification_url: notification_url || `${process.env.FRONTEND_URL || 'https://princess-lov.vercel.app'}/api/mercadopago/webhook`,
      statement_descriptor,
      expires,
      expiration_date_from,
      expiration_date_to,
      // Metadata para identificar el pedido en webhook
      metadata: {
        store: 'princesslov',
        version: '1.0',
      },
    };

    // Llamar a Mercado Pago
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    });

    const data = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[MP] Error creando preferencia:', data);
      return res.status(mpResponse.status).json({
        error: data.message || 'Error al crear preferencia',
        detail: data,
      });
    }

    // Responder con init_point y preference_id
    return res.status(200).json({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      preference: data,
    });

  } catch (error) {
    console.error('[MP] Error interno:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      detail: error.message,
    });
  }
}