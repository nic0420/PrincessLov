/* ============================================
   ADMIN ORDERS - Gestión de Pedidos
   ============================================ */

const AdminOrders = {
  searchQuery: '',
  filterStatus: '',

  render() {
    this.populateFilters();
    this.renderList();
  },

  populateFilters() {
    const statusSelect = document.getElementById('orders-filter-status');
    const ofEstado = document.getElementById('of-estado');
    const ofPago = document.getElementById('of-pago');
    const ofEnvio = document.getElementById('of-envio');

    if (statusSelect) {
      statusSelect.innerHTML = '<option value="">Todos los estados</option>';
      ADMIN_CONFIG.estadosPedido.forEach(ep => {
        statusSelect.innerHTML += `<option value="${ep.id}">${ep.icon} ${ep.label}</option>`;
      });
    }

    if (ofEstado) {
      ofEstado.innerHTML = '';
      ADMIN_CONFIG.estadosPedido.forEach(ep => {
        ofEstado.innerHTML += `<option value="${ep.id}">${ep.icon} ${ep.label}</option>`;
      });
    }

    if (ofPago) {
      ofPago.innerHTML = '';
      ADMIN_CONFIG.mediosPago.forEach(mp => {
        ofPago.innerHTML += `<option value="${mp}">${mp}</option>`;
      });
    }

    if (ofEnvio) {
      ofEnvio.innerHTML = '';
      ADMIN_CONFIG.metodosEnvio.forEach(me => {
        ofEnvio.innerHTML += `<option value="${me}">${me}</option>`;
      });
    }
  },

  getFiltered() {
    let orders = AdminData.getOrders();

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      orders = orders.filter(o =>
        (o.cliente || '').toLowerCase().includes(q) ||
        (o.id || '').toLowerCase().includes(q) ||
        (o.notas || '').toLowerCase().includes(q)
      );
    }

    if (this.filterStatus) {
      orders = orders.filter(o => o.estado === this.filterStatus);
    }

    return orders.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  },

  renderList() {
    const orders = this.getFiltered();
    const container = document.getElementById('orders-list');
    const empty = document.getElementById('orders-empty');

    if (orders.length === 0) {
      if (container) container.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (empty) empty.style.display = 'none';

    container.innerHTML = orders.map(o => {
      const estado = ADMIN_CONFIG.estadosPedido.find(ep => ep.id === o.estado) || ADMIN_CONFIG.estadosPedido[0];
      const items = (o.items || []).map(i => {
        const prod = AdminData.getProduct(i.productoId);
        return `${prod?.nombre || i.productoId} x${i.cantidad}`;
      }).join(', ');

      return `
        <div class="order-card" style="border-left:4px solid ${estado.color};">
          <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:0.75rem;">
            <div>
              <strong style="font-size:1rem;">${o.cliente || 'Sin cliente'}</strong>
              <span style="font-size:0.8rem; color:var(--texto-secundario); margin-left:0.5rem;">#${o.id?.slice(-6).toUpperCase()}</span>
            </div>
            <span class="badge" style="background:${estado.color}; color:white;">${estado.icon} ${estado.label}</span>
          </div>
          <div style="font-size:0.85rem; color:var(--texto-secundario); margin-bottom:0.5rem;">
            ${items || 'Sin items'}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:0.8rem; color:var(--texto-secundario);">
              📅 ${AdminApp.formatDate(o.fecha)} &nbsp;|&nbsp; 💳 ${o.medioPago || '-'} &nbsp;|&nbsp; 🚚 ${o.metodoEnvio || '-'}
            </div>
            <strong style="color:var(--borgona-300);">${AdminData.formatARS(o.total || 0)}</strong>
          </div>
          <div style="display:flex; gap:0.5rem; margin-top:0.75rem;">
            <button class="btn btn-sm btn-secondary" onclick="AdminOrders.openForm('${o.id}')">✏️ Editar</button>
            <button class="btn btn-sm btn-danger" onclick="AdminOrders.delete('${o.id}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  },

  search(query) {
    this.searchQuery = query;
    this.renderList();
  },

  filterByStatus(status) {
    this.filterStatus = status;
    this.renderList();
  },

  openForm(id) {
    this.populateFilters();
    const modal = document.getElementById('order-modal');
    const title = document.getElementById('order-modal-title');
    const container = document.getElementById('order-items-container');

    if (id) {
      const o = AdminData.getOrder(id);
      if (!o) return;
      title.textContent = 'Editar Pedido #' + id.slice(-6).toUpperCase();
      document.getElementById('of-id').value = o.id;
      document.getElementById('of-cliente').value = o.cliente || '';
      document.getElementById('of-telefono').value = o.telefono || '';
      document.getElementById('of-email').value = o.email || '';
      document.getElementById('of-estado').value = o.estado || 'pendiente';
      document.getElementById('of-pago').value = o.medioPago || '';
      document.getElementById('of-envio').value = o.metodoEnvio || '';
      document.getElementById('of-direccion').value = o.direccion || '';
      document.getElementById('of-costo').value = o.costoTotal || 0;
      document.getElementById('of-notas').value = o.notas || '';

      container.innerHTML = '';
      (o.items || []).forEach(item => this.addItemRow(item));
    } else {
      title.textContent = 'Nuevo Pedido';
      document.getElementById('order-form').reset();
      document.getElementById('of-id').value = '';
      document.getElementById('of-estado').value = 'pendiente';
      container.innerHTML = '';
      this.addItemRow();
    }

    modal.classList.add('open');
  },

  closeForm() {
    document.getElementById('order-modal').classList.remove('open');
  },

  addItemRow(item) {
    const container = document.getElementById('order-items-container');
    const products = AdminData.getProducts();
    const row = document.createElement('div');
    row.className = 'form-grid';
    row.style.marginBottom = '0.5rem';
    row.innerHTML = `
      <div class="form-group" style="margin-bottom:0;">
        <select class="order-item-product" required onchange="AdminOrders.onProductChange(this)">
          <option value="">Producto...</option>
          ${products.map(p => {
            const precioARS = AdminApp.dolarRate ? Math.round(p.precioUSD * AdminApp.dolarRate * (CONFIG?.cotizacion?.margenGanancia || 1.3)) : 0;
            return `<option value="${p.id}" data-price="${precioARS}" ${item && item.productoId === p.id ? 'selected' : ''}>${p.nombre} (${AdminData.formatUSD(p.precioUSD)})</option>`;
          }).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <input type="number" class="order-item-cant" min="1" value="${item ? item.cantidad : 1}" placeholder="Cant." required>
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <input type="number" class="order-item-precio" step="0.01" value="${item ? item.precioUnitario || '' : ''}" placeholder="Precio unit. (ARS)">
      </div>
      <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);
  },

  onProductChange(select) {
    const option = select.options[select.selectedIndex];
    const price = option?.dataset?.price || '';
    const row = select.closest('.form-grid');
    if (row) {
      const priceInput = row.querySelector('.order-item-precio');
      if (priceInput && !priceInput.value) {
        priceInput.value = price;
      }
    }
  },

  save(event) {
    event.preventDefault();

    const id = document.getElementById('of-id').value;
    const items = [];
    document.querySelectorAll('#order-items-container .form-grid').forEach(row => {
      const prodId = row.querySelector('.order-item-product').value;
      const cant = parseInt(row.querySelector('.order-item-cant').value) || 0;
      const precio = parseFloat(row.querySelector('.order-item-precio').value) || 0;
      if (prodId && cant > 0) {
        items.push({ productoId: prodId, cantidad: cant, precioUnitario: precio });
      }
    });

    const total = items.reduce((s, i) => s + (i.precioUnitario * i.cantidad), 0);

    const data = {
      cliente: document.getElementById('of-cliente').value.trim(),
      telefono: document.getElementById('of-telefono').value.trim(),
      email: document.getElementById('of-email').value.trim(),
      estado: document.getElementById('of-estado').value,
      medioPago: document.getElementById('of-pago').value,
      metodoEnvio: document.getElementById('of-envio').value,
      direccion: document.getElementById('of-direccion').value.trim(),
      costoTotal: parseFloat(document.getElementById('of-costo').value) || 0,
      notas: document.getElementById('of-notas').value.trim(),
      items,
      total,
    };

    if (id) {
      AdminData.updateOrder(id, data);
      AdminApp.toast('Pedido actualizado');
    } else {
      AdminData.addOrder(data);
      AdminApp.toast('Pedido creado');
    }

    this.closeForm();
    this.renderList();
  },

  delete(id) {
    if (confirm('¿Eliminar este pedido?')) {
      AdminData.deleteOrder(id);
      AdminApp.toast('Pedido eliminado');
      this.renderList();
    }
  },

  exportCSV() {
    const orders = AdminData.getOrders();
    if (orders.length === 0) {
      AdminApp.toast('No hay pedidos para exportar', 'error');
      return;
    }

    const headers = ['ID', 'Fecha', 'Cliente', 'Telefono', 'Email', 'Estado', 'MedioPago', 'Envio', 'Direccion', 'Total', 'Costo', 'Notas'];
    const rows = orders.map(o => [
      o.id, o.fecha, o.cliente, o.telefono, o.email, o.estado,
      o.medioPago, o.metodoEnvio, o.direccion, o.total, o.costoTotal, o.notas
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(r => {
      csv += r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pedidos_princesslov.csv';
    a.click();
    URL.revokeObjectURL(url);
    AdminApp.toast('CSV de pedidos exportado');
  },
};
