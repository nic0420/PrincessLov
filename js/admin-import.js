/* ============================================
   ADMIN IMPORT - Importación Excel/CSV
   ============================================ */

const AdminImport = {
  pendingData: null,

  init() {
    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('file-input');
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    });
  },

  handleFile(file) {
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    if (ext === 'csv') {
      reader.onload = (e) => {
        const text = e.target.result;
        const data = this.parseCSV(text);
        this.showPreview(data, file.name);
      };
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
          const mapped = this.mapExcelColumns(jsonData);
          this.showPreview(mapped, file.name);
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

  parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = this.parseCSVLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = this.parseCSVLine(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h.trim()] = (values[idx] || '').trim();
      });
      data.push(this.mapToProduct(obj));
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

  mapExcelColumns(rows) {
    return rows.map(row => {
      const normalized = {};
      Object.keys(row).forEach(key => {
        normalized[key.toLowerCase().trim().replace(/\s+/g, '')] = row[key];
      });

      return this.mapToProduct(normalized);
    });
  },

  mapToProduct(obj) {
    const get = (...keys) => {
      for (const k of keys) {
        const val = obj[k] || obj[k.toLowerCase()] || obj[k.toUpperCase()];
        if (val !== undefined && val !== '') return String(val).trim();
      }
      return '';
    };

    const id = get('ID', 'id', 'Id');
    const nombre = get('Nombre', 'nombre', 'Name', 'Producto', 'producto');
    const categoria = get('Categoria', 'categoria', 'Category', 'Categoria', 'Rubro');
    const subcategoria = get('Subcategoria', 'subcategoria', 'Subcategoria');
    const descripcion = get('Descripcion', 'descripcion', 'Description', 'Descripción');
    const precioUSD = parseFloat(get('PrecioUSD', 'preciousd', 'Precio', 'Price', 'CostoUSD')) || 0;
    const imagen = get('Imagen', 'imagen', 'Image', 'Foto', 'URL');
    const stock = parseInt(get('Stock', 'stock', 'Cantidad')) || 0;
    const activo = get('Activo', 'activo', 'Active', 'Visible').toUpperCase();
    const tags = get('Tags', 'tags', 'Etiquetas');

    return {
      id: id || AdminData.generateId(),
      nombre: nombre || 'Sin nombre',
      categoria: (categoria || '').toLowerCase().replace(/\s+/g, '-'),
      categoriaOriginal: categoria,
      subcategoria,
      descripcion,
      precioUSD,
      imagen,
      stock,
      activo: activo === '' || activo === 'TRUE' || activo === 'SI' || activo === '1' || activo === 'VERDADERO',
      tags: tags ? tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [],
    };
  },

  showPreview(data, filename) {
    if (!data || data.length === 0) {
      AdminApp.toast('El archivo no contiene datos válidos', 'error');
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
      <span style="font-size:0.85rem; color:var(--texto-secundario);">${data.length} registros en "${filename}"</span>
    `;

    head.innerHTML = `
      <tr>
        <th>ID</th><th>Nombre</th><th>Categoría</th><th>Precio USD</th><th>Stock</th><th>Activo</th>
      </tr>
    `;

    body.innerHTML = data.slice(0, 50).map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.nombre}</td>
        <td>${p.categoriaOriginal || p.categoria}</td>
        <td>${AdminData.formatUSD(p.precioUSD)}</td>
        <td>${p.stock}</td>
        <td><span class="badge ${p.activo ? 'badge-active' : 'badge-inactive'}">${p.activo ? 'Sí' : 'No'}</span></td>
      </tr>
    `).join('');

    if (data.length > 50) {
      body.innerHTML += `<tr><td colspan="6" style="text-align:center; color:var(--texto-secundario);">... y ${data.length - 50} registros más</td></tr>`;
    }

    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });
  },

  confirmImport() {
    if (!this.pendingData) return;

    const result = AdminData.importProducts(this.pendingData);
    AdminApp.toast(`Importación completa: ${result.added} nuevos, ${result.updated} actualizados`);

    this.pendingData = null;
    document.getElementById('import-preview-section').style.display = 'none';
    document.getElementById('file-input').value = '';
  },

  cancelImport() {
    this.pendingData = null;
    document.getElementById('import-preview-section').style.display = 'none';
    document.getElementById('file-input').value = '';
  },

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
