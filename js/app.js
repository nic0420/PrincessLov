/* ============================================================
   APP - PrincessLov Tienda Online (SSENSE Editorial Style)
   ============================================================ */

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
      this.renderProductos(SheetsService.productos);
      this.renderCartSidebar();
      this.actualizarUI();
      this.setupWhatsAppLink();
      this.initHeaderScroll();
      this.initFabFilter();

      this.hideLoading();
    } catch (error) {
      console.error('[App] Error inicializando:', error);
      this.hideLoading();
    }
  },

  /* ---------- HEADER SCROLL EFFECT ---------- */
  initHeaderScroll() {
    const header = document.getElementById('header');
    if (!header) return;
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY > 8;
      header.classList.toggle('header--scrolled', scrolled);
    }, { passive: true });
  },

  /* ---------- FAB FILTER MOBILE ---------- */
  initFabFilter() {
    const fab = document.getElementById('fab-filter');
    if (!fab) return;
    const mql = window.matchMedia('(max-width: 768px)');
    const toggle = () => { fab.style.display = mql.matches ? 'flex' : 'none'; };
    toggle();
    mql.addEventListener?.('change', toggle);
  },

  /* ---------- DÓLAR TICKER ---------- */
  renderDolarTicker() {
    const el = document.getElementById('dolar-valor');
    if (el) el.textContent = '$' + SheetsService.cotizacionDolar.toLocaleString('es-AR');
  },

  /* ---------- SIDEBAR DRAWER FILTERS ---------- */
  renderSidebarFilters() {
    const container = document.getElementById('filter-categories');
    if (!container) return;

    const cats = SheetsService.obtenerCategoriasConConteo();

    container.innerHTML = `
      <button class="filter-item ${this.categoriaActual === 'todos' ? 'filter-item--active' : ''}" onclick="App.filtrarCategoria('todos')" data-cat="todos">
        <span><span class="filter-item__icon" aria-hidden="true">🏷️</span> Todos los productos</span>
        <span class="filter-item__count">${SheetsService.productos.length}</span>
      </button>
      ${cats.map(cat => `
        <button class="filter-item ${cat.id === this.categoriaActual ? 'filter-item--active' : ''}" onclick="App.filtrarCategoria('${cat.id}')" data-cat="${cat.id}">
          <span><span class="filter-item__icon" aria-hidden="true">${cat.icon}</span> ${cat.nombre}</span>
          <span class="filter-item__count">${cat.count}</span>
        </button>
      `).join('')}
    `;
  },

  /* ---------- CATEGORY PILLS (top of grid) ---------- */
  renderCategoryPills() {
    const container = document.getElementById('categories-pills');
    if (!container) return;

    const cats = SheetsService.obtenerCategoriasConConteo();

    container.innerHTML = `
      <button class="filter-pill ${this.categoriaActual === 'todos' ? 'filter-pill--active' : ''}" onclick="App.filtrarCategoria('todos')" data-cat="todos">
        🏷️ Todos
      </button>
      ${cats.map(cat => `
        <button class="filter-pill ${cat.id === this.categoriaActual ? 'filter-pill--active' : ''}" onclick="App.filtrarCategoria('${cat.id}')" data-cat="${cat.id}">
          ${cat.icon} ${cat.nombre}
        </button>
      `).join('')}
    `;
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
      case 'price-asc': productos.sort((a, b) => a.precioUSD - b.precioUSD); break;
      case 'price-desc': productos.sort((a, b) => b.precioUSD - a.precioUSD); break;
      case 'name': productos.sort((a, b) => a.nombre.localeCompare(b.nombre)); break;
    }

    this.renderProductos(productos);
  },

  filtrarCategoria(catId) {
    this.categoriaActual = catId;

    document.querySelectorAll('#filter-categories .filter-item').forEach(item => {
      item.classList.toggle('filter-item--active', item.dataset.cat === catId);
    });

    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.classList.toggle('filter-pill--active', pill.dataset.cat === catId);
    });

    const titleEl = document.getElementById('productos-title');
    if (titleEl) {
      if (catId === 'todos') titleEl.textContent = 'Todos los Productos';
      else {
        const cat = SheetsService.obtenerCategoriasConConteo().find(c => c.id === catId);
        titleEl.textContent = cat ? cat.nombre : catId;
      }
    }

    this.aplicarFiltros();
  },

  setStockFilter(filter) {
    this.stockFilter = filter;

    document.querySelectorAll('#filter-stock .filter-item').forEach(item => {
      item.classList.toggle('filter-item--active', item.dataset.filter === filter);
    });

    this.aplicarFiltros();
  },

  setSortOrder(order) {
    this.sortOrder = order;

    document.querySelectorAll('#filter-sort .filter-item').forEach(item => {
      item.classList.toggle('filter-item--active', item.dataset.sort === order);
    });

    this.aplicarFiltros();
  },

  /* ---------- PRODUCTOS GRID ---------- */
  renderProductos(productos) {
    const grid = document.getElementById('productos-grid');
    const countEl = document.getElementById('productos-count');
    const emptyEl = document.getElementById('productos-empty');
    if (!grid) return;

    this.productosFiltrados = productos;

    if (countEl) countEl.textContent = `${productos.length} producto${productos.length !== 1 ? 's' : ''}`;

    if (productos.length === 0) {
      grid.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    grid.style.display = 'grid';
    if (emptyEl) emptyEl.style.display = 'none';

    grid.innerHTML = productos.map(p => {
      const precioARS = SheetsService.calcularPrecioARS(p.precioUSD);
      const sinStock = p.stock <= 0;
      let badge = '';
      if (p.tags.includes('nuevo')) badge = '<span class="product-card__badge">Nuevo</span>';
      else if (p.tags.includes('oferta')) badge = '<span class="product-card__badge">Oferta</span>';

      return `
        <article class="product-card" data-id="${p.id}" role="listitem">
          ${badge}
          <div class="product-card__media">
            <img class="product-card__image" src="${p.imagen}" alt="${p.nombre}"
                 loading="lazy"
                 onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22400%22><rect width=%22300%22 height=%22400%22 fill=%22%23eedbd8%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%239c684c%22 font-size=%2216%22>PrincessLov</text></svg>'">
            <button class="product-card__quick" data-id="${p.id}" aria-label="Agregar ${p.nombre} al carrito" title="Agregar al carrito">
              <span aria-hidden="true">🛒</span>
            </button>
          </div>
          <div class="product-card__content">
            <div class="product-card__category">${p.categoriaOriginal}</div>
            <h3 class="product-card__name">${p.nombre}</h3>
            <p class="product-card__desc">${p.descripcion}</p>
            <div class="product-card__prices">
              <span class="price price--ars">${SheetsService.formatPrecioARS(precioARS)}</span>
              <span class="price price--usd">USD ${p.precioUSD.toFixed(2)}</span>
            </div>
            <div class="product-card__stock ${sinStock ? 'product-card__stock--low' : ''}">
              ${sinStock ? '⚠️ Sin stock' : `Stock: ${p.stock} unidades`}
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Delegación para botones quick-add
    grid.querySelectorAll('.product-card__quick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const producto = SheetsService.obtenerProducto(id);
        if (producto && producto.stock > 0) {
          CartService.addItem(producto);
          this.showToast(`Agregado: ${producto.nombre}`);
        }
      });
    });
  },

  /* ---------- SIDEBAR DRAWER CONTROL ---------- */
  openSidebar() {
    document.getElementById('sidebar')?.classList.add('drawer--open');
    document.getElementById('sidebar-overlay')?.classList.add('drawer-overlay--open');
    document.body.classList.add('no-scroll');
  },

  closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('drawer--open');
    document.getElementById('sidebar-overlay')?.classList.remove('drawer-overlay--open');
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
        <div class="cart__empty">
          <div class="cart__empty-icon" aria-hidden="true">🛒</div>
          <p style="font-size:1.125rem; font-weight:500; color:var(--ink); margin-bottom:var(--space-2);">Tu carrito está vacío</p>
          <p style="font-weight:300; color:var(--muted);">Elegí prendas de nuestro catálogo para comenzar</p>
        </div>
      `;
      footerEl.innerHTML = '';
      return;
    }

    itemsContainer.innerHTML = items.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <img class="cart-item__img" src="${item.imagen}" alt="${item.nombre}"
             onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2270%22 height=%2280%22><rect width=%2270%22 height=%2280%22 fill=%22%23eedbd8%22/></svg>'">
        <div class="cart-item__details">
          <div class="cart-item__name">${item.nombre}</div>
          <div class="cart-item__price">${SheetsService.formatPrecioARS(item.precioARS * item.cantidad)}</div>
          <div class="cart-item__controls">
            <button class="qty-btn" data-action="minus" data-id="${item.id}" aria-label="Disminuir cantidad">−</button>
            <span class="qty-value">${item.cantidad}</span>
            <button class="qty-btn" data-action="plus" data-id="${item.id}" aria-label="Aumentar cantidad">+</button>
            <button class="cart-item__remove" data-action="remove" data-id="${item.id}" aria-label="Eliminar ${item.nombre}">✕</button>
          </div>
        </div>
      </div>
    `).join('');

    const total = CartService.getTotalARS();
    const count = CartService.getTotalItems();

    footerEl.innerHTML = `
      <div class="cart__totals">
        <div class="cart__row">
          <span>Subtotal (${count} item${count > 1 ? 's' : ''})</span>
          <span>${SheetsService.formatPrecioARS(total)}</span>
        </div>
        <div class="cart__row cart__row--total">
          <span>Total</span>
          <span>${SheetsService.formatPrecioARS(total)}</span>
        </div>
      </div>
      <div class="cart__actions">
        <button class="btn btn--primary btn--block" onclick="App.openCheckout()">💳 Finalizar Compra</button>
        <button class="btn btn--whatsapp btn--block" onclick="App.enviarCarritoWhatsApp()">💬 Comprar por WhatsApp</button>
      </div>
    `;
  },

  actualizarUI() {
    const count = CartService.getTotalItems();
    const countEl = document.getElementById('cart-count');
    if (countEl) {
      countEl.textContent = count;
      countEl.style.display = count > 0 ? 'flex' : 'none';
    }
    this.renderCartSidebar();
  },

  /* ---------- CARRITO ACCIONES ---------- */
  openCart() {
    document.getElementById('cart-overlay')?.classList.add('cart-overlay--open');
    document.getElementById('cart-sidebar')?.classList.add('cart-sidebar--open');
    document.body.classList.add('no-scroll');
  },

  closeCart() {
    document.getElementById('cart-overlay')?.classList.remove('cart-overlay--open');
    document.getElementById('cart-sidebar')?.classList.remove('cart-sidebar--open');
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
    document.getElementById('checkout-modal')?.classList.add('modal-overlay--open');
    document.body.classList.add('no-scroll');
  },

  closeCheckout() {
    document.getElementById('checkout-modal')?.classList.remove('modal-overlay--open');
    document.body.classList.remove('no-scroll');
  },

  /* ---------- BÚSQUEDA ---------- */
  toggleSearch() {
    const overlay = document.getElementById('search-overlay');
    if (!overlay) return;
    overlay.classList.toggle('search-overlay--open');
    const btn = document.getElementById('search-btn');
    if (btn) btn.setAttribute('aria-expanded', overlay.classList.contains('search-overlay--open'));
    if (overlay.classList.contains('search-overlay--open')) {
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
      if (query.trim().length === 0) this.aplicarFiltros();
      return;
    }

    const results = SheetsService.buscarProductos(query);

    if (resultsEl && document.getElementById('search-overlay')?.classList.contains('search-overlay--open')) {
      if (results.length === 0) {
        resultsEl.innerHTML = '<div class="search__empty">No se encontraron productos</div>';
        return;
      }

      resultsEl.innerHTML = results.slice(0, 8).map(p => {
        const precioARS = SheetsService.calcularPrecioARS(p.precioUSD);
        return `
          <button class="search__result" onclick="App.toggleSearch(); App.scrollToProducts();" aria-label="${p.nombre} - ${SheetsService.formatPrecioARS(precioARS)}">
            <img class="search__result-img" src="${p.imagen}" alt="" loading="lazy"
                 onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2256%22 height=%2272%22><rect width=%2256%22 height=%2272%22 fill=%22%23eedbd8%22/></svg>'">
            <div class="search__result-info">
              <div class="search__result-name">${p.nombre}</div>
              <div class="search__result-price">${SheetsService.formatPrecioARS(precioARS)}</div>
            </div>
          </button>
        `;
      }).join('');
    } else {
      this.renderProductos(results);
    }
  },

  /* ---------- MENÚ MÓVIL ---------- */
  openMobileMenu() {
    document.getElementById('mobile-menu')?.classList.add('mobile-menu--open');
    document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('no-scroll');
  },

  closeMobileMenu() {
    document.getElementById('mobile-menu')?.classList.remove('mobile-menu--open');
    document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('no-scroll');
  },

  /* ---------- TOAST ---------- */
  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span aria-hidden="true">✨</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast--out');
      setTimeout(() => toast.remove(), 300);
    }, 2700);
  },

  /* ---------- LOADING ---------- */
  hideLoading() {
    const el = document.getElementById('loading-screen');
    if (el) {
      el.classList.add('loading-screen--hidden');
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
    if (btn) btn.href = `https://wa.me/${CONFIG.negocio.whatsapp}?text=${encodeURIComponent('Hola! Quiero consultar por sus productos.')}`;

    const footerWa = document.getElementById('footer-whatsapp-link');
    if (footerWa) footerWa.innerHTML = `📱 WhatsApp: <a href="https://wa.me/${CONFIG.negocio.whatsapp}" target="_blank" style="color:var(--pink-300);">Escribinos</a>`;

    const footerIg = document.getElementById('footer-instagram');
    if (footerIg && CONFIG.negocio.instagram) footerIg.href = `https://instagram.com/${CONFIG.negocio.instagram}`;
  },
};

/* ============================================
   EVENT LISTENERS (delegación)
   ============================================ */
document.addEventListener('DOMContentLoaded', () => App.init());

document.addEventListener('click', (e) => {
  /* Quick-add from product card */
  const quickBtn = e.target.closest('.product-card__quick');
  if (quickBtn) {
    const id = quickBtn.dataset.id;
    const producto = SheetsService.obtenerProducto(id);
    if (producto && producto.stock > 0) {
      CartService.addItem(producto);
      App.showToast(`Agregado: ${producto.nombre}`);
    }
    return;
  }

  /* Add to cart from product card (legacy fallback) */
  const addBtn = e.target.closest('.btn-add-cart');
  if (addBtn && !addBtn.disabled) {
    const id = addBtn.dataset.id;
    const producto = SheetsService.obtenerProducto(id);
    if (producto) {
      CartService.addItem(producto);
      App.showToast(`Agregado: ${producto.nombre}`);
    }
  }

  /* Cart close */
  if (e.target.closest('.icon-btn')?.id === 'cart-btn' || e.target.id === 'cart-overlay' || e.target.closest('.cart__header .icon-btn')) {
    App.closeCart();
  }

  /* Checkout close */
  if (e.target.id === 'checkout-modal' || e.target.closest('.modal__close')) {
    App.closeCheckout();
  }

  /* Cart qty controls */
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

  /* Cart remove */
  if (e.target.closest('.cart-item__remove') || e.target.closest('.btn-remove-item')) {
    const btn = e.target.closest('.cart-item__remove') || e.target.closest('.btn-remove-item');
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
    if (searchOverlay?.classList.contains('search-overlay--open')) App.toggleSearch();
  }
});