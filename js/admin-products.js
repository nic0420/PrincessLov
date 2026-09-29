/* ============================================
   ADMIN PRODUCTS - CRUD de Productos COMPLETO
   ============================================ */

const AdminProducts = {
  searchQuery: '',
  filterCategory: '',
  variantRowId: 0,
  galleryRowId: 0,
  specRowId: 0,
  currentEditId: null,
  images: [],
  _imageUploadInitialized: false,

  esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; },

  render() {
    this.populateCategories();
    this.initTabs();
    this.initImageUpload();
    this.renderTable();
  },

  populateCategories() {
    const select = document.getElementById('products-filter-cat');
    const formSelect = document.getElementById('pf-categoria');
    const cats = CONFIG.categorias.filter(c => c.id !== 'todos');

    [select, formSelect].forEach(sel => {
      if (!sel) return;
      const currentVal = sel.value;
      if (sel === select) {
        sel.innerHTML = '<option value="">Todas las categorías</option>';
      } else {
        sel.innerHTML = '<option value="">Seleccionar...</option>';
      }
      cats.forEach(c => {
        sel.innerHTML += `<option value="${c.id}">${c.icon} ${c.nombre}</option>`;
      });
      sel.value = currentVal;
    });
  },

  initTabs() {
    const tabs = document.querySelectorAll('#product-modal .form-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const tabId = tab.dataset.tab;
        document.querySelectorAll('.form-tab-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById('tab-' + tabId);
        if (panel) panel.classList.add('active');
      });
    });

    const imgInput = document.getElementById('pf-imagen');
    if (imgInput) {
      imgInput.addEventListener('input', () => this.updateImagePreview(imgInput.value));
    }
  },

  initImageUpload() {
    if (this._imageUploadInitialized) return;
    this._imageUploadInitialized = true;

    const zone = document.getElementById('pf-upload-zone');
    const fileInput = document.getElementById('pf-file-input');
    const urlInput = document.getElementById('pf-url-input');

    if (zone && fileInput) {
      zone.addEventListener('click', (e) => {
        if (e.target !== fileInput) {
          fileInput.click();
        }
      });

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
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleImageFiles(e.dataTransfer.files);
        }
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          this.handleImageFiles(fileInput.files);
          fileInput.value = '';
        }
      });
    }

    if (urlInput) {
      urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addImageFromUrlInput();
        }
      });
    }

    // Soporte para pegar imagen directa con Ctrl+V
    document.addEventListener('paste', (e) => {
      const modal = document.getElementById('product-modal');
      if (!modal || !modal.classList.contains('open')) return;

      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl.id !== 'pf-url-input') {
        if (!e.clipboardData || !e.clipboardData.files || e.clipboardData.files.length === 0) {
          return;
        }
      }

      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const imageFiles = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          e.preventDefault();
          const imgTab = document.querySelector('#product-modal .form-tab[data-tab="imagenes"]');
          if (imgTab && !imgTab.classList.contains('active')) imgTab.click();
          this.handleImageFiles(imageFiles);
          AdminApp.toast('Foto pegada desde el portapapeles');
        }
      }
    });

    this.updateDriveStatusBadge();
  },

  updateDriveStatusBadge() {
    const badge = document.getElementById('pf-drive-badge');
    const dot = document.getElementById('pf-drive-dot');
    const label = document.getElementById('pf-drive-label');
    if (!badge || !label) return;

    const hasAppsScript = typeof SheetsService !== 'undefined' && 
      SheetsService.appsScriptUrl && 
      !SheetsService.appsScriptUrl.includes('TU_SCRIPT_ID');

    if (hasAppsScript) {
      if (dot) dot.style.background = '#10B981';
      label.textContent = 'Google Drive conectado';
      badge.title = 'Las fotos que subas se guardarán automáticamente en tu Google Drive (carpeta PrincessLov_Imagenes)';
    } else {
      if (dot) dot.style.background = '#F43F5E';
      label.textContent = 'Almacenamiento: Local (WebP optimizado)';
      badge.title = 'Al conectar tu Apps Script, las fotos se subirán a tu Google Drive automáticamente. Por ahora se optimizan en formato WebP liviano.';
    }
  },

  compressImage(file, maxWidth = 1200, maxHeight = 1600, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        return reject(new Error('El archivo no es una imagen válida'));
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Error al decodificar la imagen'));
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          let outputType = 'image/webp';
          const testData = canvas.toDataURL('image/webp');
          if (!testData.startsWith('data:image/webp')) {
            outputType = 'image/jpeg';
          }

          const dataUrl = canvas.toDataURL(outputType, quality);
          const byteLength = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
          const sizeFormatted = byteLength < 1024 * 1024
            ? `${(byteLength / 1024).toFixed(0)} KB`
            : `${(byteLength / (1024 * 1024)).toFixed(1)} MB`;

          resolve({
            dataUrl,
            sizeFormatted,
            mimeType: outputType,
            width,
            height,
            name: file.name
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  async handleImageFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) {
      AdminApp.toast('Por favor seleccioná archivos de imagen válidos (JPG, PNG, WebP)', 'error');
      return;
    }

    const spinner = document.getElementById('pf-upload-spinner');
    const spinnerText = document.getElementById('pf-upload-spinner-text');
    if (spinner) spinner.style.display = 'flex';

    const hasAppsScript = typeof SheetsService !== 'undefined' && 
      SheetsService.appsScriptUrl && 
      !SheetsService.appsScriptUrl.includes('TU_SCRIPT_ID');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (spinnerText) {
        spinnerText.textContent = `Optimizando foto ${i + 1} de ${files.length}...`;
      }

      try {
        const compressed = await this.compressImage(file);
        const imageItem = {
          url: compressed.dataUrl,
          name: file.name,
          size: compressed.sizeFormatted,
          mimeType: compressed.mimeType,
          status: hasAppsScript ? 'uploading' : 'ready',
          isDrive: false
        };

        this.images.push(imageItem);
        this.renderImagesGrid();

        if (hasAppsScript) {
          if (spinnerText) spinnerText.textContent = `Guardando foto ${i + 1} en tu Google Drive...`;
          await this.uploadImageToAppsScript(imageItem);
        }
      } catch (err) {
        console.error('[AdminProducts] Error procesando imagen:', err);
        AdminApp.toast(`Error con ${file.name}: ${err.message}`, 'error');
      }
    }

    if (spinner) spinner.style.display = 'none';
    this.renderImagesGrid();
    AdminApp.toast(`${files.length === 1 ? 'Foto procesada' : files.length + ' fotos procesadas'} con éxito`);
  },

  async uploadImageToAppsScript(imgItem) {
    try {
      const res = await SheetsService.postToAppsScript('upload_image', {
        image: imgItem.url,
        filename: imgItem.name || `prod_${Date.now()}`,
        mimeType: imgItem.mimeType || 'image/jpeg'
      });

      if (res && res.url) {
        imgItem.url = res.url;
        imgItem.status = 'ready';
        imgItem.isDrive = true;
        this.renderImagesGrid();
      } else {
        imgItem.status = 'ready';
      }
    } catch (err) {
      console.warn('[AdminProducts] No se pudo subir a Drive, se conserva versión optimizada:', err);
      imgItem.status = 'ready';
      this.renderImagesGrid();
    }
  },

  normalizeImageUrl(url) {
    if (!url) return '';
    let clean = url.trim();

    // Detección automática de enlaces compartidos de Google Drive:
    // https://drive.google.com/file/d/1XyZ.../view?usp=sharing
    // https://drive.google.com/open?id=1XyZ...
    const gDriveMatch = clean.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                        clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (gDriveMatch && gDriveMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}`;
    }

    // Dropbox: dl=0 -> raw=1
    if (clean.includes('dropbox.com')) {
      return clean.replace(/[?&]dl=0/, '?raw=1').replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    }

    // Imgur página a link directo
    const imgurMatch = clean.match(/^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)$/);
    if (imgurMatch && imgurMatch[1]) {
      return `https://i.imgur.com/${imgurMatch[1]}.jpg`;
    }

    return clean;
  },

  addImageFromUrlInput() {
    const input = document.getElementById('pf-url-input');
    if (!input) return;
    const rawUrl = input.value.trim();
    if (!rawUrl) {
      AdminApp.toast('Por favor pegá una URL de imagen válida', 'error');
      return;
    }

    const normalized = this.normalizeImageUrl(rawUrl);
    const isDrive = normalized.includes('googleusercontent.com');

    this.images.push({
      url: normalized,
      name: isDrive ? 'Google Drive' : 'Enlace web',
      size: 'URL externa',
      status: 'ready',
      isDrive: isDrive
    });

    input.value = '';
    this.renderImagesGrid();
    AdminApp.toast('Foto agregada correctamente');
  },

  renderImagesGrid() {
    const countEl = document.getElementById('pf-images-count');
    const grid = document.getElementById('pf-images-grid');
    const mainInput = document.getElementById('pf-imagen');

    if (countEl) countEl.textContent = this.images.length;
    if (mainInput) mainInput.value = this.images[0]?.url || '';

    this.updateImagePreview(this.images[0]?.url || '');

    if (!grid) return;

    if (this.images.length === 0) {
      grid.innerHTML = `
        <div class="gallery-empty-state">
          <div style="font-size:2.2rem; margin-bottom:0.5rem;">🖼️</div>
          <div style="font-weight:600; color:var(--texto); margin-bottom:0.25rem;">No hay fotos cargadas aún</div>
          <div style="font-size:0.8rem; color:var(--texto-secundario);">Arrastrá fotos a la zona de arriba o hacé clic para seleccionar desde tu dispositivo.</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.images.map((img, idx) => {
      const isMain = idx === 0;
      const isDrive = img.isDrive || (img.url && img.url.includes('googleusercontent.com'));
      const isUploading = img.status === 'uploading';

      return `
        <div class="gallery-card ${isMain ? 'is-main' : ''}" data-idx="${idx}">
          <div class="gallery-card__thumb">
            <img src="${this.esc(img.url)}" alt="Foto ${idx + 1}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22130%22><rect width=%22100%22 height=%22130%22 fill=%22%23FEE2E2%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23DC2626%22 font-size=%2210%22>Error de carga</text></svg>'">
            ${isMain ? '<span class="gallery-badge-main">⭐ Principal</span>' : ''}
            ${isDrive ? '<span class="gallery-badge-drive" title="Guardada en Google Drive">☁️ Drive</span>' : ''}
            ${isUploading ? '<div class="gallery-card__uploading"><div class="spinner-sm"></div> <span>Subiendo...</span></div>' : ''}
          </div>
          <div class="gallery-card__footer">
            <div class="gallery-card__meta">
              <span title="${this.esc(img.name || '')}">${this.esc((img.name || 'Foto ' + (idx + 1)).slice(0, 14))}</span>
              <span>${this.esc(img.size || '')}</span>
            </div>
            <div class="gallery-card__btns">
              ${!isMain ? `<button type="button" class="btn-set-main" onclick="AdminProducts.makeImageMain(${idx})">⭐ Portada</button>` : '<span class="main-tag">Portada</span>'}
              <div style="display:flex; gap:2px;">
                ${idx > 0 ? `<button type="button" class="btn-gallery-nav" title="Mover izquierda" onclick="AdminProducts.moveImage(${idx}, -1)">◀</button>` : ''}
                ${idx < this.images.length - 1 ? `<button type="button" class="btn-gallery-nav" title="Mover derecha" onclick="AdminProducts.moveImage(${idx}, 1)">▶</button>` : ''}
                <button type="button" class="btn-gallery-del" title="Eliminar foto" onclick="AdminProducts.removeImage(${idx})">✕</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  makeImageMain(index) {
    if (index <= 0 || index >= this.images.length) return;
    const [item] = this.images.splice(index, 1);
    this.images.unshift(item);
    this.renderImagesGrid();
    AdminApp.toast('Foto seleccionada como principal ⭐');
  },

  moveImage(index, dir) {
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= this.images.length) return;
    const temp = this.images[index];
    this.images[index] = this.images[newIdx];
    this.images[newIdx] = temp;
    this.renderImagesGrid();
  },

  removeImage(index) {
    if (index < 0 || index >= this.images.length) return;
    this.images.splice(index, 1);
    this.renderImagesGrid();
    AdminApp.toast('Foto eliminada');
  },

  updateImagePreview(url) {
    const preview = document.getElementById('pf-imagen-preview');
    const img = document.getElementById('pf-imagen-preview-img');
    if (preview && img) {
      if (url && (url.startsWith('http') || url.startsWith('data:'))) {
        img.src = url;
        preview.style.display = 'block';
      } else {
        preview.style.display = 'none';
      }
    }
  },

  getFiltered() {
    let products = AdminData.getProducts();

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      products = products.filter(p =>
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.descripcion || '').toLowerCase().includes(q) ||
        (p.categoria || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q)
      );
    }

    if (this.filterCategory) {
      products = products.filter(p => p.categoria === this.filterCategory);
    }

    return products.sort((a, b) => new Date(b.fechaModificacion || 0) - new Date(a.fechaModificacion || 0));
  },

  renderTable() {
    const products = this.getFiltered();
    const tbody = document.getElementById('products-tbody');
    const empty = document.getElementById('products-empty');
    const table = document.getElementById('products-table');

    if (products.length === 0) {
      if (table) table.style.display = 'none';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (table) table.style.display = '';
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = products.map(p => {
      const precioARS = AdminApp.dolarRate ? (p.precioUSD * AdminApp.dolarRate * (CONFIG?.cotizacion?.margenGanancia || 1.3)) : 0;
      const stockClass = p.stock <= 0 ? 'badge-low-stock' : p.stock <= 5 ? 'badge-low-stock' : 'badge-active';
      const stockLabel = p.stock <= 0 ? 'Sin stock' : p.stock <= 5 ? `${p.stock} u.` : `${p.stock} u.`;
      const hasVariants = p.variantes && p.variantes.length > 0;
      const variantStock = hasVariants ? p.variantes.reduce((s, v) => s + (v.stock || 0), 0) : p.stock;

      return `
        <tr>
          <td>
            <img class="product-thumb" src="${this.esc(p.imagen || '')}" alt="${this.esc(p.nombre)}"
                 onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22><rect width=%2250%22 height=%2250%22 fill=%22%23F8D0DC%22/></svg>'">
          </td>
          <td>
            <div class="product-name-cell">
              <div class="product-name">${this.esc(p.nombre)}</div>
              ${p.sku ? `<div class="product-sku">SKU: ${this.esc(p.sku)}</div>` : ''}
            </div>
            ${p.tags && p.tags.includes('nuevo') ? ' <span class="badge badge-new">Nuevo</span>' : ''}
            ${p.tags && p.tags.includes('oferta') ? ' <span class="badge" style="background:#F59E0B;color:white;">Oferta</span>' : ''}
            ${p.destacado ? ' <span class="badge badge-active">⭐ Destacado</span>' : ''}
          </td>
          <td>${this.esc(p.categoriaOriginal || p.categoria || '-')}</td>
          <td>${AdminData.formatUSD(p.precioUSD)}</td>
          <td>${p.precioARSManual ? AdminData.formatARS(p.precioARSManual) : AdminData.formatARS(precioARS)}${p.precioOferta ? ` <span class="badge" style="background:#F59E0B;color:white;">Oferta: ${AdminData.formatARS(p.precioOferta)}</span>` : ''}</td>
          <td>
            ${hasVariants ? `
              <div style="display:flex; flex-direction:column; gap:2px;">
                <span class="badge ${variantStock <= 0 ? 'badge-low-stock' : variantStock <= 5 ? 'badge-low-stock' : 'badge-active'}">${variantStock} u. (variantes)</span>
                <small style="color:var(--texto-secundario);">${p.variantes.length} variantes</small>
              </div>
            ` : `<span class="badge ${stockClass}">${stockLabel}</span>`}
          </td>
          <td><span class="badge ${p.activo ? 'badge-active' : 'badge-inactive'}">${p.activo ? 'Activo' : 'Inactivo'}</span></td>
          <td>
            <div class="table-actions">
              <button class="btn btn-sm btn-secondary" onclick="AdminProducts.openForm('${p.id}')" title="Editar">✏️</button>
              <button class="btn btn-sm btn-danger" onclick="AdminProducts.delete('${p.id}')" title="Eliminar">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  search(query) {
    this.searchQuery = query;
    this.renderTable();
  },

  filterByCategory(cat) {
    this.filterCategory = cat;
    this.renderTable();
  },

  openForm(id) {
    this.currentEditId = id || null;
    this.populateCategories();
    this.resetForm();
    this.initDynamicSections();

    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');

    this.resetForm();

    if (id) {
      const p = AdminData.getProduct(id);
      if (!p) return;
      title.textContent = 'Editar Producto';
      this.fillForm(p);
    } else {
      title.textContent = 'Nuevo Producto';
    }

    // Reset to first tab
    document.querySelectorAll('.form-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    document.querySelectorAll('.form-tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('.form-tab[data-tab="basico"]').classList.add('active');
    document.querySelector('.form-tab[data-tab="basico"]').setAttribute('aria-selected', 'true');
    document.getElementById('tab-basico').classList.add('active');

    modal.classList.add('open');
  },

  resetForm() {
    const form = document.getElementById('product-form');
    if (form) form.reset();
    document.getElementById('pf-id').value = '';
    document.getElementById('pf-activo').checked = true;
    document.getElementById('pf-destacado').checked = false;
    document.getElementById('pf-solo-web').checked = false;
    document.getElementById('pf-stock').value = 0;
    document.getElementById('pf-stock-min').value = 5;
    
    // Clear dynamic sections
    document.getElementById('variantes-container').innerHTML = '';
    const gc = document.getElementById('gallery-container');
    if (gc) gc.innerHTML = '';
    document.getElementById('specs-container').innerHTML = '';
    
    this.variantRowId = 0;
    this.galleryRowId = 0;
    this.specRowId = 0;
    
    this.images = [];
    this.renderImagesGrid();
    this.updateDriveStatusBadge();
  },

  fillForm(p) {
    document.getElementById('pf-id').value = p.id;
    document.getElementById('pf-nombre').value = p.nombre || '';
    document.getElementById('pf-categoria').value = p.categoria || '';
    document.getElementById('pf-subcategoria').value = p.subcategoria || '';
    document.getElementById('pf-sku').value = p.sku || '';
    document.getElementById('pf-preciousd').value = p.precioUSD || 0;
    document.getElementById('pf-precio-ars-manual').value = p.precioARSManual || '';
    document.getElementById('pf-precio-oferta').value = p.precioOferta || '';
    document.getElementById('pf-margen-personalizado').value = p.margenPersonalizado || '';
    document.getElementById('pf-stock').value = p.stock || 0;
    document.getElementById('pf-stock-min').value = p.stockMin || 5;
    document.getElementById('pf-peso').value = p.peso || '';
    document.getElementById('pf-dimensiones').value = p.dimensiones || '';
    document.getElementById('pf-tags').value = (p.tags || []).join(', ');
    document.getElementById('pf-descripcion').value = p.descripcion || '';
    document.getElementById('pf-descripcion-corta').value = p.descripcionCorta || '';
    document.getElementById('pf-imagen').value = p.imagen || '';
    document.getElementById('pf-activo').checked = p.activo !== false;
    document.getElementById('pf-destacado').checked = p.destacado || false;
    document.getElementById('pf-solo-web').checked = p.soloWeb || false;
    document.getElementById('pf-seo-title').value = p.seoTitle || '';
    document.getElementById('pf-seo-desc').value = p.seoDesc || '';

    // Variantes
    const variantesContainer = document.getElementById('variantes-container');
    if (p.variantes && p.variantes.length > 0) {
      p.variantes.forEach(v => this.addVariantRow(v));
    }

    // Galería e Imágenes
    this.images = [];
    if (p.imagen) {
      const isDrive = p.imagen.includes('googleusercontent.com');
      this.images.push({
        url: p.imagen,
        name: 'Principal',
        size: isDrive ? 'Google Drive' : 'Guardada',
        status: 'ready',
        isDrive: isDrive
      });
    }
    if (p.galeria && Array.isArray(p.galeria)) {
      p.galeria.forEach((g, i) => {
        const u = typeof g === 'string' ? g : (g && g.url ? g.url : '');
        if (u) {
          const isDrive = u.includes('googleusercontent.com');
          this.images.push({
            url: u,
            name: `Foto ${i + 2}`,
            size: isDrive ? 'Google Drive' : 'Guardada',
            status: 'ready',
            isDrive: isDrive
          });
        }
      });
    }
    this.renderImagesGrid();
    this.updateDriveStatusBadge();

    // Características
    const specsContainer = document.getElementById('specs-container');
    if (p.caracteristicas && Object.keys(p.caracteristicas).length > 0) {
      Object.entries(p.caracteristicas).forEach(([key, value]) => this.addSpecRow({ key, value }));
    }
  },

  initDynamicSections() {
    // Add one empty row to each section for easy start
    // this.addVariantRow();
    // this.addGalleryRow();
    // this.addSpecRow();
  },

  // ========== VARIANTES ==========
  addVariantRow(variant = {}) {
    this.variantRowId++;
    const container = document.getElementById('variantes-container');
    const row = document.createElement('div');
    row.className = 'variant-row';
    row.dataset.id = this.variantRowId;
    row.innerHTML = `
      <div class="form-group">
        <label>Color *</label>
        <div style="display:flex; gap:0.5rem; align-items:end;">
          <input type="text" class="variant-color-name" placeholder="Nombre (ej: Borgoña)" value="${variant.color || ''}" style="flex:1;">
          <input type="color" class="variant-color-input" value="${variant.colorHex || '#800020'}">
        </div>
      </div>
      <div class="form-group">
        <label>Talle *</label>
        <input type="text" class="variant-talle" placeholder="Ej: S, M, L, XL / Único" value="${variant.talle || ''}">
      </div>
      <div class="form-group">
        <label>Stock</label>
        <input type="number" class="variant-stock" min="0" value="${variant.stock || 0}">
      </div>
      <button type="button" class="variant-remove" onclick="this.closest('.variant-row').remove()" title="Eliminar variante">✕</button>
    `;
    container.appendChild(row);
  },

  // ========== GALERÍA ==========
  addGalleryRow(image = {}) {
    const url = typeof image === 'string' ? image : (image && image.url ? image.url : '');
    if (url) {
      const normalized = this.normalizeImageUrl(url);
      const isDrive = normalized.includes('googleusercontent.com');
      this.images.push({
        url: normalized,
        name: 'Galería',
        size: isDrive ? 'Google Drive' : 'URL externa',
        status: 'ready',
        isDrive: isDrive
      });
      this.renderImagesGrid();
    }
  },

  // ========== CARACTERÍSTICAS ==========
  addSpecRow(spec = {}) {
    this.specRowId++;
    const container = document.getElementById('specs-container');
    const row = document.createElement('div');
    row.className = 'spec-row';
    row.dataset.id = this.specRowId;
    row.innerHTML = `
      <div class="form-group">
        <label>Característica (clave)</label>
        <input type="text" class="spec-key" placeholder="Ej: Material, Composición, Cuidado" value="${spec.key || ''}">
      </div>
      <div class="form-group">
        <label>Valor</label>
        <input type="text" class="spec-value" placeholder="Ej: 90% Poliéster 10% Elastano" value="${spec.value || ''}">
      </div>
      <button type="button" class="spec-remove" onclick="this.closest('.spec-row').remove()" title="Eliminar">✕</button>
    `;
    container.appendChild(row);
  },

  applySpecTemplate(type) {
    const templates = {
      deportivo: {
        'Material': '90% Poliéster 10% Elastano',
        'Tecnología': 'Dry-Fit / Secado rápido',
        'Cuidado': 'Lavar en frío, no planchar',
        'Uso': 'Entrenamiento, running, gym',
        'Origen': 'Nacional'
      },
      pijama: {
        'Material': '100% Algodón peinado',
        'Tela': 'Suave, transpirable, hipoalergénico',
        'Cuidado': 'Lavar en frío, secar a la sombra',
        'Temporada': 'Todo el año',
        'Origen': 'Nacional'
      },
      lenceria: {
        'Material': 'Encaje elástico + Microfibra',
        'Composición': '85% Poliamida 15% Elastano',
        'Cuidado': 'Lavar a mano, no centrifugar',
        'Copa': 'Sin aro / Con aro según modelo',
        'Origen': 'Nacional'
      },
      generico: {
        'Material': '',
        'Composición': '',
        'Cuidado': '',
        'Talle': '',
        'Color': ''
      }
    };

    const template = templates[type];
    if (!template) return;

    const container = document.getElementById('specs-container');
    container.innerHTML = '';
    Object.entries(template).forEach(([key, value]) => this.addSpecRow({ key, value }));
  },

  // ========== GUARDAR ==========
  save(event) {
    event.preventDefault();

    const id = document.getElementById('pf-id').value;
    const catId = document.getElementById('pf-categoria').value;
    const catConfig = CONFIG.categorias.find(c => c.id === catId);

    // Validar al menos una imagen
    if (!this.images || this.images.length === 0) {
      AdminApp.toast('Por favor agregá al menos una foto para el producto', 'error');
      const imgTab = document.querySelector('#product-modal .form-tab[data-tab="imagenes"]');
      if (imgTab) imgTab.click();
      return;
    }

    // Collect variants
    const variantes = [];
    document.querySelectorAll('.variant-row').forEach(row => {
      const color = row.querySelector('.variant-color-name')?.value?.trim();
      const colorHex = row.querySelector('.variant-color-input')?.value;
      const talle = row.querySelector('.variant-talle')?.value?.trim();
      const stock = parseInt(row.querySelector('.variant-stock')?.value) || 0;
      if (color && talle) {
        variantes.push({ color, colorHex, talle, stock });
      }
    });

    // Collect gallery (fotos secundarias)
    const galeria = this.images.slice(1).map(img => ({ url: img.url }));

    // Collect specs
    const caracteristicas = {};
    document.querySelectorAll('.spec-row').forEach(row => {
      const key = row.querySelector('.spec-key')?.value?.trim();
      const value = row.querySelector('.spec-value')?.value?.trim();
      if (key && value) caracteristicas[key] = value;
    });

    const data = {
      nombre: document.getElementById('pf-nombre').value.trim(),
      categoria: catId,
      categoriaOriginal: catConfig ? catConfig.nombre : catId,
      subcategoria: document.getElementById('pf-subcategoria').value.trim(),
      sku: document.getElementById('pf-sku').value.trim(),
      precioUSD: parseFloat(document.getElementById('pf-preciousd').value) || 0,
      precioARSManual: document.getElementById('pf-precio-ars-manual').value ? parseFloat(document.getElementById('pf-precio-ars-manual').value) : null,
      precioOferta: document.getElementById('pf-precio-oferta').value ? parseFloat(document.getElementById('pf-precio-oferta').value) : null,
      margenPersonalizado: document.getElementById('pf-margen-personalizado').value ? parseFloat(document.getElementById('pf-margen-personalizado').value) / 100 : null,
      stock: parseInt(document.getElementById('pf-stock').value) || 0,
      stockMin: parseInt(document.getElementById('pf-stock-min').value) || 5,
      peso: parseInt(document.getElementById('pf-peso').value) || null,
      dimensiones: document.getElementById('pf-dimensiones').value.trim(),
      tags: document.getElementById('pf-tags').value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
      descripcion: document.getElementById('pf-descripcion').value.trim(),
      descripcionCorta: document.getElementById('pf-descripcion-corta').value.trim(),
      imagen: this.images[0].url,
      activo: document.getElementById('pf-activo').checked,
      destacado: document.getElementById('pf-destacado').checked,
      soloWeb: document.getElementById('pf-solo-web').checked,
      seoTitle: document.getElementById('pf-seo-title').value.trim(),
      seoDesc: document.getElementById('pf-seo-desc').value.trim(),
      variantes,
      galeria,
      caracteristicas,
    };

    if (id) {
      AdminData.updateProduct(id, data);
      AdminApp.toast('Producto actualizado correctamente');
    } else {
      AdminData.addProduct(data);
      AdminApp.toast('Producto creado correctamente');
    }

    this.closeForm();
    this.renderTable();
  },

  closeForm() {
    document.getElementById('product-modal').classList.remove('open');
    this.resetForm();
  },

  delete(id) {
    const p = AdminData.getProduct(id);
    if (!p) return;
    if (confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) {
      AdminData.deleteProduct(id);
      AdminApp.toast('Producto eliminado');
      this.renderTable();
    }
  },

  exportCSV() {
    const products = AdminData.getProducts();
    if (products.length === 0) {
      AdminApp.toast('No hay productos para exportar', 'error');
      return;
    }

    const headers = ['ID', 'Nombre', 'Categoria', 'Subcategoria', 'SKU', 'Descripcion', 'DescripcionCorta', 'PrecioUSD', 'PrecioARSManual', 'PrecioOferta', 'MargenPersonalizado', 'Stock', 'StockMin', 'Peso', 'Dimensiones', 'Imagen', 'Galeria', 'Variantes', 'Caracteristicas', 'Tags', 'Activo', 'Destacado', 'SoloWeb', 'SEOTitle', 'SEODesc'];
    const rows = products.map(p => {
      const galeriaStr = (p.galeria || []).map(g => g.url).join(' | ');
      const variantesStr = (p.variantes || []).map(v => `${v.color}(${v.colorHex})/${v.talle}:${v.stock}`).join(' | ');
      const specsStr = Object.entries(p.caracteristicas || {}).map(([k, v]) => `${k}:${v}`).join(' | ');
      return [
        p.id, p.nombre, p.categoriaOriginal || p.categoria, p.subcategoria, p.sku,
        p.descripcion, p.descripcionCorta, p.precioUSD,
        p.precioARSManual || '', p.precioOferta || '',
        p.margenPersonalizado ? (p.margenPersonalizado * 100) : '',
        p.stock, p.stockMin || 5, p.peso || '', p.dimensiones || '',
        p.imagen, galeriaStr, variantesStr, specsStr,
        (p.tags || []).join(', '),
        p.activo ? 'TRUE' : 'FALSE',
        p.destacado ? 'TRUE' : 'FALSE',
        p.soloWeb ? 'TRUE' : 'FALSE',
        p.seoTitle || '', p.seoDesc || ''
      ];
    });

    let csv = headers.join(',') + '\n';
    rows.forEach(r => {
      csv += r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',') + '\n';
    });

    this.downloadFile(csv, 'productos_princesslov_completo.csv', 'text/csv');
    AdminApp.toast('CSV completo exportado');
  },

  downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};