/**
 * Pruebas de seguridad del webhook de Mercado Pago.
 * Correr con:  node tests/webhook.test.mjs
 */

import crypto from 'node:crypto';
import assert from 'node:assert/strict';

process.env.MP_WEBHOOK_SECRET = 'secreto-de-prueba';
process.env.MP_ACCESS_TOKEN = 'TEST-token';
// Sin APPS_SCRIPT_URL: no queremos que el test escriba en ninguna planilla.
delete process.env.APPS_SCRIPT_URL;

process.env.MP_ENABLED = 'true';
const { default: handler } = await import('../api/mercadopago/webhook.js');

function resFalso() {
  const r = { code: null, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  r.setHeader = () => r;
  return r;
}

function firmar(dataId, requestId, ts, secret = 'secreto-de-prueba') {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return crypto.createHmac('sha256', secret).update(manifest).digest('hex');
}

function pedido({ dataId = '123456', requestId = 'req-1', ts, hash }) {
  ts = ts ?? Math.floor(Date.now() / 1000);
  hash = hash ?? firmar(dataId, requestId, ts);
  return {
    method: 'POST',
    headers: { 'x-signature': `ts=${ts},v1=${hash}`, 'x-request-id': requestId },
    query: { 'data.id': dataId, type: 'payment' },
    body: { type: 'payment', data: { id: dataId } },
  };
}

let pasaron = 0, fallaron = 0;
async function test(nombre, fn) {
  try { await fn(); console.log(`  ok   ${nombre}`); pasaron++; }
  catch (e) { console.log(`  FALLA ${nombre}\n        ${e.message}`); fallaron++; }
}

console.log('\nSeguridad del webhook\n');

await test('rechaza una notificacion sin firma', async () => {
  const req = pedido({});
  delete req.headers['x-signature'];
  const res = resFalso();
  await handler(req, res);
  assert.equal(res.code, 401);
});

await test('rechaza una firma con secreto equivocado', async () => {
  const ts = Math.floor(Date.now() / 1000);
  const res = resFalso();
  await handler(pedido({ ts, hash: firmar('123456', 'req-1', ts, 'otro-secreto') }), res);
  assert.equal(res.code, 401);
});

await test('rechaza una firma valida para OTRO pago (no se puede reusar)', async () => {
  const ts = Math.floor(Date.now() / 1000);
  const req = pedido({ dataId: '999', ts, hash: firmar('111', 'req-1', ts) });
  const res = resFalso();
  await handler(req, res);
  assert.equal(res.code, 401);
});

await test('rechaza una notificacion vieja (proteccion contra reenvio)', async () => {
  const ts = Math.floor(Date.now() / 1000) - 3600; // una hora atras
  const res = resFalso();
  await handler(pedido({ ts }), res);
  assert.equal(res.code, 401);
});

await test('rechaza GET', async () => {
  const req = pedido({});
  req.method = 'GET';
  const res = resFalso();
  await handler(req, res);
  assert.equal(res.code, 405);
});

await test('acepta la firma correcta y consulta el pago', async () => {
  // Interceptamos la llamada a la API de Mercado Pago
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      id: 123456, status: 'approved', status_detail: 'accredited',
      external_reference: 'ord_test', transaction_amount: 55500, currency_id: 'ARS',
    }),
  });
  try {
    const res = resFalso();
    await handler(pedido({}), res);
    assert.equal(res.code, 200);
    assert.equal(res.body.status, 'approved');
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

await test('ignora notificaciones que no son de pagos', async () => {
  const req = pedido({});
  req.body = { type: 'plan', data: { id: '123456' } };
  req.query.type = 'plan';
  const res = resFalso();
  await handler(req, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.ignored, true);
});

console.log(`\n${pasaron} pasaron, ${fallaron} fallaron\n`);
process.exit(fallaron ? 1 : 0);
