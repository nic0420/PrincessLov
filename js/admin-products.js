/* ============================================
   ADMIN PRODUCTS - CRUD de Productos
   ============================================ */

const AdminProducts = {
  searchQuery: '',
  filterCategory: '',

  render() {
    this.populateCategories();
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

  getFiltered() {
    let products = AdminData.getProducts();

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      products = products.filter(p =>
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.descripcion || '').toLowerCase().includes(q) ||
        (p.categoria || '').toLowerCase().includes(q)
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

      return `
        <tr>
          <td>
            <img class="product-thumb" src="${p.imagen || ''}" alt="${p.nombre}"
                 onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22><rect width=%2250%22 height=%2250%22 fill=%22%23F8D0DC%22/></svg>'">
          </td>
          <td>
            <strong>${p.nombre}</strong>
            ${p.tags && p.tags.includes('nuevo') ? ' <span class="badge badge-new">Nuevo</span>' : ''}
            ${p.tags && p.tags.includes('oferta') ? ' <span class="badge" style="background:#F59E0B;color:white;">Oferta</span>' : ''}
          </td>
          <td>${p.categoriaOriginal || p.categoria || '-'}</td>
          <td>${AdminData.formatUSD(p.precioUSD)}</td>
          <td>${AdminData.formatARS(precioARS)}</td>
          <td><span class="badge ${stockClass}">${stockLabel}</span></td>
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
    this.populateCategories();
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');

    if (id) {
      const p = AdminData.getProduct(id);
      if (!p) return;
      title.textContent = 'Editar Producto';
      document.getElementById('pf-id').value = p.id;
      document.getElementById('pf-nombre').value = p.nombre || '';
      document.getElementById('pf-categoria').value = p.categoria || '';
      document.getElementById('pf-subcategoria').value = p.subcategoria || '';
      document.getElementById('pf-preciousd').value = p.precioUSD || '';
      document.getElementById('pf-stock').value = p.stock || 0;
      document.getElementById('pf-tags').value = (p.tags || []).join(', ');
      document.getElementById('pf-descripcion').value = p.descripcion || '';
      document.getElementById('pf-imagen').value = p.imagen || '';
      document.getElementById('pf-activo').checked = p.activo !== false;
    } else {
      title.textContent = 'Nuevo Producto';
      document.getElementById('product-form').reset();
      document.getElementById('pf-id').value = '';
      document.getElementById('pf-activo').checked = true;
    }

    modal.classList.add('open');
  },

  closeForm() {
    document.getElementById('product-modal').classList.remove('open');
  },

  save(event) {
    event.preventDefault();

    const id = document.getElementById('pf-id').value;
    const catId = document.getElementById('pf-categoria').value;
    const catConfig = CONFIG.categorias.find(c => c.id === catId);

    const data = {
      nombre: document.getElementById('pf-nombre').value.trim(),
      categoria: catId,
      categoriaOriginal: catConfig ? catConfig.nombre : catId,
      subcategoria: document.getElementById('pf-subcategoria').value.trim(),
      precioUSD: parseFloat(document.getElementById('pf-preciousd').value) || 0,
      stock: parseInt(document.getElementById('pf-stock').value) || 0,
      tags: document.getElementById('pf-tags').value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
      descripcion: document.getElementById('pf-descripcion').value.trim(),
      imagen: document.getElementById('pf-imagen').value.trim(),
      activo: document.getElementById('pf-activo').checked,
    };

    if (id) {
      AdminData.updateProduct(id, data);
      AdminApp.toast('Producto actualizado');
    } else {
      AdminData.addProduct(data);
      AdminApp.toast('Producto creado');
    }

    this.closeForm();
    this.renderTable();
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

    const headers = ['ID', 'Nombre', 'Categoria', 'Subcategoria', 'Descripcion', 'PrecioUSD', 'Imagen', 'Stock', 'Activo', 'Tags'];
    const rows = products.map(p => [
      p.id, p.nombre, p.categoriaOriginal || p.categoria, p.subcategoria,
      p.descripcion, p.precioUSD, p.imagen, p.stock,
      p.activo ? 'TRUE' : 'FALSE', (p.tags || []).join(', ')
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(r => {
      csv += r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',') + '\n';
    });

    this.downloadFile(csv, 'productos_princesslov.csv', 'text/csv');
    AdminApp.toast('CSV exportado');
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
