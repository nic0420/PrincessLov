/* ============================================
   APP - PrincessLov Tienda Online
   ============================================ */

const App = {
  productosFiltrados: [],
  categoriaActual: 'todos',

  async init() {
    try {
      await SheetsService.cargarProductos();
      await SheetsService.obtenerCotizacion();

      CartService.init();
      CartService.onChange(() => this.actualizarUI());

      this.renderDolarTicker();
      this.renderCategorias();
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

  /* ---------- CATEGORÍAS ---------- */
  renderCategorias() {
    const grid = document.getElementById('categorias-grid');
    if (!grid) return;

    const cats = SheetsService.obtenerCategoriasConConteo();

    grid.innerHTML = cats.map(cat => `
      <div class="cat-card ${cat.id === this.categoriaActual ? 'active' : ''}" data-cat="${cat.id}" onclick="App.filtrarCategoria('${cat.id}')">
        <div class="cat-icon">${cat.icon}</div>
        <div class="cat-name">${cat.nombre}</div>
        <div class="cat-count">${cat.count} producto${cat.count !== 1 ? 's' : ''}</div>
      </div>
    `).join('');
  },

  /* ---------- PRODUCTOS ---------- */
  renderProductos(productos) {
    const grid = document.getElementById('productos-grid');
    const countEl = document.getElementById('productos-count');
    if (!grid) return;

    this.productosFiltrados = productos;

    if (countEl) {
      countEl.textContent = `${productos.length} producto${productos.length !== 1 ? 's' : ''} encontrado${productos.length !== 1 ? 's' : ''}`;
    }

    if (productos.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--texto-secundario);">
          <div style="font-size:3rem; margin-bottom:1rem;">📦</div>
          <p style="font-size:1.1rem; font-weight:600;">No se encontraron productos</p>
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
                 onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22350%22><rect width=%22300%22 height=%22350%22 fill=%22%23F8D0DC%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23800020%22 font-size=%2216%22>Sin imagen</text></svg>'">
          </div>
          <div class="producto-info">
            <div class="producto-categoria">${p.categoriaOriginal}</div>
            <div class="producto-nombre">${p.nombre}</div>
            <div class="producto-desc">${p.descripcion}</div>
            <div class="producto-precios">
              <span class="precio-ars">${SheetsService.formatPrecioARS(precioARS)}</span>
              <span class="precio-usd">USD ${p.precioUSD.toFixed(2)}</span>
            </div>
            <div class="producto-stock" style="color: ${sinStock ? '#d32f2f' : 'var(--gris-400)'}; ${sinStock ? 'font-weight:600;' : ''}">
              ${sinStock ? 'Sin stock' : `Stock: ${p.stock} unidades`}
            </div>
            <div class="producto-actions">
              <button class="btn-add-cart" data-id="${p.id}" ${sinStock ? 'disabled' : ''}>
                ${sinStock ? 'Sin stock' : '🛒 Agregar'}
              </button>
              <a class="btn-whatsapp-quick"
                 href="https://wa.me/${CONFIG.negocio.whatsapp}?text=${encodeURIComponent('Hola! Me interesa: ' + p.nombre + ' - ' + SheetsService.formatPrecioARS(precioARS))}"
                 target="_blank" title="Consultar por WhatsApp">
                💬
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  filtrarCategoria(catId) {
    this.categoriaActual = catId;
    const productos = SheetsService.filtrarPorCategoria(catId);

    document.querySelectorAll('.cat-card').forEach(card => {
      card.classList.toggle('active', card.dataset.cat === catId);
    });

    this.renderProductos(productos);
    this.scrollToProducts();
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
          <p style="font-size:1.1rem; font-weight:600;">Tu carrito está vacío</p>
          <p style="font-size:0.85rem; margin-top:0.5rem;">Agregá productos para comenzar tu compra</p>
        </div>
      `;
      footerEl.innerHTML = '';
      return;
    }

    itemsContainer.innerHTML = items.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <img class="cart-item-img" src="${item.imagen}" alt="${item.nombre}"
             onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2270%22 height=%2280%22><rect width=%2270%22 height=%2280%22 fill=%22%23F8D0DC%22/></svg>'">
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
    if (!resultsEl) return;

    if (!query || query.trim().length < 2) {
      resultsEl.innerHTML = '';
      return;
    }

    const results = SheetsService.buscarProductos(query);

    if (results.length === 0) {
      resultsEl.innerHTML = '<p style="text-align:center; padding:1rem; color:var(--texto-secundario);">No se encontraron productos</p>';
      return;
    }

    resultsEl.innerHTML = results.slice(0, 8).map(p => {
      const precioARS = SheetsService.calcularPrecioARS(p.precioUSD);
      return `
        <div class="search-result-item" onclick="App.toggleSearch(); App.scrollToProducts();">
          <img class="search-result-img" src="${p.imagen}" alt="${p.nombre}"
               onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22><rect width=%2250%22 height=%2250%22 fill=%22%23F8D0DC%22/></svg>'">
          <div>
            <div class="search-result-name">${p.nombre}</div>
            <div class="search-result-price">${SheetsService.formatPrecioARS(precioARS)}</div>
          </div>
        </div>
      `;
    }).join('');
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
    toast.innerHTML = `<span>✅</span> ${message}`;
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
      footerWa.innerHTML = `📱 WhatsApp: <a href="https://wa.me/${CONFIG.negocio.whatsapp}" target="_blank" style="color:var(--rosa-300);">Escribinos</a>`;
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
    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay?.classList.contains('open')) {
      App.toggleSearch();
    }
  }
});
