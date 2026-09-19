/* ============================================
   CHECKOUT SERVICE - MercadoPago (Serverless) + WhatsApp
   ============================================ */

const CheckoutService = {
  envioSeleccionado: null,
  apiBase: '/api/mercadopago', // Vercel serverless function

  init() {
    // Checkout Pro redirige a mercadopago.com: el frontend no maneja
    // credenciales ni SDK. Todo el cobro pasa por /api/mercadopago.
  },

  renderCheckout() {
    // Fuente única de verdad para el envío: CartService (seleccionable desde el carrito o acá)
    this.envioSeleccionado = CartService.shippingId
      ? (CONFIG.envios.find(e => e.id === CartService.shippingId) || null)
      : null;
    const envioSeleccionado = this.envioSeleccionado;

    const subtotalARS = CartService.getLineasSubtotalARS();
    const descuentoARS = CartService.getDiscountAmount() || 0;
    const totalEnvio = envioSeleccionado ? envioSeleccionado.precio : 0;
    const totalFinal = CartService.getTotalARS();

    const itemsResumen = CartService.items.map(item => `
      <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border); font-size:0.85rem;">
        <span>${escHtml(item.nombre)} x${item.cantidad}${item.variante ? ` <small style="color:var(--text-muted);">(${escHtml(item.variante)})</small>` : ''}</span>
        <span style="font-weight:600;">${SheetsService.formatPrecioARS(item.precioARS * item.cantidad)}</span>
      </div>
    `).join('');

    const sinStockWarn = CartService.items.some(i => i.sinStock)
      ? `<div style="background:#FEF3C7; border:1px solid #F59E0B; color:#92400E; padding:0.5rem 0.75rem; border-radius:var(--radius-sm); font-size:0.8rem; margin-bottom:0.75rem;">Algunos productos de tu carrito quedaron sin stock. Quitálos o esperá el reabastecimiento para finalizar la compra.</div>`
      : '';

    const enviosHtml = CONFIG.envios
      .filter(e => e.activo)
      .map(envio => `
        <label class="envio-option ${this.envioSeleccionado && this.envioSeleccionado.id === envio.id ? 'envio-option--selected' : ''}"
               onclick="CheckoutService.seleccionarEnvio('${envio.id}')">
          <input type="radio" name="envio" value="${envio.id}"
                 ${this.envioSeleccionado && this.envioSeleccionado.id === envio.id ? 'checked' : ''} />
          <span class="envio-label">${envio.nombre}</span>
          <span class="envio-price">${envio.precio === 0 ? 'GRATIS' : SheetsService.formatPrecioARS(envio.precio)}</span>
        </label>
      `).join('');

    const provincias = [
      'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut',
      'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy',
      'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén',
      'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz',
      'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
    ];
    const provinciasOpts = provincias.map(p => `<option value="${p}">${p}</option>`).join('');

    const modal = document.getElementById('checkout-modal-content');
    if (!modal) return;

    modal.innerHTML = `
      <div class="modal-header">
        <h3>🛍️ Finalizar Compra</h3>
        <button class="modal__close" onclick="App.closeCheckout()">✕</button>
      </div>
      <div class="modal-body">
        <div class="checkout-resumen mb-2">
          <h4 style="font-size:0.9rem; font-weight:700; color:var(--primary); margin-bottom:0.75rem;">Resumen del pedido</h4>
          ${itemsResumen}
          ${sinStockWarn}
          <div class="cart__totals-row">
            <span>Productos</span>
            <span>${SheetsService.formatPrecioARS(subtotalARS)}</span>
          </div>
          ${descuentoARS > 0 ? `
          <div class="cart__totals-row">
            <span>Descuento</span>
            <span style="color:var(--success, #10B981);">-${SheetsService.formatPrecioARS(descuentoARS)}</span>
          </div>` : ''}
          <div class="cart__totals-row">
            <span>Envío</span>
            <span id="checkout-envio-monto">${envioSeleccionado ? (totalEnvio === 0 ? 'GRATIS' : SheetsService.formatPrecioARS(totalEnvio)) : 'Seleccionar'}</span>
          </div>
          <div class="cart__totals-row cart__totals-row--total">
            <span>Total</span>
            <span id="checkout-total-monto">${SheetsService.formatPrecioARS(totalFinal)}</span>
          </div>
        </div>

        <div style="margin-bottom:1.5rem;">
          <h4 style="font-size:0.9rem; font-weight:700; color:var(--primary); margin-bottom:0.75rem;">Método de envío *</h4>
          <div class="envio-options">
            ${enviosHtml}
          </div>
        </div>

        <form id="checkout-form" onsubmit="CheckoutService.procesarPago(event)">
          <h4 style="font-size:0.9rem; font-weight:700; color:var(--primary); margin-bottom:0.75rem;">Datos de contacto y envío</h4>

          <div class="form-group">
            <label>Nombre completo *</label>
            <input type="text" id="checkout-nombre" required placeholder="Tu nombre completo">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Teléfono *</label>
              <input type="tel" id="checkout-telefono" required placeholder="3757XXXXXX">
            </div>
            <div class="form-group">
              <label>Email *</label>
              <input type="email" id="checkout-email" required placeholder="tu@email.com">
            </div>
          </div>

          <div class="form-group">
            <label>Dirección de entrega *</label>
            <input type="text" id="checkout-direccion" required placeholder="Calle, número, piso, depto">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Localidad *</label>
              <input type="text" id="checkout-localidad" required placeholder="Ciudad / Localidad">
            </div>
            <div class="form-group">
              <label>Provincia *</label>
              <select id="checkout-provincia" required>
                <option value="">Seleccionar...</option>
                ${provinciasOpts}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Medio de pago preferido</label>
            <select id="checkout-pago">
              <option value="Mercado Pago">💳 Mercado Pago (tarjeta/débito/efectivo)</option>
              <option value="Transferencia">🏦 Transferencia bancaria</option>
              <option value="Efectivo">💵 Efectivo</option>
              <option value="A coordinar">🤝 A coordinar</option>
            </select>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn--primary" id="btn-mp-pay" onclick="CheckoutService.procesarPago(event)">
          💳 Pagar con Mercado Pago
        </button>
        <button class="btn btn--whatsapp" onclick="CheckoutService.enviarPorWhatsApp()">
          💬 Comprar por WhatsApp
        </button>
      </div>
    `;
  },

  cerrarCheckout() {
    App.closeCheckout();
  },

  seleccionarEnvio(envioId) {
    const envio = CONFIG.envios.find(e => e.id === envioId);
    if (!envio) return;
    this.envioSeleccionado = envio;
    // Sincronizar también en el carrito para que el total sea consistente en todos lados
    CartService.setShipping(envio.id, envio.precio);
    this.renderCheckout();
    // Mantener modal abierto
    document.getElementById('checkout-modal')?.classList.add('modal-overlay--open');
  },

  obtenerDatosFormulario() {
    return {
      nombre: document.getElementById('checkout-nombre')?.value?.trim() || '',
      telefono: document.getElementById('checkout-telefono')?.value?.trim() || '',
      email: document.getElementById('checkout-email')?.value?.trim() || '',
      direccion: document.getElementById('checkout-direccion')?.value?.trim() || '',
      localidad: document.getElementById('checkout-localidad')?.value?.trim() || '',
      provincia: document.getElementById('checkout-provincia')?.value || '',
      medioPago: document.getElementById('checkout-pago')?.value || 'A coordinar',
    };
  },

  async procesarPago(event) {
    if (event) event.preventDefault();

    const datos = this.obtenerDatosFormulario();
    if (!datos.nombre || !datos.telefono || !datos.email || !datos.direccion || !datos.localidad || !datos.provincia) {
      App.showToast('Por favor completá todos los campos obligatorios');
      return;
    }
    if (!this.envioSeleccionado) {
      App.showToast('Seleccioná un método de envío');
      return;
    }
    if (!CartService.items.length) {
      App.showToast('Tu carrito está vacío');
      return;
    }
    if (CartService.items.some(i => i.sinStock)) {
      App.showToast('Uno de los productos quedó sin stock. Revisá tu carrito.');
      return;
    }

    // Las cajas del Club Prince no están en el catálogo de productos, así que
    // el servidor no puede verificar su precio. Ese flujo se cierra por WhatsApp.
    if (CartService._hasClubPrinceItem && CartService._hasClubPrinceItem()) {
      App.showToast('Las cajas del Club Prince se coordinan por WhatsApp. Te llevamos ahí.');
      return this.enviarPorWhatsApp();
    }

    const btn = document.getElementById('btn-mp-pay');
    const restaurarBoton = () => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💳 Pagar con Mercado Pago';
      }
    };
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Confirmando tu pedido...';
    }

    // El navegador solo dice QUÉ quiere comprar. El precio lo pone el servidor.
    const payload = {
      items: CartService.items.map(i => ({
        id: i.id,
        cantidad: i.cantidad,
        variante: i._variant ? { color: i._variant.color, talle: i._variant.talle } : null,
      })),
      shippingId: this.envioSeleccionado.id,
      promoCode: CartService.promoCode || null,
      cliente: datos,
      totalEsperado: CartService.getTotalARS(),
    };

    try {
      const response = await fetch(`${this.apiBase}/create-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        restaurarBoton();

        // 409 = el carrito ya no es válido (stock o precios cambiaron)
        if (response.status === 409) {
          App.showToast(data.error || 'Tu carrito cambió. Revisalo antes de pagar.');
          await CartService.verifyStock();
          if (App.renderCartSidebar) App.renderCartSidebar();
          this.renderCheckout();
          return;
        }

        throw new Error(data.error || `Error ${response.status}`);
      }

      if (!data.init_point) throw new Error('No recibimos el link de pago');

      // Si el total cambió mientras compraba, avisamos antes de redirigir.
      if (data.recalculado) {
        const ok = window.confirm(
          `El total se actualizó a ${SheetsService.formatPrecioARS(data.total)}.\n\n¿Querés continuar con el pago?`
        );
        if (!ok) {
          restaurarBoton();
          return;
        }
      }

      // Guardamos solo la referencia: el estado real lo consultamos al volver.
      sessionStorage.setItem('mp_external_ref', data.external_reference);

      window.location.href = data.init_point;
    } catch (error) {
      console.error('[Checkout] Error MercadoPago:', error);
      restaurarBoton();
      App.showToast('No pudimos abrir el pago: ' + error.message + '. Probá por WhatsApp.');
    }
  },

  async enviarPorWhatsApp() {
    const datos = this.obtenerDatosFormulario();
    if (!datos.nombre || !datos.telefono) {
      App.showToast('Completá al menos nombre y teléfono');
      return;
    }
    if (!this.envioSeleccionado) {
      App.showToast('Seleccioná un método de envío');
      return;
    }
    if (CartService.items.some(i => i.sinStock)) {
      App.showToast('Uno de los productos quedó sin stock. Revisá tu carrito.');
      return;
    }

    // Verificar stock en tiempo real
    const stockCheck = await CartService.verifyStock();
    if (!stockCheck.ok) {
      App.showToast(stockCheck.message + ' Revisá tu carrito.');
      if (stockCheck.adjusted && typeof App !== 'undefined' && App.renderCartSidebar) {
        App.renderCartSidebar();
      }
      return;
    }

    CartService.enviarWhatsApp(this.envioSeleccionado, datos);
    this.cerrarCheckout();
  },

  /**
   * Se ejecuta al volver de Mercado Pago (App.init lo llama).
   *
   * El parámetro de la URL NO decide nada: lo consultamos al servidor, que
   * solo marca un pedido como confirmado cuando el webhook firmado de
   * Mercado Pago lo confirmó.
   */
  async checkPaymentReturn() {
    const params = new URLSearchParams(window.location.search);
    const pago = params.get('pago');
    const ref = params.get('ref') || sessionStorage.getItem('mp_external_ref');

    if (!pago || !ref) return;

    // Limpiar la URL para que un refresh no repita el mensaje
    window.history.replaceState({}, document.title, window.location.pathname);

    if (pago === 'error') {
      sessionStorage.removeItem('mp_external_ref');
      App.showToast('❌ El pago no se completó. Tu carrito sigue intacto, podés reintentar.');
      return;
    }

    App.showToast('⏳ Verificando tu pago...');

    const estado = await this.consultarEstado(ref);

    if (estado === 'confirmado') {
      sessionStorage.removeItem('mp_external_ref');
      CartService.clear();
      App.actualizarUI();
      App.closeCheckout();
      App.showToast('✅ ¡Pago aprobado! Te escribimos por WhatsApp para coordinar el envío.');
      return;
    }

    if (estado === 'cancelado') {
      sessionStorage.removeItem('mp_external_ref');
      App.showToast('❌ El pago fue rechazado. Podés reintentar o escribirnos por WhatsApp.');
      return;
    }

    // pendiente o desconocido: el pedido ya quedó registrado, solo falta que
    // Mercado Pago lo acredite (típico en pago en efectivo o transferencia).
    App.showToast('⏳ Tu pedido quedó registrado. Te avisamos apenas se acredite el pago.');
  },

  /**
   * Consulta el estado real del pedido, reintentando unos segundos porque el
   * webhook de Mercado Pago puede llegar justo después que la clienta.
   */
  async consultarEstado(ref, intentos = 4) {
    for (let i = 0; i < intentos; i++) {
      try {
        const res = await fetch(`${this.apiBase}/order-status?ref=${encodeURIComponent(ref)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.estado === 'confirmado' || data.estado === 'cancelado') return data.estado;
        }
      } catch (e) {
        console.warn('[Checkout] order-status falló:', e.message);
      }
      if (i < intentos - 1) await new Promise(r => setTimeout(r, 1500));
    }
    return 'pendiente';
  },
};

// Inicializar checkout service
CheckoutService.init();