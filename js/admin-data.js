/* ============================================
   ADMIN DATA - Capa de Persistencia Local
   ============================================ */

const AdminData = {
  // ==========================================
  // CLAVES DE STORAGE
  // ==========================================
  KEYS: {
    products: 'pl_admin_products',
    orders: 'pl_admin_orders',
    expenses: 'pl_admin_expenses',
    settings: 'pl_admin_settings',
    dolarHistory: 'pl_admin_dolar_history',
  },

  // ==========================================
  // PRODUCTOS
  // ==========================================
  getProducts() {
    return JSON.parse(localStorage.getItem(this.KEYS.products) || '[]');
  },

  saveProducts(products) {
    localStorage.setItem(this.KEYS.products, JSON.stringify(products));
  },

  addProduct(product) {
    const products = this.getProducts();
    product.id = product.id || this.generateId();
    product.fechaCreacion = product.fechaCreacion || new Date().toISOString();
    product.fechaModificacion = new Date().toISOString();
    products.push(product);
    this.saveProducts(products);
    return product;
  },

  updateProduct(id, updates) {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    products[idx] = { ...products[idx], ...updates, fechaModificacion: new Date().toISOString() };
    this.saveProducts(products);
    return products[idx];
  },

  deleteProduct(id) {
    const products = this.getProducts().filter(p => p.id !== id);
    this.saveProducts(products);
  },

  getProduct(id) {
    return this.getProducts().find(p => p.id === id) || null;
  },

  importProducts(csvData) {
    const existing = this.getProducts();
    const existingIds = new Set(existing.map(p => p.id));
    let added = 0, updated = 0;

    csvData.forEach(item => {
      if (existingIds.has(item.id)) {
        const idx = existing.findIndex(p => p.id === item.id);
        existing[idx] = { ...existing[idx], ...item, fechaModificacion: new Date().toISOString() };
        updated++;
      } else {
        item.fechaCreacion = new Date().toISOString();
        item.fechaModificacion = new Date().toISOString();
        existing.push(item);
        added++;
      }
    });

    this.saveProducts(existing);
    return { added, updated, total: existing.length };
  },

  // ==========================================
  // PEDIDOS / VENTAS
  // ==========================================
  getOrders() {
    return JSON.parse(localStorage.getItem(this.KEYS.orders) || '[]');
  },

  saveOrders(orders) {
    localStorage.setItem(this.KEYS.orders, JSON.stringify(orders));
  },

  addOrder(order) {
    const orders = this.getOrders();
    order.id = order.id || this.generateId();
    order.fecha = order.fecha || new Date().toISOString();
    order.estado = order.estado || 'pendiente';
    orders.push(order);
    this.saveOrders(orders);

    // Descontar stock
    if (order.items) {
      order.items.forEach(item => {
        this.adjustStock(item.productoId, -item.cantidad);
      });
    }

    return order;
  },

  updateOrder(id, updates) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return null;

    const oldOrder = orders[idx];
    orders[idx] = { ...oldOrder, ...updates, fechaModificacion: new Date().toISOString() };

    // Si se cancela y antes estaba activa, devolver stock
    if (updates.estado === 'cancelado' && oldOrder.estado !== 'cancelado' && oldOrder.items) {
      oldOrder.items.forEach(item => {
        this.adjustStock(item.productoId, item.cantidad);
      });
    }

    this.saveOrders(orders);
    return orders[idx];
  },

  deleteOrder(id) {
    const order = this.getOrder(id);
    if (order && order.estado !== 'cancelado' && order.items) {
      order.items.forEach(item => {
        this.adjustStock(item.productoId, item.cantidad);
      });
    }
    const orders = this.getOrders().filter(o => o.id !== id);
    this.saveOrders(orders);
  },

  getOrder(id) {
    return this.getOrders().find(o => o.id === id) || null;
  },

  // ==========================================
  // GASTOS
  // ==========================================
  getExpenses() {
    return JSON.parse(localStorage.getItem(this.KEYS.expenses) || '[]');
  },

  saveExpenses(expenses) {
    localStorage.setItem(this.KEYS.expenses, JSON.stringify(expenses));
  },

  addExpense(expense) {
    const expenses = this.getExpenses();
    expense.id = expense.id || this.generateId();
    expense.fecha = expense.fecha || new Date().toISOString();
    expenses.push(expense);
    this.saveExpenses(expenses);
    return expense;
  },

  deleteExpense(id) {
    const expenses = this.getExpenses().filter(e => e.id !== id);
    this.saveExpenses(expenses);
  },

  getTotalExpenses(period) {
    const expenses = this.getExpenses();
    if (!period) return expenses.reduce((s, e) => s + (e.monto || 0), 0);
    return expenses.filter(e => this.isInPeriod(e.fecha, period)).reduce((s, e) => s + (e.monto || 0), 0);
  },

  // ==========================================
  // STOCK
  // ==========================================
  adjustStock(productId, delta) {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.id === productId);
    if (idx !== -1) {
      products[idx].stock = Math.max(0, (products[idx].stock || 0) + delta);
      products[idx].fechaModificacion = new Date().toISOString();
      this.saveProducts(products);
    }
  },

  getLowStockProducts(threshold = 5) {
    return this.getProducts().filter(p => p.activo && (p.stock || 0) <= threshold);
  },

  // ==========================================
  // CONFIGURACIÓN
  // ==========================================
  getSettings() {
    return JSON.parse(localStorage.getItem(this.KEYS.settings) || '{}');
  },

  saveSettings(settings) {
    localStorage.setItem(this.KEYS.settings, JSON.stringify(settings));
  },

  // ==========================================
  // HISTORIAL DÓLAR
  // ==========================================
  addDolarRate(rate) {
    const history = JSON.parse(localStorage.getItem(this.KEYS.dolarHistory) || '[]');
    history.push({ fecha: new Date().toISOString(), valor: rate });
    // Mantener solo últimos 90 días
    if (history.length > 90) history.splice(0, history.length - 90);
    localStorage.setItem(this.KEYS.dolarHistory, JSON.stringify(history));
  },

  getDolarHistory() {
    return JSON.parse(localStorage.getItem(this.KEYS.dolarHistory) || '[]');
  },

  // ==========================================
  // ESTADÍSTICAS / MÉTRICAS
  // ==========================================
  getStats(periodo) {
    const orders = this.getOrders().filter(o => o.estado !== 'cancelado');
    const products = this.getProducts();
    const now = new Date();

    // Filtrar por período
    const filtered = periodo ? orders.filter(o => this.isInPeriod(o.fecha, periodo)) : orders;

    const ingresos = filtered.reduce((s, o) => s + (o.total || 0), 0);
    const costos = filtered.reduce((s, o) => s + (o.costoTotal || 0), 0);
    const ganancia = ingresos - costos;
    const margen = ingresos > 0 ? (ganancia / ingresos * 100) : 0;

    // Pedidos por estado
    const porEstado = {};
    ADMIN_CONFIG.estadosPedido.forEach(ep => {
      porEstado[ep.id] = filtered.filter(o => o.estado === ep.id).length;
    });

    // Productos más vendidos
    const vendidos = {};
    filtered.forEach(o => {
      (o.items || []).forEach(item => {
        vendidos[item.productoId] = (vendidos[item.productoId] || 0) + item.cantidad;
      });
    });

    const topProductos = Object.entries(vendidos)
      .map(([id, cant]) => {
        const prod = products.find(p => p.id === id);
        return { id, nombre: prod?.nombre || id, cantidad: cant };
      })
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    // Ventas por día (últimos 30 días)
    const ventasPorDia = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      ventasPorDia[key] = { fecha: key, ingresos: 0, pedidos: 0 };
    }
    filtered.forEach(o => {
      const key = o.fecha?.slice(0, 10);
      if (ventasPorDia[key]) {
        ventasPorDia[key].ingresos += o.total || 0;
        ventasPorDia[key].pedidos += 1;
      }
    });

    // Ticket promedio
    const ticketProm = filtered.length > 0 ? ingresos / filtered.length : 0;

    return {
      periodo: periodo || 'total',
      totalPedidos: filtered.length,
      pedidosActivos: filtered.filter(o => !['entregado', 'cancelado'].includes(o.estado)).length,
      ingresos,
      costos,
      ganancia,
      margen,
      ticketProm,
      porEstado,
      topProductos,
      ventasPorDia: Object.values(ventasPorDia),
    };
  },

  /**
   * Punto de equilibrio: cuántas unidades necesitás vender para cubrir gastos fijos
   */
  calcularPuntoEquilibrio(dolar) {
    const gastos = ADMIN_CONFIG.gastosFijos;
    const costosVar = ADMIN_CONFIG.costosVariables;
    const totalGastosFijos = Object.values(gastos).reduce((s, v) => s + (v || 0), 0);

    // Calcular ganancia promedio por unidad (usando productos activos)
    const products = this.getProducts().filter(p => p.activo && p.precioUSD > 0);
    if (products.length === 0) return { unidades: 0, monto: 0, gastosFijos: totalGastosFijos, gananciaPromUnit: 0 };

    let gananciaTotalUSD = 0;
    products.forEach(p => {
      const precioVenta = p.precioUSD * (dolar || 1200) * (CONFIG?.cotizacion?.margenGanancia || 1.3);
      const costoTotal = p.precioUSD + costosVar.envoltorio + costosVar.etiqueta;
      const costoARS = costoTotal * (dolar || 1200);
      const comisionMP = precioVenta * costosVar.comisionMP;
      const gananciaUnit = precioVenta - costoARS - comisionMP;
      gananciaTotalUSD += gananciaUnit;
    });

    const gananciaPromUnit = gananciaTotalUSD / products.length;
    const unidades = gananciaPromUnit > 0 ? Math.ceil(totalGastosFijos / gananciaPromUnit) : 0;

    return {
      unidades,
      monto: unidades * gananciaPromUnit,
      gastosFijos: totalGastosFijos,
      gananciaPromUnit,
    };
  },

  // ==========================================
  // UTILIDADES
  // ==========================================
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  },

  isInPeriod(fecha, periodo) {
    if (!fecha) return false;
    const d = new Date(fecha);
    const now = new Date();
    switch (periodo) {
      case 'hoy':
        return d.toDateString() === now.toDateString();
      case 'semana': {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
      }
      case 'mes': {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return d >= monthAgo;
      }
      case 'trimestre': {
        const qAgo = new Date(now);
        qAgo.setMonth(qAgo.getMonth() - 3);
        return d >= qAgo;
      }
      case 'anio': {
        const yAgo = new Date(now);
        yAgo.setFullYear(yAgo.getFullYear() - 1);
        return d >= yAgo;
      }
      default:
        return true;
    }
  },

  formatARS(val) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(val || 0);
  },

  formatUSD(val) {
    return 'USD ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(val || 0);
  },

  formatNumber(val) {
    return new Intl.NumberFormat('es-AR').format(val || 0);
  },
};
