/* ============================================
   ADMIN IMPORT - Importación Excel/CSV
   Adaptado al formato real del Excel de PrincessLov
   ============================================ */

const AdminImport = {
  pendingData: null,
  workbook: null,

  init() {
    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('file-input');
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) this.handleFile(e.dataTransfer.files[0]);
    });
  },

  // ==========================================
  // DETECCIÓN AUTOMÁTICA DE COLUMNAS
  // ==========================================

  /**
   * Detecta el mapeo de columnas basado en los headers reales del Excel.
   * Soporta múltiples formatos.
   */
  detectColumns(headers) {
    const map = {};
    headers.forEach((h, i) => {
      const lower = (h || '').toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
        .replace(/[^a-z0-9]/g, ''); // quitar espacios y符号

      // Producto / Nombre
      if (/^(producto|nombre|name|articulo|modelo|descripcion)$/i.test(lower)) {
        map.producto = i;
      }
      // Cantidad / Stock
      if (/^(cantidad|stock|unidades|uds|cant)$/i.test(lower)) {
        map.cantidad = i;
      }
      // Costo Unitario
      if (/^(costounitario|costouni|costo unitario|preciounitario|preciocosto|costo)$/i.test(lower)) {
        map.costoUnitario = i;
      }
      // Total
      if (/^(total|subtotal|montototal)$/i.test(lower)) {
        map.total = i;
      }
      // Observaciones
      if (/^(observaciones|obs|notas|comments|detalle)$/i.test(lower)) {
        map.observaciones = i;
      }
      // Dólar / Precio USD
      if (/^(dolar|dollar|usd|preciousd|precio|price|costousd)$/i.test(lower)) {
        map.precioUSD = i;
      }
      // Categoría
      if (/^(categoria|category|rubro|grupo|tipo)$/i.test(lower)) {
        map.categoria = i;
      }
      // Subcategoría
      if (/^(subcategoria|subcategory|subrubro)$/i.test(lower)) {
        map.subcategoria = i;
      }
      // Descripción
      if (/^(descripcion|description|desc|detalle)$/i.test(lower)) {
        map.descripcion = i;
      }
      // Imagen / Foto
      if (/^(imagen|image|foto|photo|url|img)$/i.test(lower)) {
        map.imagen = i;
      }
      // ID
      if (/^(id|codigo|cod|sku|reference)$/i.test(lower)) {
        map.id = i;
      }
      // Tags
      if (/^(tags|etiquetas|labels)$/i.test(lower)) {
        map.tags = i;
      }
      // Activo
      if (/^(activo|active|visible|habilitado)$/i.test(lower)) {
        map.activo = i;
      }
    });

    return map;
  },

  /**
   * Parsea el valor de observaciones para extraer el costo extra en USD.
   * Ejemplos: "EL COSTO +0,50USD" → 0.50, "EL COSTO +1USD" → 1.00
   */
  parseObservaciones(obs) {
    if (!obs) return 0;
    const str = String(obs).toUpperCase();
    // Buscar patrón "+XUSD" o "+X USD"
    const match = str.match(/\+\s*(\d+[.,]?\d*)\s*USD/);
    if (match) {
      return parseFloat(match[1].replace(',', '.')) || 0;
    }
    return 0;
  },

  /**
   * Auto-detecta categoría basado en el nombre del producto
   */
  detectCategoria(nombre) {
    const n = (nombre || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (/calza\s*larga/.test(n)) return { cat: 'calzas-largas', catOrig: 'Calzas Largas' };
    if (/calza\s*corta/.test(n)) return { cat: 'calzas-cortas', catOrig: 'Calzas Cortas' };
    if (/calza/.test(n)) return { cat: 'calzas', catOrig: 'Calzas' };
    if (/catsuit/.test(n)) return { cat: 'catsuits', catOrig: 'Catsuits' };
    if (/top\s*deportiv/.test(n) || /top\s*c/.test(n)) return { cat: 'conjuntos', catOrig: 'Conjuntos' };
    if (/conjunto/.test(n)) return { cat: 'conjuntos', catOrig: 'Conjuntos' };
    if (/campera/.test(n)) return { cat: 'buzos', catOrig: 'Buzos' };
    if (/buzo/.test(n)) return { cat: 'buzos', catOrig: 'Buzos' };
    if (/remera/.test(n)) return { cat: 'remeras', catOrig: 'Remeras' };
    if (/pijama/.test(n)) return { cat: 'pijamas', catOrig: 'Pijamas' };
    if (/short|bermuda/.test(n)) return { cat: 'calzas-cortas', catOrig: 'Calzas Cortas' };

    return { cat: 'otros', catOrig: 'Otros' };
  },

  // ==========================================
  // LECTURA DEL ARCHIVO
  // ==========================================

  handleFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = this.parseCSV(e.target.result);
        this.showPreview(data, file.name);
      };
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          this.workbook = XLSX.read(data, { type: 'array' });

          // Si hay múltiples hojas, mostrar selector
          if (this.workbook.SheetNames.length > 1) {
            this.showSheetSelector(this.workbook.SheetNames, file.name);
          } else {
            this.processSheet(this.workbook.SheetNames[0], file.name);
          }
        } catch (err) {
          AdminApp.toast('Error al leer el archivo Excel', 'error');
          console.error(err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      AdminApp.toast('Formato no soportado. Usá .xlsx, .xls o .csv', 'error');
    }
  },

  showSheetSelector(sheetNames, filename) {
    const preview = document.getElementById('import-preview-section');
    const head = document.getElementById('import-preview-head');
    const body = document.getElementById('import-preview-body');
    const stats = document.getElementById('import-stats');

    head.innerHTML = '';
    stats.innerHTML = `<span style="font-size:0.85rem; color:var(--texto-secundario);">El archivo tiene ${sheetNames.length} hojas. Seleccioná cuál importar:</span>`;

    body.innerHTML = sheetNames.map(name => `
      <tr style="cursor:pointer;" onclick="AdminImport.processSheet('${name.replace(/'/g, "\\'")}', '${filename}')">
        <td style="font-weight:600; font-size:1rem; padding:1rem;">📄 ${name}</td>
      </tr>
    `).join('');

    preview.style.display = 'block';
    preview.scrollIntoView({ behavior: 'smooth' });
  },

  processSheet(sheetName, filename) {
    if (!this.workbook) return;

    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) {
      AdminApp.toast('No se pudo leer la hoja: ' + sheetName, 'error');
      return;
    }

    // Leer como array para preservar el orden de columnas
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rawData.length < 2) {
      AdminApp.toast('La hoja está vacía o no tiene datos', 'error');
      return;
    }

    // Buscar la fila de headers (buscar "Producto" o "Nombre" en las primeras 5 filas)
    let headerRow = 0;
    for (let i = 0; i < Math.min(5, rawData.length); i++) {
      const rowStr = rawData[i].join(' ').toLowerCase();
      if (/producto|nombre|name|articulo/.test(rowStr)) {
        headerRow = i;
        break;
      }
    }

    const headers = rawData[headerRow];
    const colMap = this.detectColumns(headers);

    // Procesar filas de datos
    const products = [];
    for (let i = headerRow + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const nombre = colMap.producto !== undefined ? String(row[colMap.producto] || '').trim() : '';
      if (!nombre || nombre === '' || /^[\s\-*$]+$/.test(nombre)) continue;

      const cantidad = colMap.cantidad !== undefined ? parseInt(row[colMap.cantidad]) || 0 : 0;
      const costoUnit = colMap.costoUnitario !== undefined ? this.parseNumber(row[colMap.costoUnitario]) : 0;
      const total = colMap.total !== undefined ? this.parseNumber(row[colMap.total]) : 0;
      const obs = colMap.observaciones !== undefined ? String(row[colMap.observaciones] || '') : '';
      const precioUSD = colMap.precioUSD !== undefined ? this.parseNumber(row[colMap.precioUSD]) : 0;
      const categoriaExcel = colMap.categoria !== undefined ? String(row[colMap.categoria] || '').trim() : '';
      const subcategoria = colMap.subcategoria !== undefined ? String(row[colMap.subcategoria] || '').trim() : '';
      const descripcion = colMap.descripcion !== undefined ? String(row[colMap.descripcion] || '').trim() : '';
      const imagen = colMap.imagen !== undefined ? String(row[colMap.imagen] || '').trim() : '';
      const idExcel = colMap.id !== undefined ? String(row[colMap.id] || '').trim() : '';
      const tags = colMap.tags !== undefined ? String(row[colMap.tags] || '').trim() : '';
      const activo = colMap.activo !== undefined ? String(row[colMap.activo] || '').trim().toUpperCase() : '';

      // Calcular precio USD final: precio base + costo extra de observaciones
      const costoExtraUSD = this.parseObservaciones(obs);
      const precioUSDFinal = precioUSD + costoExtraUSD;

      // Si no hay precio USD pero hay costo unitario en ARS, calcular
      let precioUSDCalculado = precioUSDFinal;
      if (precioUSDCalculado === 0 && costoUnit > 0 && AdminApp.dolarRate > 0) {
        precioUSDCalculado = Math.round((costoUnit / AdminApp.dolarRate) * 100) / 100;
      }

      // Auto-detectar categoría si no viene en el Excel
      const catDetect = this.detectCategoria(nombre);
      const categoria = categoriaExcel || catDetect.cat;
      const categoriaOriginal = categoriaExcel || catDetect.catOrig;

      // Generar ID único basado en el nombre
      const id = idExcel || this.slugify(nombre) || AdminData.generateId();

      products.push({
        id,
        nombre,
        categoria: categoria.toLowerCase().replace(/\s+/g, '-'),
        categoriaOriginal,
        subcategoria: subcategoria || '',
        descripcion: descripcion || obs || '',
        precioUSD: Math.round(precioUSDCalculado * 100) / 100,
        costoUnitarioARS: costoUnit,
        imagen: imagen || '',
        stock: cantidad,
        activo: activo === '' || activo === 'TRUE' || activo === 'SI' || activo === '1' || activo === 'VERDADERO' || cantidad > 0,
        tags: tags ? tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [],
        observaciones: obs,
        excelSheet: sheetName,
      });
    }

    this.showPreview(products, filename + ' → ' + sheetName);
  },

  parseNumber(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let str = String(val).trim();
    // Quitar símbolo de moneda y espacios
    str = str.replace(/[$\s]/g, '');
    // Reemplazar coma por punto (formato argentino)
    str = str.replace(/\.(?=\d{3})/g, ''); // quitar separador de miles
    str = str.replace(',', '.');
    return parseFloat(str) || 0;
  },

  slugify(text) {
    return (text || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
  },

  parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = this.parseCSVLine(lines[0]);
    const colMap = this.detectColumns(headers);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = this.parseCSVLine(lines[i]);
      const nombre = colMap.producto !== undefined ? (values[colMap.producto] || '').trim() : '';
      if (!nombre) continue;

      const cantidad = colMap.cantidad !== undefined ? parseInt(values[colMap.cantidad]) || 0 : 0;
      const precioUSD = colMap.precioUSD !== undefined ? this.parseNumber(values[colMap.precioUSD]) : 0;
      const obs = colMap.observaciones !== undefined ? (values[colMap.observaciones] || '').trim() : '';
      const costoExtraUSD = this.parseObservaciones(obs);

      const catDetect = this.detectCategoria(nombre);

      data.push({
        id: this.slugify(nombre) || AdminData.generateId(),
        nombre,
        categoria: catDetect.cat,
        categoriaOriginal: catDetect.catOrig,
        subcategoria: '',
        descripcion: obs,
        precioUSD: Math.round((precioUSD + costoExtraUSD) * 100) / 100,
        imagen: '',
        stock: cantidad,
        activo: cantidad > 0,
        tags: [],
        observaciones: obs,
      });
    }
    return data;
  },

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += char; }
    }
    result.push(current);
    return result;
  },

  // ==========================================
  // VISTA PREVIA
  // ==========================================

  showPreview(data, filename) {
    if (!data || data.length === 0) {
      AdminApp.toast('No se encontraron productos válidos en el archivo', 'error');
      return;
    }

    this.pendingData = data;

    const section = document.getElementById('import-preview-section');
    const head = document.getElementById('import-preview-head');
    const body = document.getElementById('import-preview-body');
    const stats = document.getElementById('import-stats');

    const existing = AdminData.getProducts();
    const existingIds = new Set(existing.map(p => p.id));
    let newCount = 0, updateCount = 0;
    data.forEach(p => {
      if (existingIds.has(p.id)) updateCount++;
      else newCount++;
    });

    stats.innerHTML = `
      <span class="badge badge-active">${newCount} nuevos</span>
      <span class="badge" style="background:#F59E0B;color:white;">${updateCount} a actualizar</span>
      <span style="font-size:0.85rem; color:var(--texto-secundario);">${data.length} productos en "${filename}"</span>
    `;

    head.innerHTML = `
      <tr>
        <th>Producto</th>
        <th>Categoría</th>
        <th>Precio USD</th>
        <th>Stock</th>
        <th>Observaciones</th>
        <th>Estado</th>
      </tr>
    `;

    body.innerHTML = data.slice(0, 100).map(p => `
      <tr>
        <td><strong>${p.nombre}</strong></td>
        <td>${p.categoriaOriginal || p.categoria}</td>
        <td>${AdminData.formatUSD(p.precioUSD)}</td>
        <td>${p.stock}</td>
        <td style="font-size:0.8rem; color:var(--texto-secundario);">${p.observaciones || '-'}</td>
        <td><span class="badge ${p.activo ? 'badge-active' : 'badge-inactive'}">${p.activo ? 'Activo' : 'Inactivo'}</span></td>
      </tr>
    `).join('');

    if (data.length > 100) {
      body.innerHTML += `<tr><td colspan="6" style="text-align:center; color:var(--texto-secundario); padding:1rem;">... y ${data.length - 100} productos más</td></tr>`;
    }

    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });
  },

  // ==========================================
  // CONFIRMAR / CANCELAR IMPORTACIÓN
  // ==========================================

  confirmImport() {
    if (!this.pendingData) return;

    const result = AdminData.importProducts(this.pendingData);
    AdminApp.toast(`Importación completa: ${result.added} nuevos, ${result.updated} actualizados, ${result.total} total`);

    this.pendingData = null;
    this.workbook = null;
    document.getElementById('import-preview-section').style.display = 'none';
    document.getElementById('file-input').value = '';
  },

  cancelImport() {
    this.pendingData = null;
    this.workbook = null;
    document.getElementById('import-preview-section').style.display = 'none';
    document.getElementById('file-input').value = '';
  },

  // ==========================================
  // EXPORTAR
  // ==========================================

  exportProductsCSV() {
    AdminProducts.exportCSV();
  },

  exportProductsXLSX() {
    const products = AdminData.getProducts();
    if (products.length === 0) {
      AdminApp.toast('No hay productos para exportar', 'error');
      return;
    }

    const data = products.map(p => ({
      ID: p.id,
      Nombre: p.nombre,
      Categoria: p.categoriaOriginal || p.categoria,
      Subcategoria: p.subcategoria || '',
      Descripcion: p.descripcion || '',
      PrecioUSD: p.precioUSD,
      Imagen: p.imagen || '',
      Stock: p.stock,
      Activo: p.activo ? 'TRUE' : 'FALSE',
      Tags: (p.tags || []).join(', '),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'productos_princesslov.xlsx');
    AdminApp.toast('Excel exportado');
  },
};

document.addEventListener('DOMContentLoaded', () => AdminImport.init());
