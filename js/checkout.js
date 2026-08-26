/* ============================================
   CHECKOUT SERVICE - MercadoPago + WhatsApp
   ============================================ */

const CheckoutService = {
  envioSeleccionado: null,

  init() {
    if (typeof MercadoPago !== 'undefined' && CONFIG.mercadopago.publicKey !== 'TEST-xxxx-xxxx-xxxx') {
      this.mp = new MercadoPago(CONFIG.mercadopago.publicKey, { locale: 'es-AR' });
    }
  },

  renderCheckout() {
    const totalARS = CartService.getTotalARS();
    const totalEnvio = this.envioSeleccionado ? this.envioSeleccionado.precio : 0;
    const totalFinal = totalARS + totalEnvio;

    const itemsResumen = CartService.items.map(item => `
      <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--gris-200); font-size:0.85rem;">
        <span>${item.nombre} x${item.cantidad}</span>
        <span style="font-weight:600;">${SheetsService.formatPrecioARS(item.precioARS * item.cantidad)}</span>
      </div>
    `).join('');

    const enviosHtml = CONFIG.envios
      .filter(e => e.activo)
      .map(envio => `
        <label class="envio-option ${this.envioSeleccionado && this.envioSeleccionado.id === envio.id ? 'selected' : ''}"
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
        <button class="btn-close-modal" onclick="App.closeCheckout()">✕</button>
      </div>
      <div class="modal-body">
        <div class="checkout-resumen mb-2">
          <h4 style="font-size:0.9rem; font-weight:700; color:var(--borgona-400); margin-bottom:0.75rem;">Resumen del pedido</h4>
          ${itemsResumen}
          <div class="cart-subtotal" style="margin-top:0.75rem;">
            <span>Productos</span>
            <span>${SheetsService.formatPrecioARS(totalARS)}</span>
          </div>
          <div class="cart-subtotal">
            <span>Envío</span>
            <span id="checkout-envio-monto">${this.envioSeleccionado ? (this.envioSeleccionado.precio === 0 ? 'GRATIS' : SheetsService.formatPrecioARS(this.envioSeleccionado.precio)) : 'Seleccionar'}</span>
          </div>
          <div class="cart-total">
            <span>Total</span>
            <span id="checkout-total-monto">${SheetsService.formatPrecioARS(totalFinal)}</span>
          </div>
        </div>

        <div style="margin-bottom:1.5rem;">
          <h4 style="font-size:0.9rem; font-weight:700; color:var(--borgona-400); margin-bottom:0.75rem;">Método de envío *</h4>
          <div class="envio-options">
            ${enviosHtml}
          </div>
        </div>

        <form id="checkout-form" onsubmit="CheckoutService.procesarPago(event)">
          <h4 style="font-size:0.9rem; font-weight:700; color:var(--borgona-400); margin-bottom:0.75rem;">Datos de contacto y envío</h4>

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
              <option value="Mercado Pago">Mercado Pago (tarjeta/débito)</option>
              <option value="Transferencia">Transferencia bancaria</option>
              <option value="Efectivo">Efectivo</option>
              <option value="A coordinar">A coordinar</option>
            </select>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn-pagar-mp" onclick="CheckoutService.procesarPago(event)">
          💳 Pagar con Mercado Pago
        </button>
        <button class="btn-enviar-whatsapp" onclick="CheckoutService.enviarPorWhatsApp()">
          💬 Comprar por WhatsApp
        </button>
      </div>
    `;
  },

  cerrarCheckout() {
    App.closeCheckout();
  },

  seleccionarEnvio(envioId) {
    this.envioSeleccionado = CONFIG.envios.find(e => e.id === envioId);
    this.renderCheckout();
    document.getElementById('checkout-modal')?.classList.add('open');
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

    const totalARS = CartService.getTotalARS();
    const envioPrecio = this.envioSeleccionado.precio;

    const items = CartService.items.map(item => ({
      title: item.nombre,
      quantity: item.cantidad,
      unit_price: item.precioARS,
      currency_id: 'ARS',
    }));

    if (envioPrecio > 0) {
      items.push({
        title: `Envío - ${this.envioSeleccionado.nombre}`,
        quantity: 1,
        unit_price: envioPrecio,
        currency_id: 'ARS',
      });
    }

    const preference = {
      items: items,
      payer: {
        name: datos.nombre,
        email: datos.email,
        phone: { number: datos.telefono },
        address: {
          street_name: datos.direccion,
          city: datos.localidad,
          state: datos.provincia,
        },
      },
      back_urls: {
        success: window.location.href + '?status=success',
        failure: window.location.href + '?status=failure',
        pending: window.location.href + '?status=pending',
      },
      auto_return: 'approved',
    };

    try {
      App.showToast('Redirigiendo a Mercado Pago...');

      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.mercadopago.accessToken}`,
        },
        body: JSON.stringify(preference),
      });

      if (!response.ok) throw new Error('Error al crear preferencia');

      const data = await response.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error('No se recibió URL de pago');
      }
    } catch (error) {
      console.error('[Checkout] Error MercadoPago:', error);
      App.showToast('Error al procesar el pago. Intentá nuevamente o comprá por WhatsApp.');
    }
  },

  enviarPorWhatsApp() {
    const datos = this.obtenerDatosFormulario();
    if (!datos.nombre || !datos.telefono) {
      App.showToast('Completá al menos nombre y teléfono');
      return;
    }
    if (!this.envioSeleccionado) {
      App.showToast('Seleccioná un método de envío');
      return;
    }

    CartService.enviarWhatsApp(this.envioSeleccionado, datos);
    this.cerrarCheckout();
  },
};
