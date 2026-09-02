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

  /**
   * Inicializa el carrito desde localStorage
   */
  init() {
    const saved = localStorage.getItem('princesslov_cart');
    if (saved) {
      try {
        this.items = JSON.parse(saved);
      } catch (e) {
        this.items = [];
      }
    }
    this.notifyListeners();
  },

  /**
   * Guarda el carrito en localStorage
   */
  save() {
    localStorage.setItem('princesslov_cart', JSON.stringify(this.items));
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

    // Calcular precio ARS del producto (considera precio manual, oferta, margen)
    const precioARS = SheetsService.calcularPrecioARS(producto.precioUSD, producto);
    const precioUSD = producto.precioUSD;

    if (existing) {
      existing.cantidad = Math.min(existing.cantidad + cantidad, producto.stock);
    } else {
      const item = {
        key: itemKey,
        id: producto.id,
        nombre: producto.nombre,
        imagen: producto.imagen,
        precioUSD: precioUSD,
        precioARS: precioARS,
        cantidad: Math.min(cantidad, producto.stock),
        stock: producto.stock,
        variante: v ? `${v.color} / ${v.talle}` : null,
        _variant: v, // Para referencia interna
      };
      this.items.push(item);
    }

    this.save();
    const variantText = v ? ` (${v.color} / ${v.talle})` : '';
    App.showToast(`Agregado: ${producto.nombre}${variantText}`);
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
        item.cantidad = Math.min(newQty, item.stock);
        this.save();
      }
    }
  },

  /**
   * Obtiene el total de items
   */
  getTotalItems() {
    return this.items.reduce((sum, i) => sum + i.cantidad, 0);
  },

  /**
   * Obtiene el subtotal (sin envío ni descuentos)
   */
  getSubtotalARS() {
    this.items.forEach(item => {
      // Recalcular por si cambió el dólar
      const producto = SheetsService.obtenerProducto(item.id);
      if (producto) {
        item.precioARS = SheetsService.calcularPrecioARS(producto.precioUSD, producto);
      }
    });
    return this.items.reduce((sum, i) => sum + (i.precioARS * i.cantidad), 0);
  },

  /**
   * Obtiene el total en ARS (con envío y descuentos)
   */
  getTotalARS() {
    const subtotal = this.getSubtotalARS();
    const shipping = this.shippingCost || 0;
    const discount = this.discountAmount || 0;
    return subtotal + shipping - discount;
  },

  /**
   * Obtiene el costo de envío
   */
  getShippingCost() {
    return this.shippingCost || 0;
  },

  /**
   * Obtiene el monto de descuento
   */
  getDiscountAmount() {
    return this.discountAmount || 0;
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
    if (promo.type === 'percent') {
      this.discountAmount = Math.round(this.getSubtotalARS() * promo.value / 100);
    } else if (promo.type === 'shipping') {
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
    this.save();
  },

  /**
   * Genera el texto para WhatsApp (completo con variantes)
   */
  generarMensajeWhatsApp(envioSeleccionado, datosCliente) {
    const precioEnvio = envioSeleccionado ? envioSeleccionado.precio : 0;
    const total = this.getTotalARS() + precioEnvio;

    let itemsTexto = this.items.map(i => {
      const base = `• ${i.nombre} x${i.cantidad}`;
      const variantText = i.variante ? `\n     Talle: ${i._variant?.talle || ''} | Color: ${i._variant?.color || ''}` : '';
      const precioLine = SheetsService.formatPrecioARS(i.precioARS * i.cantidad);
      return `${base} - ${precioLine}${variantText}`;
    }).join('\n');

    // Agregar resumen de descuento/envío si aplica
    const subtotal = this.getSubtotalARS();
    if (this.discountAmount > 0) {
      itemsTexto += `\n• Descuento (${this.promoCode}): -${SheetsService.formatPrecioARS(this.discountAmount)}`;
    }
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

    const mensaje = CONFIG.whatsappTemplate
      .replace('{items}', itemsTexto)
      .replace('{total}', SheetsService.formatPrecioARS(this.getTotalARS() + (envioSeleccionado?.precio || 0)))
      .replace('{envio}', envioSeleccionado ? `${envioSeleccionado.nombre}${envioSeleccionado.precio > 0 ? ' (' + SheetsService.formatPrecioARS(envioSeleccionado.precio) + ')' : ' (GRATIS)'}` : 'No seleccionado')
      .replace('{pago}', datosCliente?.medioPago || 'A coordinar')
      .replace('{datos}', `${datosTexto}\n\n💰 *Subtotal:* ${SheetsService.formatPrecioARS(this.getSubtotalARS())}\n🚚 *Envío:* ${envioTexto}\n💳 *Total:* ${SheetsService.formatPrecioARS(this.getTotalARS() + (envioSeleccionado?.precio || 0))}`);

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
    const precioARS = SheetsService.calcularPrecioARS(producto.precioUSD, producto);
    const variantText = variant ? `\n${variant.color} / ${variant.talle}` : '';
    const texto = `Hola! Me interesa: ${producto.nombre}${variantText}\nCantidad: ${cantidad}\nPrecio: ${SheetsService.formatPrecioARS(precioARS * cantidad)}`;
    return texto;
  },
};