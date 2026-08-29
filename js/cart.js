/* ============================================
   CART SERVICE - Carrito de Compras
   ============================================ */

const CartService = {
  items: [],
  listeners: [],

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
   * Agrega un producto al carrito
   */
  addItem(producto, cantidad = 1) {
    const existing = this.items.find(i => i.id === producto.id);

    if (existing) {
      existing.cantidad = Math.min(existing.cantidad + cantidad, producto.stock);
    } else {
      this.items.push({
        id: producto.id,
        nombre: producto.nombre,
        imagen: producto.imagen,
        precioUSD: producto.precioUSD,
        precioARS: SheetsService.calcularPrecioARS(producto.precioUSD),
        cantidad: Math.min(cantidad, producto.stock),
        stock: producto.stock,
      });
    }

    this.save();
    App.showToast(`${producto.nombre} agregado al carrito`);
  },

  /**
   * Remueve un producto del carrito
   */
  removeItem(productId) {
    this.items = this.items.filter(i => i.id !== productId);
    this.save();
  },

  /**
   * Actualiza la cantidad de un producto
   */
  updateQuantity(productId, newQty) {
    const item = this.items.find(i => i.id === productId);
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
      item.precioARS = SheetsService.calcularPrecioARS(item.precioUSD);
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
    this.save();
  },

  /**
   * Genera el texto para WhatsApp
   */
  generarMensajeWhatsApp(envioSeleccionado, datosCliente) {
    const precioEnvio = envioSeleccionado ? envioSeleccionado.precio : 0;
    const total = this.getTotalARS() + precioEnvio;

    let itemsTexto = this.items.map(i => {
      return `• ${i.nombre} x${i.cantidad} - ${SheetsService.formatPrecioARS(i.precioARS * i.cantidad)}`;
    }).join('\n');

    let datosTexto = '';
    if (datosCliente) {
      datosTexto = `Nombre: ${datosCliente.nombre || '-'}`;
      datosTexto += `\nTeléfono: ${datosCliente.telefono || '-'}`;
      datosTexto += `\nEmail: ${datosCliente.email || '-'}`;
      datosTexto += `\nDirección: ${datosCliente.direccion || '-'}`;
      if (datosCliente.localidad) {
        datosTexto += `\nLocalidad: ${datosCliente.localidad}`;
      }
      if (datosCliente.provincia) {
        datosTexto += `\nProvincia: ${datosCliente.provincia}`;
      }
    }

    const envioTexto = envioSeleccionado
      ? `${envioSeleccionado.nombre}${precioEnvio > 0 ? ' (' + SheetsService.formatPrecioARS(precioEnvio) + ')' : ' (GRATIS)'}`
      : 'No seleccionado';

    const pagoTexto = datosCliente?.medioPago || 'A coordinar';

    const mensaje = CONFIG.whatsappTemplate
      .replace('{items}', itemsTexto)
      .replace('{total}', SheetsService.formatPrecioARS(total))
      .replace('{envio}', envioTexto)
      .replace('{pago}', pagoTexto)
      .replace('{datos}', datosTexto);

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
};
