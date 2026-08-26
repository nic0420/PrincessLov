/* ============================================
   ADMIN EXPENSES - Gestión de Gastos
   ============================================ */

const AdminExpenses = {
  render() {
    this.renderList();
  },

  renderList() {
    const expenses = AdminData.getExpenses().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const container = document.getElementById('expenses-list');
    const empty = document.getElementById('expenses-empty');

    if (expenses.length === 0) {
      if (container) container.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (empty) empty.style.display = 'none';

    const total = expenses.reduce((s, e) => s + (e.monto || 0), 0);

    container.innerHTML = `
      <div class="chart-card" style="margin-bottom:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:0.85rem; color:var(--texto-secundario);">Total de gastos</div>
            <div style="font-size:1.5rem; font-weight:800; color:#EF4444;">${AdminData.formatARS(total)}</div>
          </div>
          <div style="font-size:0.85rem; color:var(--texto-secundario);">${expenses.length} registros</div>
        </div>
      </div>
      <div class="chart-card">
        ${expenses.map(e => `
          <div style="display:flex; align-items:center; gap:1rem; padding:0.75rem 0; border-bottom:1px solid var(--gris-200);">
            <span style="font-size:1.2rem;">${this.getCatIcon(e.categoria)}</span>
            <div style="flex:1;">
              <div style="font-weight:600; font-size:0.9rem;">${e.concepto}</div>
              <div style="font-size:0.8rem; color:var(--texto-secundario);">
                ${AdminApp.formatDate(e.fecha)} · <span class="badge" style="font-size:0.7rem;">${e.categoria}</span>
                ${e.notas ? ' · ' + e.notas : ''}
              </div>
            </div>
            <strong style="color:#EF4444; font-size:0.95rem;">-${AdminData.formatARS(e.monto)}</strong>
            <button class="btn btn-sm btn-danger" onclick="AdminExpenses.delete('${e.id}')">🗑️</button>
          </div>
        `).join('')}
      </div>
    `;
  },

  getCatIcon(cat) {
    const icons = { fijo: '🏠', variable: '📦', envio: '🚚', otro: '📌' };
    return icons[cat] || '💰';
  },

  openForm() {
    document.getElementById('expense-form').reset();
    document.getElementById('ef-fecha').value = new Date().toISOString().slice(0, 10);
    document.getElementById('expense-modal').classList.add('open');
  },

  closeForm() {
    document.getElementById('expense-modal').classList.remove('open');
  },

  save(event) {
    event.preventDefault();

    const data = {
      concepto: document.getElementById('ef-concepto').value.trim(),
      monto: parseFloat(document.getElementById('ef-monto').value) || 0,
      fecha: document.getElementById('ef-fecha').value ? new Date(document.getElementById('ef-fecha').value).toISOString() : new Date().toISOString(),
      categoria: document.getElementById('ef-categoria').value,
      notas: document.getElementById('ef-notas').value.trim(),
    };

    AdminData.addExpense(data);
    AdminApp.toast('Gasto registrado');
    this.closeForm();
    this.renderList();
  },

  delete(id) {
    if (confirm('¿Eliminar este gasto?')) {
      AdminData.deleteExpense(id);
      AdminApp.toast('Gasto eliminado');
      this.renderList();
    }
  },
};
