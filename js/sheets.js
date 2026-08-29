/* ============================================
   SHEETS SERVICE - Google Sheets via Apps Script API
   Con cache, fallback local, y sincronía bidireccional
   ============================================ */

const SheetsService = {
  productos: [],
  cotizacionDolar: null,
  lastFetch: null,
  cache: null,
  cacheExpiry: 5 * 60 * 1000, // 5 min cache
  
  // URL del Google Apps Script Web App (configurar en Vercel env o data/config.js)
  appsScriptUrl: null,

  /**
   * Inicializa la URL del Apps Script desde config
   */
  init() {
    this.appsScriptUrl = CONFIG.sheets?.appsScriptUrl || null;
    console.log('[Sheets] Apps Script URL:', this.appsScriptUrl ? 'Configurada' : 'No configurada (usando CSV público)');
  },

  /**
   * Parsea un CSV string a array de objetos
   */
  parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = this.parseCSVLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = this.parseCSVLine(lines[i]);
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header.trim()] = (values[idx] || '').trim();
      });
      data.push(obj);
    }
    return data;
  },

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  },

  /**
   * Carga productos - Intenta Apps Script primero, luego CSV público, luego fallback local
   */
  async cargarProductos(forceRefresh = false) {
    // Verificar cache
    if (!forceRefresh && this.cache && Date.now() - this.cache.timestamp < this.cacheExpiry) {
      this.productos = this.cache.data;
      console.log('[Sheets] Usando cache (' + this.productos.length + ' productos)');
      return this.productos;
    }

    // 1. Intentar Google Apps Script (bidireccional, con todos los campos nuevos)
    if (this.appsScriptUrl) {
      try {
        console.log('[Sheets] Intentando Apps Script...');
        const data = await this.fetchFromAppsScript('read', { sheet: 'productos' });
        if (data && data.length > 0) {
          this.productos = this.mapAppsScriptProducts(data);
          this.setCache(this.productos);
          console.log('[Sheets] ✅ Apps Script: ' + this.productos.length + ' productos');
          return this.productos;
        }
      } catch (e) {
        console.warn('[Sheets] Apps Script falló:', e.message);
      }
    }

    // 2. CSV público de Google Sheets (solo lectura, campos básicos)
    try {
      console.log('[Sheets] Intentando CSV público...');
      const response = await fetch(CONFIG.sheets.url);
      if (response.ok) {
        const csvText = await response.text();
        const rawData = this.parseCSV(csvText);
        this.productos = this.mapCSVProducts(rawData);
        this.setCache(this.productos);
        console.log('[Sheets] ✅ CSV público: ' + this.productos.length + ' productos');
        return this.productos;
      }
    } catch (e) {
      console.warn('[Sheets] CSV público falló:', e.message);
    }

    // 3. Fallback local (data/productos.csv)
    console.log('[Sheets] Usando fallback local...');
    return this.cargarFallback();
  },

  /**
   * Mapea datos del Apps Script (formato completo con campos nuevos)
   */
  mapAppsScriptProducts(raw) {
    return raw
      .filter(p => p.Activo === true || p.Activo === 'TRUE' || p.Activo === 'true')
      .map(p => ({
        id: p.ID || this.generarId(),
        nombre: p.Nombre || 'Sin nombre',
        categoria: (p.Categoria || '').toLowerCase().replace(/\s+/g, '-'),
        categoriaOriginal: p.Categoria || '',
        subcategoria: p.Subcategoria || '',
        descripcion: p.Descripcion || '',
        descripcionCorta: p.DescripcionCorta || '',
        precioUSD: parseFloat(p.PrecioUSD) || 0,
        precioARSManual: p.PrecioARSManual ? parseFloat(p.PrecioARSManual) : null,
        precioOferta: p.PrecioOferta ? parseFloat(p.PrecioOferta) : null,
        margenPersonalizado: p.MargenPersonalizado ? parseFloat(p.MargenPersonalizado) / 100 : null,
        imagen: p.Imagen || CONFIG.imagenes.placeholder,
        stock: parseInt(p.Stock) || 0,
        stockMin: parseInt(p.StockMin) || 5,
        peso: p.Peso ? parseInt(p.Peso) : null,
        dimensiones: p.Dimensiones || '',
        tags: p.Tags ? p.Tags.split(',').map(t => t.trim().toLowerCase()) : [],
        sku: p.SKU || '',
        galeria: this.parseJSONSafe(p.Galeria, []),
        variantes: this.parseJSONSafe(p.Variantes, []),
        caracteristicas: this.parseJSONSafe(p.Caracteristicas, {}),
        activo: p.Activo === true || p.Activo === 'TRUE' || p.Activo === 'true',
        destacado: p.Destacado === true || p.Destacado === 'TRUE',
        soloWeb: p.SoloWeb === true || p.SoloWeb === 'TRUE',
        seoTitle: p.SEOTitle || '',
        seoDesc: p.SEODesc || '',
        fechaCreacion: p.FechaCreacion,
        fechaModificacion: p.FechaModificacion,
      }));
  },

  /**
   * Mapea CSV público (formato legacy básico)
   */
  mapCSVProducts(raw) {
    return raw
      .filter(p => p['Activo'] && p['Activo'].toUpperCase() === 'TRUE')
      .map(p => ({
        id: p['ID'] || this.generarId(),
        nombre: p['Nombre'] || 'Sin nombre',
        categoria: (p['Categoria'] || '').toLowerCase().replace(/\s+/g, '-'),
        categoriaOriginal: p['Categoria'] || '',
        subcategoria: p['Subcategoria'] || '',
        descripcion: p['Descripcion'] || '',
        descripcionCorta: '',
        precioUSD: parseFloat(p['PrecioUSD']) || 0,
        precioARSManual: null,
        precioOferta: null,
        margenPersonalizado: null,
        imagen: p['Imagen'] || CONFIG.imagenes.placeholder,
        stock: parseInt(p['Stock']) || 0,
        stockMin: 5,
        peso: null,
        dimensiones: '',
        tags: p['Tags'] ? p['Tags'].split(',').map(t => t.trim().toLowerCase()) : [],
        sku: '',
        galeria: [],
        variantes: [],
        caracteristicas: {},
        activo: true,
        destacado: false,
        soloWeb: false,
        seoTitle: '',
        seoDesc: '',
      }));
  },

  parseJSONSafe(str, fallback) {
    try {
      return str ? JSON.parse(str) : fallback;
    } catch {
      return fallback;
    }
  },

  /**
   * Fetch genérico al Apps Script
   */
  async fetchFromAppsScript(action, params = {}) {
    const url = new URL(this.appsScriptUrl);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  /**
   * Post al Apps Script (para escrituras)
   */
  async postToAppsScript(action, data) {
    const response = await fetch(this.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });

    if (!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result;
  },

  setCache(data) {
    this.cache = { data, timestamp: Date.now() };
  },

  invalidateCache() {
    this.cache = null;
  },

  /**
   * Carga fallback local (data/productos.csv)
   */
  cargarFallback() {
    console.log('[Sheets] Usando fallback local CSV');
    return fetch('data/productos.csv')
      .then(r => r.text())
      .then(csv => {
        const rawData = this.parseCSV(csv);
        this.productos = this.mapCSVProducts(rawData);
        this.setCache(this.productos);
        return this.productos;
      })
      .catch(() => {
        this.productos = [];
        this.setCache([]);
        return [];
      });
  },

  /**
   * Obtiene cotización del dólar - Apps Script > CriptoYa > Manual
   */
  async obtenerCotizacion() {
    if (!CONFIG.cotizacion.autoCotizacion) {
      this.cotizacionDolar = CONFIG.cotizacion.cotizacionManual;
      return this.cotizacionDolar;
    }

    // 1. Apps Script (si tiene historial propio)
    if (this.appsScriptUrl) {
      try {
        const data = await this.fetchFromAppsScript('dolar');
        if (data && data.length > 0) {
          const latest = data[data.length - 1];
          this.cotizacionDolar = parseFloat(latest.Valor) || CONFIG.cotizacion.cotizacionManual;
          console.log('[Dólar] Apps Script: $' + this.cotizacionDolar);
          return this.cotizacionDolar;
        }
      } catch (e) {
        console.warn('[Dólar] Apps Script falló:', e.message);
      }
    }

    // 2. CriptoYa API
    try {
      const response = await fetch(CONFIG.sheets.dolarUrl);
      const data = await response.json();
      this.cotizacionDolar = data.oficial?.ask || data.blue?.ask || CONFIG.cotizacion.cotizacionManual;
      console.log('[Dólar] CriptoYa: $' + this.cotizacionDolar);
      return this.cotizacionDolar;
    } catch (error) {
      console.warn('[Dólar] CriptoYa falló:', error.message);
    }

    // 3. Manual
    this.cotizacionDolar = CONFIG.cotizacion.cotizacionManual;
    console.log('[Dólar] Manual: $' + this.cotizacionDolar);
    return this.cotizacionDolar;
  },

  /**
   * Calcula precio ARS con soporte para precio manual, oferta y margen personalizado
   */
  calcularPrecioARS(precioUSD, producto = null) {
    if (!this.cotizacionDolar) this.cotizacionDolar = CONFIG.cotizacion.cotizacionManual;
    
    // Si el producto tiene precio ARS manual fijo, usar ese
    if (producto?.precioARSManual) return producto.precioARSManual;
    
    // Calcular con margen (personalizado o global)
    const margen = producto?.margenPersonalizado ?? CONFIG.cotizacion.margenGanancia;
    const precio = precioUSD * this.cotizacionDolar * margen;
    return Math.round(precio);
  },

  formatPrecioARS(precio) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(precio || 0);
  },

  formatPrecioUSD(precio) {
    return 'USD ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(precio || 0);
  },

  generarId() {
    return 'prod_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  // ==================== MÉTODOS DE CONSULTA ====================

  obtenerProducto(id) {
    return this.productos.find(p => p.id === id) || null;
  },

  obtenerProductos() {
    return this.productos;
  },

  obtenerCategoriasConConteo() {
    const conteo = {};
    this.productos.forEach(p => {
      if (p.activo) conteo[p.categoria] = (conteo[p.categoria] || 0) + 1;
    });

    return CONFIG.categorias.map(cat => ({
      ...cat,
      count: conteo[cat.id] || 0,
    })).filter(cat => cat.id === 'todos' || cat.count > 0);
  },

  filtrarPorCategoria(categoriaId) {
    if (categoriaId === 'todos') return this.productos.filter(p => p.activo);
    return this.productos.filter(p => p.activo && p.categoria === categoriaId);
  },

  buscarProductos(texto) {
    const query = texto.toLowerCase().trim();
    if (!query) return this.productos.filter(p => p.activo);
    
    return this.productos.filter(p => p.activo && (
      p.nombre.toLowerCase().includes(query) ||
      p.descripcion.toLowerCase().includes(query) ||
      p.categoriaOriginal.toLowerCase().includes(query) ||
      p.tags.some(t => t.includes(query)) ||
      (p.sku && p.sku.toLowerCase().includes(query))
    ));
  },

  // ==================== SINCRONÍA ADMIN → SHEETS ====================

  /**
   * Guarda producto en Google Sheets via Apps Script
   */
  async guardarProducto(producto) {
    if (!this.appsScriptUrl) {
      console.warn('[Sheets] Apps Script no configurado, guardando solo localStorage');
      return this.guardarLocal(producto);
    }

    try {
      await this.postToAppsScript('upsert_product', { product: this.serializeForSheets(producto) });
      this.invalidateCache();
      await this.cargarProductos(true);
      return { success: true };
    } catch (error) {
      console.error('[Sheets] Error guardando en Sheets:', error);
      // Fallback local
      return this.guardarLocal(producto);
    }
  },

  async eliminarProducto(id) {
    if (!this.appsScriptUrl) return this.eliminarLocal(id);

    try {
      await this.postToAppsScript('delete_product', { id });
      this.invalidateCache();
      await this.cargarProductos(true);
      return { success: true };
    } catch (error) {
      console.error('[Sheets] Error eliminando:', error);
      return this.eliminarLocal(id);
    }
  },

  serializeForSheets(p) {
    return {
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      categoriaOriginal: p.categoriaOriginal,
      subcategoria: p.subcategoria || '',
      descripcion: p.descripcion || '',
      descripcionCorta: p.descripcionCorta || '',
      precioUSD: p.precioUSD,
      precioARSManual: p.precioARSManual,
      precioOferta: p.precioOferta,
      margenPersonalizado: p.margenPersonalizado ? p.margenPersonalizado * 100 : null,
      imagen: p.imagen,
      stock: p.stock,
      stockMin: p.stockMin || 5,
      peso: p.peso,
      dimensiones: p.dimensiones,
      tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''),
      sku: p.sku || '',
      galeria: JSON.stringify(p.galeria || []),
      variantes: JSON.stringify(p.variantes || []),
      caracteristicas: JSON.stringify(p.caracteristicas || {}),
      activo: p.activo,
      destacado: p.destacado,
      soloWeb: p.soloWeb,
      seoTitle: p.seoTitle || '',
      seoDesc: p.seoDesc || '',
    };
  },

  // ==================== LOCALSTORAGE FALLBACK ====================

  guardarLocal(producto) {
    const productos = JSON.parse(localStorage.getItem('pl_products') || '[]');
    const idx = productos.findIndex(p => p.id === producto.id);
    if (idx >= 0) productos[idx] = producto;
    else productos.push(producto);
    localStorage.setItem('pl_products', JSON.stringify(productos));
    this.productos = productos;
    this.setCache(productos);
    return { success: true, local: true };
  },

  eliminarLocal(id) {
    let productos = JSON.parse(localStorage.getItem('pl_products') || '[]');
    productos = productos.filter(p => p.id !== id);
    localStorage.setItem('pl_products', JSON.stringify(productos));
    this.productos = productos;
    this.setCache(productos);
    return { success: true, local: true };
  },

  // ==================== PEDIDOS (para checkout) ====================

  async crearPedido(orderData) {
    if (!this.appsScriptUrl) return this.crearPedidoLocal(orderData);

    try {
      return await this.postToAppsScript('create_order', { order: orderData });
    } catch (error) {
      console.error('[Sheets] Error creando pedido:', error);
      return this.crearPedidoLocal(orderData);
    }
  },

  crearPedidoLocal(orderData) {
    const orders = JSON.parse(localStorage.getItem('pl_orders') || '[]');
    orderData.id = orderData.id || 'ord_' + Date.now();
    orderData.fecha = new Date().toISOString();
    orders.push(orderData);
    localStorage.setItem('pl_orders', JSON.stringify(orders));
    return { success: true, local: true };
  },

  // ==================== CONFIG (sincronía settings) ====================

  async obtenerConfig() {
    if (!this.appsScriptUrl) return this.obtenerConfigLocal();

    try {
      return await this.fetchFromAppsScript('config');
    } catch (e) {
      return this.obtenerConfigLocal();
    }
  },

  obtenerConfigLocal() {
    return JSON.parse(localStorage.getItem('pl_config') || '{}');
  },

  async guardarConfig(config) {
    if (!this.appsScriptUrl) return this.guardarConfigLocal(config);

    try {
      return await this.postToAppsScript('save_config', { config });
    } catch (e) {
      return this.guardarConfigLocal(config);
    }
  },

  guardarConfigLocal(config) {
    localStorage.setItem('pl_config', JSON.stringify(config));
    return { success: true };
  },

  // ==================== UTILIDADES ====================

  // Forzar recarga completa (útil después de cambios en admin)
  async refrescarTodo() {
    this.invalidateCache();
    await this.cargarProductos(true);
    this.cotizacionDolar = null;
    await this.obtenerCotizacion();
  },
};

// Auto-inicializar al cargar
document.addEventListener('DOMContentLoaded', () => SheetsService.init());