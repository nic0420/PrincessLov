/* ============================================
   ADMIN DASHBOARD - Métricas y Gráficos
   ============================================ */

const AdminDashboard = {
  charts: {},
  currentPeriod: 'mes',

  setPeriod(period) {
    this.currentPeriod = period;
    document.querySelectorAll('#dashboard-tabs .tab').forEach(t => {
      t.classList.toggle('active', t.dataset.period === period);
    });
    this.render();
  },

  render() {
    this.renderStats();
    this.renderCharts();
    this.renderBreakEven();
    this.renderTopProducts();
    this.renderStockAlerts();
  },

  renderStats() {
    const stats = AdminData.getStats(this.currentPeriod === 'all' ? null : this.currentPeriod);
    const container = document.getElementById('dashboard-stats');
    if (!container) return;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon" style="background:linear-gradient(135deg, var(--rosa-300), var(--borgona-300));">💰</div>
        <div class="stat-value">${AdminData.formatARS(stats.ingresos)}</div>
        <div class="stat-label">Ingresos</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:linear-gradient(135deg, #10B981, #059669);">📦</div>
        <div class="stat-value">${stats.totalPedidos}</div>
        <div class="stat-label">Pedidos</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:linear-gradient(135deg, #F59E0B, #D97706);">⏳</div>
        <div class="stat-value">${stats.pedidosActivos}</div>
        <div class="stat-label">Pedidos activos</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:linear-gradient(135deg, #8B5CF6, #6D28D9);">📊</div>
        <div class="stat-value">${stats.margen.toFixed(1)}%</div>
        <div class="stat-label">Margen de ganancia</div>
      </div>
    `;
  },

  renderCharts() {
    const stats = AdminData.getStats(this.currentPeriod === 'all' ? null : this.currentPeriod);
    this.renderVentasChart(stats);
    this.renderEstadosChart(stats);
  },

  renderVentasChart(stats) {
    const canvas = document.getElementById('chart-ventas');
    if (!canvas) return;

    if (this.charts.ventas) this.charts.ventas.destroy();

    const labels = stats.ventasPorDia.map(d => {
      const parts = d.fecha.split('-');
      return parts[2] + '/' + parts[1];
    });
    const ingresos = stats.ventasPorDia.map(d => d.ingresos);
    const pedidos = stats.ventasPorDia.map(d => d.pedidos);

    this.charts.ventas = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Ingresos (ARS)',
          data: ingresos,
          borderColor: '#800020',
          backgroundColor: 'rgba(128, 0, 32, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
        }, {
          label: 'Pedidos',
          data: pedidos,
          borderColor: '#F5B7C5',
          backgroundColor: 'rgba(245, 183, 197, 0.1)',
          fill: false,
          tension: 0.4,
          pointRadius: 2,
          yAxisID: 'y1',
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString() } },
          y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } },
        },
      },
    });
  },

  renderEstadosChart(stats) {
    const canvas = document.getElementById('chart-estados');
    if (!canvas) return;

    if (this.charts.estados) this.charts.estados.destroy();

    const labels = [];
    const data = [];
    const colors = [];

    ADMIN_CONFIG.estadosPedido.forEach(ep => {
      const count = stats.porEstado[ep.id] || 0;
      if (count > 0) {
        labels.push(ep.icon + ' ' + ep.label);
        data.push(count);
        colors.push(ep.color);
      }
    });

    if (data.length === 0) {
      labels.push('Sin pedidos');
      data.push(1);
      colors.push('#D4C4C8');
    }

    this.charts.estados = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { padding: 15 } } },
        cutout: '60%',
      },
    });
  },

  renderBreakEven() {
    const be = AdminData.calcularPuntoEquilibrio(AdminApp.dolarRate);
    const container = document.getElementById('breakeven-content');
    if (!container) return;

    const stats = AdminData.getStats(this.currentPeriod === 'all' ? null : this.currentPeriod);
    const ventas = stats.ingresos;
    const progreso = be.gastosFijos > 0 ? Math.min((ventas / be.gastosFijos) * 100, 100) : 0;

    container.innerHTML = `
      <div style="text-align:center; margin:1.5rem 0;">
        <div style="font-size:2rem; font-weight:800; color:var(--borgona-300);">${AdminData.formatNumber(be.unidades)}</div>
        <div style="color:var(--texto-secundario); font-size:0.9rem;">unidades necesarias</div>
      </div>
      <div class="breakeven-progress">
        <div class="breakeven-bar" style="width:${progreso}%"></div>
      </div>
      <div style="display:flex; justify-content:space-between; margin-top:0.5rem; font-size:0.8rem; color:var(--texto-secundario);">
        <span>Ventas: ${AdminData.formatARS(ventas)}</span>
        <span>Objetivo: ${AdminData.formatARS(be.gastosFijos)}</span>
      </div>
      <div style="margin-top:1rem; font-size:0.85rem;">
        <div style="display:flex; justify-content:space-between; padding:0.3rem 0;">
          <span style="color:var(--texto-secundario);">Gastos fijos mensuales:</span>
          <strong>${AdminData.formatARS(be.gastosFijos)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:0.3rem 0;">
          <span style="color:var(--texto-secundario);">Ganancia prom. por unidad:</span>
          <strong>${AdminData.formatARS(be.gananciaPromUnit)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:0.3rem 0;">
          <span style="color:var(--texto-secundario);">Progreso al punto de equilibrio:</span>
          <strong style="color:${progreso >= 100 ? '#10B981' : '#F59E0B'};">${progreso.toFixed(0)}%</strong>
        </div>
      </div>
    `;
  },

  renderTopProducts() {
    const stats = AdminData.getStats(this.currentPeriod === 'all' ? null : this.currentPeriod);
    const container = document.getElementById('top-products-list');
    if (!container) return;

    if (stats.topProductos.length === 0) {
      container.innerHTML = '<p style="text-align:center; padding:2rem; color:var(--texto-secundario);">Sin datos de ventas aún</p>';
      return;
    }

    container.innerHTML = stats.topProductos.map((p, i) => `
      <div style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0; border-bottom:1px solid var(--gris-200);">
        <span style="width:24px; text-align:center; font-weight:700; color:${i < 3 ? 'var(--borgona-300)' : 'var(--texto-secundario)'};">#${i + 1}</span>
        <span style="flex:1; font-size:0.85rem; font-weight:500;">${p.nombre}</span>
        <span style="font-weight:700; color:var(--borgona-300);">${p.cantidad} u.</span>
      </div>
    `).join('');
  },

  renderStockAlerts() {
    const lowStock = AdminData.getLowStockProducts(5);
    const card = document.getElementById('stock-alerts-card');
    const list = document.getElementById('stock-alerts-list');
    if (!card || !list) return;

    if (lowStock.length === 0) {
      card.style.display = 'none';
      return;
    }

    card.style.display = 'block';
    list.innerHTML = lowStock.map(p => `
      <div style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0; border-bottom:1px solid var(--gris-200);">
        <span style="color:#EF4444; font-weight:700;">⚠️</span>
        <span style="flex:1; font-size:0.85rem;">${p.nombre}</span>
        <span style="font-size:0.8rem; color:${p.stock === 0 ? '#EF4444' : '#F59E0B'}; font-weight:600;">
          ${p.stock === 0 ? 'Sin stock' : `Solo ${p.stock} u.`}
        </span>
      </div>
    `).join('');
  },

  /* ========== FINANCIAL SECTION ========== */
  renderFinancial() {
    const stats = AdminData.getStats(this.currentPeriod === 'all' ? null : this.currentPeriod);
    const totalExpenses = AdminData.getTotalExpenses();
    const be = AdminData.calcularPuntoEquilibrio(AdminApp.dolarRate);

    const container = document.getElementById('financial-stats');
    if (container) {
      container.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon" style="background:linear-gradient(135deg, #10B981, #059669);">💵</div>
          <div class="stat-value">${AdminData.formatARS(stats.ingresos)}</div>
          <div class="stat-label">Ingresos totales</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:linear-gradient(135deg, #EF4444, #DC2626);">📉</div>
          <div class="stat-value">${AdminData.formatARS(stats.costos + totalExpenses)}</div>
          <div class="stat-label">Costos totales</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:linear-gradient(135deg, var(--rosa-300), var(--borgona-300));">💎</div>
          <div class="stat-value" style="color:${stats.ganancia >= 0 ? '#10B981' : '#EF4444'};">${AdminData.formatARS(stats.ganancia - totalExpenses)}</div>
          <div class="stat-label">Ganancia neta</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:linear-gradient(135deg, #F59E0B, #D97706);">🎫</div>
          <div class="stat-value">${AdminData.formatARS(stats.ticketProm)}</div>
          <div class="stat-label">Ticket promedio</div>
        </div>
      `;
    }

    this.renderFinancialChart(stats);
    this.renderFinancialBreakEven(be);
    this.renderFinancialExpenses();
  },

  renderFinancialChart(stats) {
    const canvas = document.getElementById('chart-financial');
    if (!canvas) return;
    if (this.charts.financial) this.charts.financial.destroy();

    this.charts.financial = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Ingresos', 'Costos', 'Gastos', 'Ganancia'],
        datasets: [{
          data: [stats.ingresos, stats.costos, AdminData.getTotalExpenses(), stats.ganancia - AdminData.getTotalExpenses()],
          backgroundColor: ['#10B981', '#EF4444', '#F59E0B', stats.ganancia >= 0 ? '#800020' : '#EF4444'],
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString() } } },
      },
    });
  },

  renderFinancialBreakEven(be) {
    const container = document.getElementById('financial-breakeven');
    if (!container) return;

    container.innerHTML = `
      <div style="margin:1rem 0;">
        <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--gris-200);">
          <span>Gastos fijos mensuales:</span>
          <strong>${AdminData.formatARS(be.gastosFijos)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--gris-200);">
          <span>Ganancia promedio por unidad:</span>
          <strong>${AdminData.formatARS(be.gananciaPromUnit)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--gris-200);">
          <span>Unidades para punto de equilibrio:</span>
          <strong style="color:var(--borgona-300); font-size:1.1rem;">${AdminData.formatNumber(be.unidades)} u.</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:0.5rem 0;">
          <span>Monto de punto de equilibrio:</span>
          <strong style="color:var(--borgona-300);">${AdminData.formatARS(be.monto)}</strong>
        </div>
      </div>
    `;
  },

  renderFinancialExpenses() {
    const expenses = AdminData.getExpenses().sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 15);
    const container = document.getElementById('financial-expenses-list');
    if (!container) return;

    if (expenses.length === 0) {
      container.innerHTML = '<p style="text-align:center; padding:2rem; color:var(--texto-secundario);">Sin gastos registrados</p>';
      return;
    }

    container.innerHTML = expenses.map(e => `
      <div style="display:flex; align-items:center; gap:1rem; padding:0.75rem 0; border-bottom:1px solid var(--gris-200);">
        <span style="flex:1; font-size:0.85rem; font-weight:500;">${e.concepto}</span>
        <span style="font-size:0.8rem; color:var(--texto-secundario);">${AdminApp.formatDate(e.fecha)}</span>
        <span style="font-size:0.8rem; padding:0.2rem 0.5rem; border-radius:20px; background:var(--gris-200);">${e.categoria}</span>
        <span style="font-weight:700; color:#EF4444;">-${AdminData.formatARS(e.monto)}</span>
      </div>
    `).join('');
  },
};
