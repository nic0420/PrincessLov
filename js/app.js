/* ============================================
   APP - PrincessLov Tienda Online
   ============================================ */

const App = {
  productosFiltrados: [],
  categoriaActual: 'todos',
  stockFilter: 'all',
  sortOrder: 'featured',

  async init() {
    try {
      await SheetsService.cargarProductos();
      await SheetsService.obtenerCotizacion();

      CartService.init();
      CartService.onChange(() => this.actualizarUI());

      this.renderDolarTicker();
      this.renderSidebarFilters();
      this.renderCategoryPills();
      this.renderHeroShowcase();
      this.renderProductos(SheetsService.productos);
      this.renderCartSidebar();
      this.actualizarUI();
      this.setupWhatsAppLink();

      this.hideLoading();
    } catch (error) {
      console.error('[App] Error inicializando:', error);
      this.hideLoading();
    }
  },

  /* ---------- DÓLAR TICKER ---------- */
  renderDolarTicker() {
    const el = document.getElementById('dolar-valor');
    if (el) {
      el.textContent = '$' + SheetsService.cotizacionDolar.toLocaleString('es-AR');
    }
  },

  /* ---------- SIDEBAR DRAWER FILTERS ---------- */
  renderSidebarFilters() {
    const container = document.getElementById('filter-categories');
    if (!container) return;

    const cats = SheetsService.obtenerCategoriasConConteo();

    container.innerHTML = `
      <li class="filter-item ${this.categoriaActual === 'todos' ? 'active' : ''}" onclick="App.filtrarCategoria('todos')" data-cat="todos">
        <span><span class="filter-icon">🏷️</span> Todos los productos</span>
        <span class="filter-count">${SheetsService.productos.length}</span>
      </li>
      ${cats.map(cat => `
        <li class="filter-item ${cat.id === this.categoriaActual ? 'active' : ''}" onclick="App.filtrarCategoria('${cat.id}')" data-cat="${cat.id}">
          <span><span class="filter-icon">${cat.icon}</span> ${cat.nombre}</span>
          <span class="filter-count">${cat.count}</span>
        </li>
      `).join('')}
    `;
  },

  /* ---------- PÍLDORAS DE CATEGORÍAS (estilo Faire) ---------- */
  renderCategoryPills() {
    const container = document.getElementById('categories-pills');
    if (!container) return;

    const cats = SheetsService.obtenerCategoriasConConteo();

    container.innerHTML = `
      <button class="cat-pill ${this.categoriaActual === 'todos' ? 'active' : ''}" onclick="App.filtrarCategoria('todos')" data-cat="todos">
        🏷️ Todos
      </button>
      ${cats.map(cat => `
        <button class="cat-pill ${cat.id === this.categoriaActual ? 'active' : ''}" onclick="App.filtrarCategoria('${cat.id}')" data-cat="${cat.id}">
          ${cat.icon} ${cat.nombre}
        </button>
      `).join('')}
    `;
  },

  /* ---------- HERO SHOWCASE ---------- */
  renderHeroShowcase() {
    const container = document.getElementById('hero-showcase');
    if (!container) return;

    const productos = SheetsService.productos;
    if (productos.length === 0) return;

    const featured = productos.slice(0, 3);

    container.innerHTML = featured.map(p => {
      const precioARS = SheetsService.calcularPrecioARS(p.precioUSD);
      return `
        <div class="hero-product-card" onclick="App.scrollToProducts()">
          <img class="hero-product-img" src="${p.imagen}" alt="${p.nombre}"
               onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22><rect width=%22300%22 height=%22200%22 fill=%22%23eedbd8%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%239c684c%22 font-size=%2214%22>Sin imagen</text></svg>'">
          <div class="hero-product-info">
            <div class="hero-product-name">${p.nombre}</div>
            <div class="hero-product-price">${SheetsService.formatPrecioARS(precioARS)}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  /* ---------- FILTRADO Y ORDENAMIENTO ---------- */
  aplicarFiltros() {
    let productos = [...SheetsService.productos];

    if (this.categoriaActual !== 'todos') {
      productos = SheetsService.filtrarPorCategoria(this.categoriaActual);
    }

    if (this.stockFilter === 'in') {
      productos = productos.filter(p => p.stock > 0);
    } else if (this.stockFilter === 'out') {
      productos = productos.filter(p => p.stock <= 0);
    }

    switch (this.sortOrder) {
      case 'price-asc':
        productos.sort((a, b) => a.precioUSD - b.precioUSD);
        break;
      case 'price-desc':
        productos.sort((a, b) => b.precioUSD - a.precioUSD);
        break;
      case 'name':
        productos.sort((a, b) => a.nombre.localeCompare(b.nombre));
        break;
    }

    this.renderProductos(productos);
  },

  filtrarCategoria(catId) {
    this.categoriaActual = catId;

    document.querySelectorAll('#filter-categories .filter-item').forEach(item => {
      item.classList.toggle('active', item.dataset.cat === catId);
    });

    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.cat === catId);
    });

    const titleEl = document.getElementById('productos-title');
    if (titleEl) {
      if (catId === 'todos') {
        titleEl.textContent = 'Todos los Productos';
      } else {
        const cat = SheetsService.obtenerCategoriasConConteo().find(c => c.id === catId);
        titleEl.textContent = cat ? cat.nombre : catId;
      }
    }

    this.aplicarFiltros();
  },

  setStockFilter(filter) {
    this.stockFilter = filter;

    document.querySelectorAll('#filter-stock .filter-item').forEach(item => {
      item.classList.toggle('active', item.dataset.filter === filter);
    });

    this.aplicarFiltros();
  },

  setSortOrder(order) {
    this.sortOrder = order;

    document.querySelectorAll('#filter-sort .filter-item').forEach(item => {
      item.classList.toggle('active', item.dataset.sort === order);
    });

    this.aplicarFiltros();
  },

  /* ---------- PRODUCTOS ---------- */
  renderProductos(productos) {
    const grid = document.getElementById('productos-grid');
    const countEl = document.getElementById('productos-count');
    if (!grid) return;

    this.productosFiltrados = productos;

    if (countEl) {
      countEl.textContent = `${productos.length} producto${productos.length !== 1 ? 's' : ''}`;
    }

    if (productos.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:4rem 1rem; color:var(--texto-light);">
          <div style="font-size:3.5rem; margin-bottom:1rem;">📦</div>
          <p style="font-size:1.2rem; font-weight:700; color:var(--burgundy);">No se encontraron productos</p>
          <p style="font-size:0.9rem; margin-top:0.5rem;">Intenta cambiando los filtros o la búsqueda</p>
          <button onclick="App.filtrarCategoria('todos'); App.setStockFilter('all');" style="margin-top:1.5rem; background:var(--burgundy); color:white; padding:0.8rem 1.8rem; border-radius:50px; font-weight:700;">Ver todos los productos</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = productos.map(p => {
      const precioARS = SheetsService.calcularPrecioARS(p.precioUSD);
      const sinStock = p.stock <= 0;
      let badge = '';
      if (p.tags.includes('nuevo')) badge = '<span class="producto-badge">Nuevo</span>';
      else if (p.tags.includes('oferta')) badge = '<span class="producto-badge">Oferta</span>';

      return `
        <div class="producto-card" data-id="${p.id}">
          ${badge}
          <div class="producto-img-wrap">
            <img src="${p.imagen}" alt="${p.nombre}"
                 onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22350%22><rect width=%22300%22 height=%22350%22 fill=%22%23eedbd8%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%239c684c%22 font-size=%2216%22>PrincessLov</text></svg>'">
          </div>
          <div class="producto-info">
            <div class="producto-categoria">${p.categoriaOriginal}</div>
            <div class="producto-nombre">${p.nombre}</div>
            <div class="producto-desc">${p.descripcion}</div>
            <div class="producto-precios">
              <span class="precio-ars">${SheetsService.formatPrecioARS(precioARS)}</span>
              <span class="precio-usd">USD ${p.precioUSD.toFixed(2)}</span>
            </div>
            <div class="producto-stock" style="color: ${sinStock ? '#d32f2f' : 'var(--texto-light)'}; ${sinStock ? 'font-weight:700;' : ''}">
              ${sinStock ? '⚠️ Sin stock' : `Stock: ${p.stock} unidades`}
            </div>
            <div class="producto-actions">
              <button class="btn-add-cart" data-id="${p.id}" ${sinStock ? 'disabled' : ''}>
                ${sinStock ? 'Sin stock' : '🛒 Agregar'}
              </button>
              <a class="btn-whatsapp-quick"
                 href="https://wa.me/${CONFIG.negocio.whatsapp}?text=${encodeURIComponent('Hola! Me interesa consultar sobre: ' + p.nombre + ' - ' + SheetsService.formatPrecioARS(precioARS))}"
                 target="_blank" title="Consultar por WhatsApp">
                💬
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  /* ---------- SIDEBAR DRAWER CONTROL ---------- */
  openSidebar() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebar-overlay')?.classList.add('open');
    document.body.classList.add('no-scroll');
  },

  closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('open');
    document.body.classList.remove('no-scroll');
  },

  /* ---------- CARRITO SIDEBAR ---------- */
  renderCartSidebar() {
    const itemsContainer = document.getElementById('cart-items');
    const footerEl = document.getElementById('cart-footer');
    if (!itemsContainer || !footerEl) return;

    const items = CartService.items;

    if (items.length === 0) {
      itemsContainer.innerHTML = `
        <div class="cart-empty">
          <div class="empty-icon">🛒</div>
          <p style="font-size:1.1rem; font-weight:700; color:var(--burgundy);">Tu carrito está vacío</p>
          <p style="font-size:0.85rem; margin-top:0.5rem; color:var(--texto-light);">Elegí prendas de nuestro catálogo para comenzar</p>
        </div>
      `;
      footerEl.innerHTML = '';
      return;
    }

    itemsContainer.innerHTML = items.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <img class="cart-item-img" src="${item.imagen}" alt="${item.nombre}"
             onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2270%22 height=%2280%22><rect width=%2270%22 height=%2280%22 fill=%22%23eedbd8%22/></svg>'">
        <div class="cart-item-details">
          <div class="cart-item-name">${item.nombre}</div>
          <div class="cart-item-price">${SheetsService.formatPrecioARS(item.precioARS * item.cantidad)}</div>
          <div class="cart-item-controls">
            <button class="qty-btn" data-action="minus" data-id="${item.id}">−</button>
            <span class="qty-value">${item.cantidad}</span>
            <button class="qty-btn" data-action="plus" data-id="${item.id}">+</button>
            <button class="btn-remove-item" data-action="remove" data-id="${item.id}">✕</button>
          </div>
        </div>
      </div>
    `).join('');

    const total = CartService.getTotalARS();
    const count = CartService.getTotalItems();

    footerEl.innerHTML = `
      <div class="cart-subtotal">
        <span>Subtotal (${count} item${count > 1 ? 's' : ''})</span>
        <span>${SheetsService.formatPrecioARS(total)}</span>
      </div>
      <div class="cart-total">
        <span>Total</span>
        <span>${SheetsService.formatPrecioARS(total)}</span>
      </div>
      <button class="cart-btn-checkout" onclick="App.openCheckout()">
        💳 Finalizar Compra
      </button>
      <button class="cart-btn-whatsapp" onclick="App.enviarCarritoWhatsApp()">
        💬 Comprar por WhatsApp
      </button>
    `;
  },

  actualizarUI() {
    const count = CartService.getTotalItems();
    const countEl = document.getElementById('cart-count');
    if (countEl) {
      countEl.textContent = count;
      countEl.classList.toggle('visible', count > 0);
    }
    this.renderCartSidebar();
  },

  /* ---------- CARRITO ACCIONES ---------- */
  openCart() {
    document.getElementById('cart-overlay')?.classList.add('open');
    document.getElementById('cart-sidebar')?.classList.add('open');
    document.body.classList.add('no-scroll');
  },

  closeCart() {
    document.getElementById('cart-overlay')?.classList.remove('open');
    document.getElementById('cart-sidebar')?.classList.remove('open');
    document.body.classList.remove('no-scroll');
  },

  enviarCarritoWhatsApp() {
    if (CartService.items.length === 0) {
      this.showToast('El carrito está vacío');
      return;
    }
    const envio = CONFIG.envios.find(e => e.id === 'retiro');
    CartService.enviarWhatsApp(envio, null);
    this.closeCart();
  },

  /* ---------- CHECKOUT ---------- */
  openCheckout() {
    if (CartService.items.length === 0) {
      this.showToast('El carrito está vacío');
      return;
    }
    this.closeCart();
    CheckoutService.renderCheckout();
    document.getElementById('checkout-modal')?.classList.add('open');
    document.body.classList.add('no-scroll');
  },

  closeCheckout() {
    document.getElementById('checkout-modal')?.classList.remove('open');
    document.body.classList.remove('no-scroll');
  },

  /* ---------- BÚSQUEDA ---------- */
  toggleSearch() {
    const overlay = document.getElementById('search-overlay');
    if (!overlay) return;
    overlay.classList.toggle('open');
    if (overlay.classList.contains('open')) {
      document.getElementById('search-input')?.focus();
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
      const input = document.getElementById('search-input');
      if (input) input.value = '';
      document.getElementById('search-results').innerHTML = '';
    }
  },

  handleSearch(query) {
    const resultsEl = document.getElementById('search-results');
    if (!query || query.trim().length < 2) {
      if (resultsEl) resultsEl.innerHTML = '';
      if (query.trim().length === 0) {
        this.aplicarFiltros();
      }
      return;
    }

    const results = SheetsService.buscarProductos(query);

    if (resultsEl && document.getElementById('search-overlay')?.classList.contains('open')) {
      if (results.length === 0) {
        resultsEl.innerHTML = '<p style="text-align:center; padding:1rem; color:var(--texto-light);">No se encontraron productos</p>';
        return;
      }

      resultsEl.innerHTML = results.slice(0, 8).map(p => {
        const precioARS = SheetsService.calcularPrecioARS(p.precioUSD);
        return `
          <div class="search-result-item" onclick="App.toggleSearch(); App.scrollToProducts();">
            <img class="search-result-img" src="${p.imagen}" alt="${p.nombre}"
                 onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22><rect width=%2250%22 height=%2250%22 fill=%22%23eedbd8%22/></svg>'">
            <div>
              <div class="search-result-name">${p.nombre}</div>
              <div class="search-result-price">${SheetsService.formatPrecioARS(precioARS)}</div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      // Búsqueda directa en catálogo
      this.renderProductos(results);
    }
  },

  /* ---------- MENÚ MÓVIL ---------- */
  openMobileMenu() {
    document.getElementById('mobile-menu')?.classList.add('open');
    document.body.classList.add('no-scroll');
  },

  closeMobileMenu() {
    document.getElementById('mobile-menu')?.classList.remove('open');
    document.body.classList.remove('no-scroll');
  },

  /* ---------- TOAST ---------- */
  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✨</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 2700);
  },

  /* ---------- LOADING ---------- */
  hideLoading() {
    const el = document.getElementById('loading-screen');
    if (el) {
      el.classList.add('hidden');
      setTimeout(() => el.remove(), 600);
    }
  },

  /* ---------- SCROLL ---------- */
  scrollToProducts() {
    document.getElementById('productos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  scrollToContact() {
    document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  /* ---------- WHATSAPP LINK ---------- */
  setupWhatsAppLink() {
    const btn = document.getElementById('contacto-whatsapp-btn');
    if (btn) {
      btn.href = `https://wa.me/${CONFIG.negocio.whatsapp}?text=${encodeURIComponent('Hola! Quiero consultar por sus productos.')}`;
    }
    const footerWa = document.getElementById('footer-whatsapp-link');
    if (footerWa) {
      footerWa.innerHTML = `📱 WhatsApp: <a href="https://wa.me/${CONFIG.negocio.whatsapp}" target="_blank" style="color:var(--pink-300);">Escribinos</a>`;
    }
    const footerIg = document.getElementById('footer-instagram');
    if (footerIg && CONFIG.negocio.instagram) {
      footerIg.href = `https://instagram.com/${CONFIG.negocio.instagram}`;
    }
  },
};

/* ============================================
   EVENT LISTENERS
   ============================================ */
document.addEventListener('DOMContentLoaded', () => App.init());

document.addEventListener('click', (e) => {
  const addBtn = e.target.closest('.btn-add-cart');
  if (addBtn && !addBtn.disabled) {
    const id = addBtn.dataset.id;
    const producto = SheetsService.obtenerProducto(id);
    if (producto) {
      CartService.addItem(producto);
      App.showToast(`Agregado: ${producto.nombre}`);
    }
  }

  if (e.target.closest('.btn-close-cart') || e.target.id === 'cart-overlay') {
    App.closeCart();
  }

  if (e.target.id === 'checkout-modal' || e.target.closest('.btn-close-modal')) {
    App.closeCheckout();
  }

  if (e.target.closest('.qty-btn')) {
    const btn = e.target.closest('.qty-btn');
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const item = CartService.items.find(i => i.id === id);
    if (item) {
      if (action === 'plus') CartService.updateQuantity(id, item.cantidad + 1);
      else if (action === 'minus') CartService.updateQuantity(id, item.cantidad - 1);
    }
  }

  if (e.target.closest('.btn-remove-item')) {
    const btn = e.target.closest('.btn-remove-item');
    CartService.removeItem(btn.dataset.id);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    App.closeCart();
    App.closeCheckout();
    App.closeMobileMenu();
    App.closeSidebar();
    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay?.classList.contains('open')) {
      App.toggleSearch();
    }
  }
});
