/* ============================================
   ADMIN APP - Controlador Principal
   ============================================ */

const AdminApp = {
  currentSection: 'dashboard',
  dolarRate: 1200,

  async init() {
    await this.loadDolarRate();
    AdminData.applyCustomToConfig?.();
    AdminSettings.load();
    this.navigate('dashboard');
  },

  navigate(section) {
    this.currentSection = section;

    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const sectionEl = document.getElementById('section-' + section);
    if (sectionEl) sectionEl.classList.add('active');

    const navEl = document.querySelector(`.nav-item[data-section="${section}"]`);
    if (navEl) navEl.classList.add('active');

    const titles = {
      dashboard: ['Dashboard', 'Resumen general'],
      products: ['Productos', 'Gestión de catálogo'],
      orders: ['Pedidos', 'Gestión de ventas'],
      import: ['Importar Excel', 'Carga masiva de productos'],
      expenses: ['Gastos', 'Control de gastos del negocio'],
      financial: ['Finanzas', 'Análisis financiero'],
      content: ['Contenido', 'Categorías y textos del home'],
      settings: ['Configuración', 'Ajustes del sistema'],
    };

    const [title, breadcrumb] = titles[section] || ['', ''];
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-breadcrumb').textContent = breadcrumb;

    this.renderSection(section);
    return false;
  },

  renderSection(section) {
    switch (section) {
      case 'dashboard': AdminDashboard.render(); break;
      case 'products': AdminProducts.render(); break;
      case 'orders': AdminOrders.render(); break;
      case 'expenses': AdminExpenses.render(); break;
      case 'financial': AdminDashboard.renderFinancial(); break;
      case 'content': AdminContent.render(); break;
      case 'settings': AdminSettings.render(); break;
    }
  },

  async loadDolarRate() {
    try {
      const resp = await fetch('https://criptoya.com/api/dolar');
      const data = await resp.json();
      this.dolarRate = data.oficial?.ask || data.blue?.ask || 1200;
    } catch {
      this.dolarRate = 1200;
    }
    const el = document.getElementById('admin-dolar-value');
    if (el) el.textContent = '$' + this.dolarRate.toLocaleString('es-AR');
  },

  toast(message, type = 'success') {
    const container = document.getElementById('admin-toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },
};

document.addEventListener('DOMContentLoaded', () => AdminApp.init());
