/**
 * Vercel Serverless Function - Webhook Mercado Pago
 * 
 * Recibe notificaciones de cambios de estado de pagos.
 * Guarda en localStorage (simulado) o en base de datos real.
 * 
 * Configurar en Mercado Pago: https://www.mercadopago.com.ar/developers/panel/notifications
 * URL: https://tu-dominio.vercel.app/api/mercadopago/webhook
 */

export default async function handler(req, res) {
  // Mercado Pago envía POST con x-signature header para verificación
  // Verificación opcional pero recomendada
  
  console.log('[MP Webhook] Received:', req.method, req.query, req.body);

  // Responder rápido (MP espera 2xx en < 500ms)
  res.status(200).json({ received: true });

  // Procesar asíncrono
  try {
    const { type, data } = req.body;
    
    if (type === 'payment') {
      const paymentId = data.id;
      
      // Obtener detalles del pago
      const payment = await fetchPaymentDetails(paymentId);
      if (!payment) return;
      
      const externalReference = payment.external_reference;
      const status = payment.status; // approved, pending, rejected, cancelled, refunded
      const statusDetail = payment.status_detail;
      
      console.log(`[MP Webhook] Payment ${paymentId} - ${status} (${statusDetail}) - Ref: ${externalReference}`);
      
      // Aquí guardar en tu base de datos / Sheets / notificar por email / etc.
      // Por ahora logueamos
      await processPaymentUpdate(externalReference, {
        mpPaymentId: paymentId,
        status,
        statusDetail,
        amount: payment.transaction_amount,
        currency: payment.currency_id,
        payerEmail: payment.payer?.email,
        payerName: payment.payer?.name,
        paidAt: payment.date_approved,
        raw: payment,
      });
    }
  } catch (error) {
    console.error('[MP Webhook] Error procesando:', error);
  }
}

async function fetchPaymentDetails(paymentId) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[MP] No access token para webhook');
    return null;
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (!response.ok) {
      console.error(`[MP] Error fetching payment ${paymentId}:`, response.status);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('[MP] Error fetch payment:', error);
    return null;
  }
}

async function processPaymentUpdate(externalReference, paymentData) {
  // TODO: Implementar según tu backend
  // Opciones:
  // 1. Guardar en Google Sheets via Apps Script
  // 2. Guardar en base de datos (Supabase, Firebase, PlanetScale, etc.)
  // 3. Enviar email de confirmación
  // 4. Actualizar stock
  // 5. Disparar webhook a tu frontend (Server-Sent Events, WebSocket, polling)
  
  console.log('[MP] Procesando actualización:', externalReference, paymentData.status);
  
  // Ejemplo: si usas Google Sheets via Apps Script webhook
  if (process.env.SHEETS_WEBHOOK_URL) {
    try {
      await fetch(process.env.SHEETS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalReference, ...paymentData }),
      });
    } catch (e) {
      console.error('[MP] Error enviando a Sheets webhook:', e);
    }
  }
}