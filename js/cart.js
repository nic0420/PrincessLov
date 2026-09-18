/* ============================================
   CART SERVICE - Carrito de Compras (con soporte variantes)
   ============================================ */

const CartService = {
  items: [],
  listeners: [],
  shippingId: null,
  shippingCost: 0,
  discountAmount: 0,
  promoCode: null,
  promoData: null,
  _autoLines: [],

  /**
   * Inicializa el carrito desde localStorage
   */
  init() {
    const saved = localStorage.getItem('princesslov_cart');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (Array.isArray(data)) {
          this.items = data;
        } else if (data && typeof data === 'object') {
          this.items = data.items || [];
          this.shippingId = data.shippingId || null;
          this.shippingCost = data.shippingCost || 0;
          this.discountAmount = data.discountAmount || 0;
          this.promoCode = data.promoCode || null;
          this.promoData = data.promoData || null;
        }
      } catch (e) {
        this.items = [];
      }
    }
    this.notifyListeners();
  },

  /**
   * Guarda el carrito completo en localStorage
   */
  save() {
    localStorage.setItem('princesslov_cart', JSON.stringify({
      items: this.items,
      shippingId: this.shippingId,
      shippingCost: this.shippingCost,
      discountAmount: this.discountAmount,
      promoCode: this.promoCode,
      promoData: this.promoData,
    }));
    this.notifyListeners();
  },

  /**
   * Registra un listener para cambios en el carrito
   */
  onChange(callback) {
    this.listeners.push(callback);
  },

  /**
   * Notifica a los listeners
   */
  notifyListeners() {
    const count = this.getTotalItems();
    const total = this.getTotalARS();
    this.listeners.forEach(cb => cb({ items: this.items, count, total }));
  },

  /**
   * Agrega un producto al carrito (soporta variantes)
   */
  addItem(producto, cantidad = 1, variant = null) {
    // Soporta variante por parámetro o embebida en el producto (producto._variant)
    const v = variant || producto._variant || null;
    // Crear clave única: id + variante (color+talle)
    const variantKey = v ? `${v.color}|${v.talle}` : 'default';
    const itemKey = `${producto.id}::${variantKey}`;

    const existing = this.items.find(i => i.key === itemKey);

    // Límite de stock: si hay variante, usar el stock de esa variante
    const stockLimite = v
      ? (Array.isArray(producto.variantes)
        ? (producto.variantes.find(vv => vv.color === v.color && vv.talle === v.talle)?.stock ?? producto.stock)
        : producto.stock)
      : producto.stock;

    // Calcular precio ARS del producto (precio manual, oferta, preventa, flash y margen)
    const precioARS = (typeof PromoEngine !== 'undefined' && PromoEngine.precioCompraARS)
      ? PromoEngine.precioCompraARS(producto)
      : SheetsService.calcularPrecioARS(producto.precioUSD, producto);
    const precioUSD = producto.precioUSD;

    if (existing) {
      existing.cantidad = Math.min(existing.cantidad + cantidad, stockLimite);
    } else {
      const item = {
        key: itemKey,
        id: producto.id,
        nombre: producto.nombre,
        imagen: producto.imagen,
        precioUSD: precioUSD,
        precioARS: precioARS,
        cantidad: Math.min(cantidad, stockLimite),
        stock: stockLimite,
        categoria: producto.categoria || producto.categoriaOriginal || null,
        isClubPrince: !!(producto.isClubPrince || producto.categoria === 'club-prince'),
        variante: v ? `${v.color} / ${v.talle}` : null,
        _variant: v, // Para referencia interna
      };
      this.items.push(item);
    }

    this.save();
  },

  /**
   * Remueve un producto del carrito
   */
  removeItem(productId) {
    // Soporta tanto ID simple como key compuesta
    this.items = this.items.filter(i => i.key !== productId && i.id !== productId);
    this.save();
  },

  /**
   * Actualiza la cantidad de un producto
   */
  updateQuantity(productId, newQty) {
    const item = this.items.find(i => i.key === productId || i.id === productId);
    if (item) {
      if (newQty <= 0) {
        this.removeItem(productId);
      } else {
        item.cantidad = Math.min(newQty, this.getItemStock(item));
        this.save();
      }
    }
  },

  /**
   * Devuelve el stock disponible real para un item (respeta la variante)
   */
  getItemStock(item) {
    const producto = SheetsService.obtenerProducto(item.id);
    if (item._variant && producto && Array.isArray(producto.variantes) && producto.variantes.length) {
      const v = producto.variantes.find(vv => vv.color === item._variant.color && vv.talle === item._variant.talle);
      if (v) return v.stock || 0;
    }
    return producto ? (producto.stock || 0) : (item.stock ?? 99);
  },

  /**
   * Sincroniza stock/cantidades del carrito con los datos actuales y marca
   * items sin stock o con cantidad ajustada (avisos entre sesiones)
   */
  sincronizarStock() {
    if (!Array.isArray(this.items) || this.items.length === 0) return 0;
    let cambios = 0;
    this.items.forEach(item => {
      if (item.isClubPrince) return;
      const stock = this.getItemStock(item);
      if (stock <= 0) {
        const yaMarcado = item.sinStock;
        item.sinStock = true;
        item.stockAjustado = false;
        if (!yaMarcado) cambios++;
      } else if (item.cantidad > stock) {
        const yaAjustado = item.stockAjustado;
        item.cantidad = stock;
        item.stockAjustado = true;
        item.sinStock = false;
        if (!yaAjustado) cambios++;
      } else {
        item.sinStock = false;
        item.stockAjustado = false;
      }
    });
    if (cambios > 0) this.save();
    return cambios;
  },

  /**
   * Verifica stock en tiempo real contra el servidor
   * Retorna { ok: boolean, message: string, adjusted: boolean }
   */
  async verifyStock() {
    if (!this.items.length) return { ok: true, message: '', adjusted: false };

    // Intentar verificar contra Apps Script (si está configurado)
    const url = (typeof CONFIG !== 'undefined' && CONFIG.sheets?.appsScriptUrl && !CONFIG.sheets.appsScriptUrl.includes('TU_SCRIPT_ID'))
      ? CONFIG.sheets.appsScriptUrl : null;

    let stockMap = {};

    if (url && typeof fetch !== 'undefined') {
      try {
        const ids = this.items.filter(i => !i.isClubPrince).map(i => i.id);
        const u = new URL(url);
        u.searchParams.set('action', 'check_stock');
        u.searchParams.set('ids', ids.join(','));
        const res = await fetch(u, { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') stockMap = data;
        }
      } catch (e) {
        console.warn('[Cart] verifyStock remoto falló:', e.message);
      }
    }

    // Fallback: usar stock local de SheetsService
    if (!Object.keys(stockMap).length && typeof SheetsService !== 'undefined') {
      this.items.forEach(item => {
        if (item.isClubPrince) return;
        const prod = SheetsService.obtenerProducto(item.id);
        if (prod) stockMap[item.id] = prod.stock;
      });
    }

    let adjusted = false;
    const warnings = [];

    this.items.forEach(item => {
      if (item.isClubPrince) return;
      const serverStock = stockMap[item.id];
      if (serverStock == null) return;

      if (serverStock <= 0 && !item.sinStock) {
        item.sinStock = true;
        item.stockAjustado = false;
        warnings.push(`${item.nombre}: sin stock`);
        adjusted = true;
      } else if (item.cantidad > serverStock) {
        item.cantidad = serverStock;
        item.stockAjustado = true;
        item.sinStock = false;
        warnings.push(`${item.nombre}: ajustado a ${serverStock} u.`);
        adjusted = true;
      }
    });

    if (adjusted) this.save();

    return {
      ok: warnings.length === 0,
      message: warnings.length ? `Stock actualizado: ${warnings.join(', ')}` : '',
      adjusted,
    };
  },

  /**
   * Obtiene el total de items
   */
  getTotalItems() {
    return this.items.reduce((sum, i) => sum + i.cantidad, 0);
  },

  /**
   * Total "bruto" de líneas (sin restar 2x1/combos ni cupón)
   */
  getLineasSubtotalARS() {
    this.items.forEach(item => {
      // Recalcular por si cambió el dólar o expiró una promo
      const producto = SheetsService.obtenerProducto(item.id);
      if (producto) {
        item.precioARS = (typeof PromoEngine !== 'undefined' && PromoEngine.precioCompraARS)
          ? PromoEngine.precioCompraARS(producto)
          : SheetsService.calcularPrecioARS(producto.precioUSD, producto);
      }
    });
    return this.items.reduce((sum, i) => sum + (i.precioARS * i.cantidad), 0);
  },

  /**
   * Descuentos automáticos (2x1 y combos) del carrito actual
   */
  calcAutoDiscount() {
    this._autoLines = [];
    if (typeof PromoEngine === 'undefined') return 0;
    const byId = (id) => SheetsService.obtenerProducto(id);
    const lines = PromoEngine.descuentosAutomaticos(this.items, byId);
    this._autoLines = lines;
    return lines.reduce((s, l) => s + l.monto, 0);
  },

  getAutoDiscountLines() {
    return this._autoLines || [];
  },

  /**
   * Obtiene el subtotal en ARS (líneas - descuentos automáticos 2x1/combos)
   */
  getSubtotalARS() {
    const lineas = this.getLineasSubtotalARS();
    return Math.max(0, lineas - this.calcAutoDiscount());
  },

  /**
   * Obtiene el total en ARS (líneas - descuentos automáticos - cupón + envío)
   */
  getTotalARS() {
    const lineas = this.getLineasSubtotalARS();
    const auto = this.calcAutoDiscount();
    const shipping = this.shippingCost || 0;
    const coupon = this.discountAmount || 0;
    return lineas + shipping - auto - coupon;
  },

  /**
   * Obtiene el costo de envío
   */
  getShippingCost() {
    return this.shippingCost || 0;
  },

  /**
   * Obtiene el monto total de descuento (cupón + promos automáticas)
   */
  getDiscountAmount() {
    const auto = this.calcAutoDiscount();
    return (this.discountAmount || 0) + auto;
  },

  /**
   * Establece el envío seleccionado
   */
  setShipping(shippingId, cost) {
    this.shippingId = shippingId;
    this.shippingCost = cost;
    this.save();
  },

  /**
   * Aplica un código promocional
   */
  applyPromo(code, promo) {
    this.promoCode = code;
    this.promoData = promo;
    const type = promo.type || promo.tipo;
    const value = promo.value != null ? promo.value : promo.valor;
    if (type === 'percent') {
      this.discountAmount = Math.round(this.getLineasSubtotalARS() * value / 100);
    } else if (type === 'fijo') {
      this.discountAmount = Math.min(value, this.getLineasSubtotalARS());
    } else if (type === 'shipping') {
      this.shippingCost = 0;
    }
    this.save();
  },

  /**
   * Remueve el código promocional
   */
  removePromo() {
    this.promoCode = null;
    this.promoData = null;
    this.discountAmount = 0;
    this.save();
  },

  /**
   * Obtiene el total en USD
   */
  getTotalUSD() {
    return this.items.reduce((sum, i) => sum + (i.precioUSD * i.cantidad), 0);
  },

  /**
   * Limpia el carrito
   */
  clear() {
    this.items = [];
    this.shippingId = null;
    this.shippingCost = 0;
    this.discountAmount = 0;
    this.promoCode = null;
    this.promoData = null;
    this._autoLines = [];
    this.save();
  },

  /**
   * Genera el texto para WhatsApp (completo con variantes)
   */
  /**
   * Detecta si el carrito contiene al menos un producto VIP del Club Prince
   * @returns {boolean}
   */
  _hasClubPrinceItem() {
    return this.items.some(i => {
      const prod = (typeof SheetsService !== 'undefined' && SheetsService.obtenerProducto) ? SheetsService.obtenerProducto(i.id) : null;
      const catMatch = (prod?.categoria === 'club-prince') || (i.categoria === 'club-prince') || (i.isClubPrince === true) || (prod?.isClubPrince === true);
      const tagMatch = Array.isArray(prod?.tags) && prod.tags.some(t => String(t).toLowerCase().includes('club'));
      return catMatch || tagMatch;
    });
  },

  generarMensajeWhatsApp(envioSeleccionado, datosCliente) {
    let itemsTexto = this.items.map(i => {
      const base = `• ${i.nombre} x${i.cantidad}`;
      const variantText = i.variante ? `\n     Talle: ${i._variant?.talle || ''} | Color: ${i._variant?.color || ''}` : '';
      const precioLine = SheetsService.formatPrecioARS(i.precioARS * i.cantidad);
      return `${base} - ${precioLine}${variantText}`;
    }).join('\n');

    // Agregar resumen de descuento/envío si aplica
    const subtotal = this.getLineasSubtotalARS();
    if (this.discountAmount > 0 && this.promoCode) {
      itemsTexto += `\n• Descuento (${this.promoCode}): -${SheetsService.formatPrecioARS(this.discountAmount)}`;
    }
    const autoLines = this.getAutoDiscountLines();
    autoLines.forEach(l => {
      itemsTexto += `\n• ${l.label}: -${SheetsService.formatPrecioARS(l.monto)}`;
    });
    if (this.shippingCost > 0) {
      itemsTexto += `\n• Envío: ${SheetsService.formatPrecioARS(this.shippingCost)}`;
    }

    let datosTexto = '';
    if (datosCliente) {
      datosTexto = `👤 *Datos del cliente:*`;
      datosTexto += `\nNombre: ${datosCliente.nombre || '-'}`;
      datosTexto += `\nTeléfono: ${datosCliente.telefono || '-'}`;
      datosTexto += `\nEmail: ${datosCliente.email || '-'}`;
      datosTexto += `\n📍 *Dirección:* ${datosCliente.direccion || '-'}`;
      if (datosCliente.localidad) datosTexto += `\nLocalidad: ${datosCliente.localidad}`;
      if (datosCliente.provincia) datosTexto += `\nProvincia: ${datosCliente.provincia}`;
    }

    const envioTexto = envioSeleccionado
      ? `${envioSeleccionado.nombre}${envioSeleccionado.precio > 0 ? ' (' + SheetsService.formatPrecioARS(envioSeleccionado.precio) + ')' : ' (GRATIS)'}`
      : 'No seleccionado';

    const pagoTexto = datosCliente?.medioPago || 'A coordinar';

    // Lógica condicional Club Prince (crítico): si hay al menos un VIP, el saludo cambia obligatoriamente
    const isClubPrince = this._hasClubPrinceItem();

    let mensaje;
    if (isClubPrince) {
      // Saludo exacto exigido, ignora whatsappTemplate estándar
      const detallePedido = `${itemsTexto}\n\n💰 *Subtotal:* ${SheetsService.formatPrecioARS(this.getSubtotalARS())}\n🚚 *Envío:* ${envioTexto}\n💳 *Total:* ${SheetsService.formatPrecioARS(this.getTotalARS())}\n*Medio de pago:* ${pagoTexto}\n\n${datosTexto}`;
      mensaje = `Yanela del club Prince quiero esto\n\n${detallePedido}`;
    } else {
      mensaje = CONFIG.whatsappTemplate
        .replace('{items}', itemsTexto)
        .replace('{total}', SheetsService.formatPrecioARS(this.getTotalARS()))
        .replace('{envio}', envioSeleccionado ? `${envioSeleccionado.nombre}${envioSeleccionado.precio > 0 ? ' (' + SheetsService.formatPrecioARS(envioSeleccionado.precio) + ')' : ' (GRATIS)'}` : 'No seleccionado')
        .replace('{pago}', datosCliente?.medioPago || 'A coordinar')
        .replace('{datos}', `${datosTexto}\n\n💰 *Subtotal:* ${SheetsService.formatPrecioARS(this.getSubtotalARS())}\n🚚 *Envío:* ${envioTexto}\n💳 *Total:* ${SheetsService.formatPrecioARS(this.getTotalARS())}`);
    }

    return mensaje;
  },

  /**
   * Abre WhatsApp con el mensaje del pedido
   */
  enviarWhatsApp(envioSeleccionado, datosCliente) {
    const mensaje = this.generarMensajeWhatsApp(envioSeleccionado, datosCliente);
    const encoded = encodeURIComponent(mensaje);
    const url = `https://wa.me/${CONFIG.negocio.whatsapp}?text=${encoded}`;
    window.open(url, '_blank');
  },

  /**
   * Genera mensaje simplificado para un solo producto (quick WhatsApp)
   */
  generarMensajeProducto(producto, cantidad = 1, variant = null) {
    const isClub = (producto.categoria === 'club-prince' || producto.isClubPrince || (Array.isArray(producto.tags) && producto.tags.some(t => String(t).toLowerCase().includes('club'))));
    const precioARS = SheetsService.calcularPrecioARS(producto.precioUSD, producto);
    const variantText = variant ? `\n${variant.color} / ${variant.talle}` : '';
    if (isClub) {
      return `Yanela del club Prince quiero esto\n\n• ${producto.nombre}${variantText} x${cantidad} - ${SheetsService.formatPrecioARS(precioARS * cantidad)}`;
    }
    const texto = `Hola! Me interesa: ${producto.nombre}${variantText}\nCantidad: ${cantidad}\nPrecio: ${SheetsService.formatPrecioARS(precioARS * cantidad)}`;
    return texto;
  },

  /**
   * Versión tipada del generador de URL de WhatsApp (if/else VIP) — para uso directo / tests
   * @param {Array<{id:string,categoria?:string,isClubPrince?:boolean}>} items
   * @param {string} detallePedido - string ya formado con items y totales
   * @returns {string} url wa.me con encodeURIComponent
   */
  buildWhatsAppUrl(items, detallePedido) {
    const hasVip = (items || []).some(it =>
      it.categoria === 'club-prince' || it.categoria === 'Club Prince' || it.isClubPrince === true ||
      (Array.isArray(it.tags) && it.tags.some(t => String(t).toLowerCase().includes('club')))
    );
    const header = hasVip ? 'Yanela del club Prince quiero esto' : `Hola! Quiero hacer un pedido en ${CONFIG.negocio?.nombre || 'PrincessLov'} 🛍️`;
    const mensaje = `${header}\n\n${detallePedido}`;
    return `https://wa.me/${CONFIG.negocio.whatsapp}?text=${encodeURIComponent(mensaje)}`;
  },
};