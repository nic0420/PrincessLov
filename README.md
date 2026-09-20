# PrincessLov

Tienda online de indumentaria femenina (pijamas, conjuntos deportivos) con checkout real por Mercado Pago, panel de administración y programa de fidelidad.

**Demo:** https://princess-lov.vercel.app

## Qué hace

- **Catálogo y carrito** con productos, variantes y cálculo de precios.
- **Checkout con Mercado Pago**: creación de preferencia, webhook de confirmación de pago y consulta de estado del pedido.
- **Panel de administración** para gestionar productos y pedidos.
- **Club Prince**: programa de fidelidad para clientes recurrentes.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML, CSS y JavaScript vanilla (sin framework) |
| Backend | Funciones serverless de Node en Vercel (`api/mercadopago/`) |
| Pagos | Mercado Pago (preferencias + webhook) |
| Datos | Google Sheets como backend (`sheets.js` + Google Apps Script) |
| Tests | `node:test` |

Requiere Node 18 o superior.

## Cómo correrlo

```bash
git clone https://github.com/nic0420/PrincessLov.git
cd PrincessLov
npm install
npm test        # corre los tests de pricing y webhook
```

Para el checkout hay que configurar las variables de entorno de Mercado Pago. Los pasos están detallados en [MERCADOPAGO.md](MERCADOPAGO.md).

## Estructura

```
api/mercadopago/   create-preference, webhook, order-status
sheets.js          capa de datos sobre Google Sheets
tests/             pricing.test.mjs, webhook.test.mjs
MERCADOPAGO.md     guía de integración de pagos
```
