/* ============================================
   CHECKOUT SERVICE - MercadoPago (Serverless) + WhatsApp
   ============================================ */

const CheckoutService = {
  envioSeleccionado: null,
  apiBase: '/api/mercadopago', // Vercel serverless function

  init() {
    // Ya no inicializamos MP en frontend (se usa serverless)
    // Si tenés Public Key para Payment Brick futuro:
    // if (typeof MercadoPago !== 'undefined' && CONFIG.mercadopago.publicKey) {
    //   this.mp = new MercadoPago(CONFIG.mercadopago.publicKey, { locale: 'es-AR' });
    // }
  },

  renderCheckout() {
    const totalARS = CartService.getTotalARS();
    const totalEnvio = this.envioSeleccionado ? this.envioSeleccionado.precio : 0;
    const totalFinal = totalARS + totalEnvio;

    const itemsResumen = CartService.items.map(item => `
      <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border); font-size:0.85rem;">
        <span>${item.nombre} x${item.cantidad}</span>
        <span style="font-weight:600;">${SheetsService.formatPrecioARS(item.precioARS * item.cantidad)}</span>
      </div>
    `).join('');

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
          <div class="cart__totals-row">
            <span>Productos</span>
            <span>${SheetsService.formatPrecioARS(totalARS)}</span>
          </div>
          <div class="cart__totals-row">
            <span>Envío</span>
            <span id="checkout-envio-monto">${this.envioSeleccionado ? (this.envioSeleccionado.precio === 0 ? 'GRATIS' : SheetsService.formatPrecioARS(this.envioSeleccionado.precio)) : 'Seleccionar'}</span>
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
    this.envioSeleccionado = CONFIG.envios.find(e => e.id === envioId);
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

    const btn = document.getElementById('btn-mp-pay');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Creando preferencia...';
    }

    const totalARS = CartService.getTotalARS();
    const envioPrecio = this.envioSeleccionado.precio;

    const items = CartService.items.map(item => ({
      title: item.nombre,
      quantity: item.cantidad,
      unit_price: item.precioARS,
      currency_id: 'ARS',
      picture_url: item.imagen,
    }));

    if (envioPrecio > 0) {
      items.push({
        title: `Envío - ${this.envioSeleccionado.nombre}`,
        quantity: 1,
        unit_price: envioPrecio,
        currency_id: 'ARS',
      });
    }

    // Generar reference único para rastrear en webhook
    const externalRef = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const preference = {
      items,
      payer: {
        name: datos.nombre,
        email: datos.email,
        phone: { area_code: '', number: datos.telefono.replace(/\D/g, '') },
        address: {
          street_name: datos.direccion,
          city: datos.localidad,
          state: datos.provincia,
        },
      },
      back_urls: {
        success: window.location.origin + window.location.pathname + '?status=success&ref=' + externalRef,
        failure: window.location.origin + window.location.pathname + '?status=failure&ref=' + externalRef,
        pending: window.location.origin + window.location.pathname + '?status=pending&ref=' + externalRef,
      },
      auto_return: 'approved',
      external_reference: externalRef,
      metadata: {
        cliente: datos.nombre,
        telefono: datos.telefono,
        email: datos.email,
        direccion: datos.direccion,
        localidad: datos.localidad,
        provincia: datos.provincia,
        medioPago: datos.medioPago,
        metodoEnvio: this.envioSeleccionado.id,
        envioPrecio: envioPrecio,
      },
    };

    try {
      App.showToast('Conectando con Mercado Pago...');

      const response = await fetch(`${this.apiBase}/create-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preference, external_reference: externalRef }),
      });

      if (btn) {
        btn.disabled = false;
        btn.textContent = '💳 Pagar con Mercado Pago';
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(err.error || `Error ${response.status}`);
      }

      const data = await response.json();

      if (data.init_point) {
        // Guardar reference en sesión para recuperar al volver
        sessionStorage.setItem('mp_external_ref', externalRef);
        sessionStorage.setItem('mp_checkout_data', JSON.stringify({
          datos,
          envio: this.envioSeleccionado,
          items: CartService.items.map(i => ({ ...i })),
        }));
        
        // Redirigir a Mercado Pago
        window.location.href = data.init_point;
      } else {
        throw new Error('No se recibió URL de pago');
      }
    } catch (error) {
      console.error('[Checkout] Error MercadoPago:', error);
      App.showToast('Error al procesar el pago: ' + error.message + '. Intentá por WhatsApp.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💳 Pagar con Mercado Pago';
      }
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

  // Método para verificar estado al volver de MP (llamar en App.init)
  async checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const ref = urlParams.get('ref');
    
    if (status && ref) {
      // Limpiar URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      const saved = sessionStorage.getItem('mp_checkout_data');
      if (saved) {
        const { datos, envio, items } = JSON.parse(saved);
        sessionStorage.removeItem('mp_checkout_data');
        sessionStorage.removeItem('mp_external_ref');
        
        if (status === 'success') {
          App.showToast('✅ ¡Pago aprobado! Tu pedido está confirmado.');
          
          // Crear pedido en Sheets via Apps Script
          try {
            await fetch('/api/mercadopago/create-preference', { // Reuse endpoint or create new
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'create_order',
                order: {
                  id: ref,
                  cliente: datos.nombre,
                  telefono: datos.telefono,
                  email: datos.email,
                  direccion: datos.direccion,
                  localidad: datos.localidad,
                  provincia: datos.provincia,
                  estado: 'confirmado',
                  medioPago: 'Mercado Pago',
                  metodoEnvio: envio.id,
                  total: CartService.getTotalARS() + (envio.precio || 0),
                  costoTotal: CartService.items.reduce((s, i) => s + (i.precioUSD * i.cantidad), 0) * (SheetsService.cotizacionDolar || 1200) * 0.7, // estimado
                  notas: `Pago MP aprobado. Ref: ${ref}`,
                  items: items.map(i => ({
                    productoId: i.id,
                    cantidad: i.cantidad,
                    precioUnitario: i.precioARS,
                  })),
                },
              }),
            });
          } catch (e) {
            console.error('Error guardando pedido post-MP:', e);
          }
          
          CartService.clear();
          App.actualizarUI();
          App.closeCheckout();
        } else if (status === 'failure') {
          App.showToast('❌ Pago rechazado. Podés reintentar o comprar por WhatsApp.');
        } else if (status === 'pending') {
          App.showToast('⏳ Pago pendiente. Te avisamos cuando se acredite.');
        }
      }
    }
  },
};

// Inicializar checkout service
CheckoutService.init();