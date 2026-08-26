/* ============================================
   SHEETS SERVICE - Google Sheets como Backend
   ============================================ */

const SheetsService = {
  productos: [],
  cotizacionDolar: null,
  lastFetch: null,

  /**
   * Parsea un CSV string a un array de objetos
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

  /**
   * Parsea una línea CSV respetando comillas
   */
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
   * Carga productos desde Google Sheets
   */
  async cargarProductos() {
    try {
      const url = CONFIG.sheets.url;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error al cargar sheet: ${response.status}`);
      }

      const csvText = await response.text();
      const rawData = this.parseCSV(csvText);

      this.productos = rawData
        .filter(p => p['Activo'] && p['Activo'].toUpperCase() === 'TRUE')
        .map(p => ({
          id: p['ID'] || this.generarId(),
          nombre: p['Nombre'] || 'Sin nombre',
          categoria: (p['Categoria'] || '').toLowerCase().replace(/\s+/g, '-'),
          categoriaOriginal: p['Categoria'] || '',
          subcategoria: p['Subcategoria'] || '',
          descripcion: p['Descripcion'] || '',
          precioUSD: parseFloat(p['PrecioUSD']) || 0,
          imagen: p['Imagen'] || CONFIG.imagenes.placeholder,
          stock: parseInt(p['Stock']) || 0,
          tags: p['Tags'] ? p['Tags'].split(',').map(t => t.trim().toLowerCase()) : [],
          activo: true,
        }));

      this.lastFetch = new Date();
      console.log(`[Sheets] ${this.productos.length} productos cargados`);
      return this.productos;

    } catch (error) {
      console.error('[Sheets] Error cargando productos:', error);
      return this.cargarFallback();
    }
  },

  /**
   * Carga datos de ejemplo si falla Google Sheets
   */
  cargarFallback() {
    console.log('[Sheets] Usando datos de ejemplo del CSV local');
    return fetch('data/productos.csv')
      .then(r => r.text())
      .then(csv => {
        const rawData = this.parseCSV(csv);
        this.productos = rawData
          .filter(p => p['Activo'] && p['Activo'].toUpperCase() === 'TRUE')
          .map(p => ({
            id: p['ID'] || this.generarId(),
            nombre: p['Nombre'] || 'Sin nombre',
            categoria: (p['Categoria'] || '').toLowerCase().replace(/\s+/g, '-'),
            categoriaOriginal: p['Categoria'] || '',
            subcategoria: p['Subcategoria'] || '',
            descripcion: p['Descripcion'] || '',
            precioUSD: parseFloat(p['PrecioUSD']) || 0,
            imagen: p['Imagen'] || CONFIG.imagenes.placeholder,
            stock: parseInt(p['Stock']) || 0,
            tags: p['Tags'] ? p['Tags'].split(',').map(t => t.trim().toLowerCase()) : [],
            activo: true,
          }));
        return this.productos;
      })
      .catch(() => {
        this.productos = [];
        return [];
      });
  },

  /**
   * Obtiene la cotización del dólar
   */
  async obtenerCotizacion() {
    if (!CONFIG.cotizacion.autoCotizacion) {
      this.cotizacionDolar = CONFIG.cotizacion.cotizacionManual;
      return this.cotizacionDolar;
    }

    try {
      const response = await fetch(CONFIG.sheets.dolarUrl);
      const data = await response.json();
      // La API de CriptoYa devuelve { oficial: { ask: ... }, ... }
      this.cotizacionDolar = data.oficial?.ask || data.blue?.ask || CONFIG.cotizacion.cotizacionManual;
      console.log(`[Dólar] Cotización: $${this.cotizacionDolar}`);
      return this.cotizacionDolar;
    } catch (error) {
      console.warn('[Dólar] Error obteniendo cotización, usando manual:', error);
      this.cotizacionDolar = CONFIG.cotizacion.cotizacionManual;
      return this.cotizacionDolar;
    }
  },

  /**
   * Calcula el precio en ARS de un producto
   */
  calcularPrecioARS(precioUSD) {
    if (!this.cotizacionDolar) {
      this.cotizacionDolar = CONFIG.cotizacion.cotizacionManual;
    }
    const precio = precioUSD * this.cotizacionDolar * CONFIG.cotizacion.margenGanancia;
    return Math.round(precio);
  },

  /**
   * Formatea precio en ARS
   */
  formatPrecioARS(precio) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(precio);
  },

  /**
   * Genera un ID único
   */
  generarId() {
    return 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  /**
   * Busca productos por texto
   */
  buscarProductos(texto) {
    const query = texto.toLowerCase();
    return this.productos.filter(p =>
      p.nombre.toLowerCase().includes(query) ||
      p.categoriaOriginal.toLowerCase().includes(query) ||
      p.descripcion.toLowerCase().includes(query) ||
      p.tags.some(t => t.includes(query))
    );
  },

  /**
   * Filtra productos por categoría
   */
  filtrarPorCategoria(categoriaId) {
    if (categoriaId === 'todos') return this.productos;
    return this.productos.filter(p => p.categoria === categoriaId);
  },

  /**
   * Obtiene producto por ID
   */
  obtenerProducto(id) {
    return this.productos.find(p => p.id === id);
  },

  /**
   * Obtiene categorías con conteo de productos
   */
  obtenerCategoriasConConteo() {
    const conteo = {};
    this.productos.forEach(p => {
      conteo[p.categoria] = (conteo[p.categoria] || 0) + 1;
    });

    return CONFIG.categorias.map(cat => ({
      ...cat,
      count: conteo[cat.id] || 0,
    })).filter(cat => cat.id === 'todos' || cat.count > 0);
  },
};
