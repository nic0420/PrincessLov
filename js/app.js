/* ============================================================
   APP - PrincessLov Tienda Online (Zara/Mango Style)
   ============================================================ */

const App = {
  productosFiltrados: [],
  categoriaActual: 'todos',
  stockFilter: 'all',
  sortOrder: 'featured',

  async init() {
    try {
      this.applyCustomConfig?.();
      await SheetsService.cargarProductos();
      await SheetsService.obtenerCotizacion();

      CartService.init();
      CartService.onChange(() => this.actualizarUI());

      this.renderContenidoCustom?.();
      this.renderDolarTicker();
      this.renderSidebarFilters();
      this.renderCatBar();
      this.renderMegaMenu?.();
      this.renderShowcase?.();
      this.renderServicios?.();
      this.renderProductos(SheetsService.productos);
      this.renderCartSidebar();
      this.actualizarUI();
      this.setupWhatsAppLink();

      // Verificar retorno de Mercado Pago (back_url)
      CheckoutService.checkPaymentReturn?.();

      this.hideLoading();
    } catch (error) {
      console.error('[App] Error inicializando:', error);
      this.hideLoading();
    }
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
      <button class="filter-btn ${this.categoriaActual === 'todos' ? 'filter-btn--active' : ''}" onclick="App.filtrarCategoria('todos')" data-cat="todos">
        <span>Todos los productos</span>
        <span class="filter-btn__count">${SheetsService.productos.length}</span>
      </button>
      ${cats.map(cat => `
        <button class="filter-btn ${cat.id === this.categoriaActual ? 'filter-btn--active' : ''}" onclick="App.filtrarCategoria('${cat.id}')" data-cat="${cat.id}">
          <span>${cat.icon} ${cat.nombre}</span>
          <span class="filter-btn__count">${cat.count}</span>
        </button>
      `).join('')}
    `;
  },

  /* ---------- CATEGORY PILLS (horizontal scroll) ---------- */
  renderCatBar() {
    const container = document.getElementById('cat-pills');
    if (!container) return;

    const cats = SheetsService.obtenerCategoriasConConteo();

    // Keep "Todos" as first pill, then categories
    container.innerHTML = `
      <button class="cat-pill ${this.categoriaActual === 'todos' ? 'cat-pill--active' : ''}" onclick="App.filtrarCategoria('todos')" data-cat="todos" aria-pressed="${this.categoriaActual === 'todos'}">Todos</button>
      ${cats.map(cat => `
        <button class="cat-pill ${cat.id === this.categoriaActual ? 'cat-pill--active' : ''}" onclick="App.filtrarCategoria('${cat.id}')" data-cat="${cat.id}" aria-pressed="${cat.id === this.categoriaActual}">
          ${cat.icon} ${cat.nombre}
        </button>
      `).join('')}
    `;
  },

  /* ---------- IR A TODOS LOS PRODUCTOS ---------- */
  goAll() {
    this.filtrarCategoria('todos');
    this.setStockFilter('all');
    ComponentReveal.scrollToProducts();
  },

  /* ---------- SCROLL A PRODUCTOS ---------- */
  scrollToProducts() {
    ComponentReveal.scrollToProducts();
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

    // Sidebar filters
    document.querySelectorAll('#filter-categories .filter-btn').forEach(btn => {
      btn.classList.toggle('filter-btn--active', btn.dataset.cat === catId);
    });

    // Category bar pills
    document.querySelectorAll('.cat-pill').forEach(pill => {
      const active = pill.dataset.cat === catId;
      pill.classList.toggle('cat-pill--active', active);
      pill.setAttribute('aria-pressed', active);
    });

    // Section title
    const titleEl = document.getElementById('productos-title');
    if (titleEl) {
      if (catId === 'todos') titleEl.textContent = 'Todos los productos';
      else {
        const cat = SheetsService.obtenerCategoriasConConteo().find(c => c.id === catId);
        titleEl.textContent = cat ? cat.nombre : catId;
      }
    }

    this.aplicarFiltros();
  },

  setStockFilter(filter) {
    this.stockFilter = filter;
    document.querySelectorAll('#filter-stock .filter-btn').forEach(btn => {
      btn.classList.toggle('filter-btn--active', btn.dataset.filter === filter);
    });
    this.aplicarFiltros();
  },

  setSortOrder(order) {
    this.sortOrder = order;
    document.querySelectorAll('#filter-sort .filter-btn').forEach(btn => {
      btn.classList.toggle('filter-btn--active', btn.dataset.sort === order);
    });
    this.aplicarFiltros();
  },

  /* ---------- HEADER SEARCH ---------- */
  handleHeaderSearch(query) {
    // If user types in header search, open search overlay and delegate
    if (query && query.trim().length >= 2) {
      const overlay = document.getElementById('search-overlay');
      if (overlay && !overlay.classList.contains('search-overlay--open')) {
        this.toggleSearch();
      }
      const input = document.getElementById('search-input');
      if (input) input.value = query;
      this.handleSearch(query);
    } else if (query.trim().length === 0) {
      this.aplicarFiltros();
    }
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
      if (p.tags.includes('nuevo')) badge = '<span class="badge badge--new">Nuevo</span>';
      else if (p.tags.includes('oferta')) badge = '<span class="badge badge--sale">Oferta</span>';
      else if (sinStock) badge = '<span class="badge badge--low">Pocas unidades</span>';

      return `
        <article class="product-card" data-id="${p.id}" role="listitem" tabindex="0" onclick="App.openProductModal('${p.id}')">
          <div class="product-card__media">
            ${badge}
            <img class="product-card__image" src="${p.imagen}" alt="${p.nombre}"
                 loading="lazy"
                 onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22400%22><rect width=%22300%22 height=%22400%22 fill=%22%23eedbd8%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%239c684c%22 font-size=%2216%22>PrincessLov</text></svg>'">
            <button class="product-card__quick" data-id="${p.id}" aria-label="Agregar ${p.nombre} al carrito" ${sinStock ? 'disabled' : ''}>
              <span aria-hidden="true">🛒</span>
            </button>
          </div>
          <div class="product-card__info">
            <div class="product-card__cat">${p.categoriaOriginal}</div>
            <h3 class="product-card__name">${p.nombre}</h3>
            <div class="product-card__prices">
              <span class="price price--current">${SheetsService.formatPrecioARS(precioARS)}</span>
              <span class="price price--usd">USD ${p.precioUSD.toFixed(2)}</span>
            </div>
            <div class="product-card__stock ${sinStock ? 'product-card__stock--low' : ''}">
              ${sinStock ? '⚠️ Sin stock' : `Stock: ${p.stock} unidades`}
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Delegación quick-add (no abre modal)
    grid.querySelectorAll('.product-card__quick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        const id = btn.dataset.id;
        const producto = SheetsService.obtenerProducto(id);
        if (producto && producto.stock > 0) {
          CartService.addItem(producto);
          this.showToast(`Agregado: ${producto.nombre}`);
        }
      });
    });
  },

  /* ---------- PRODUCT DETAIL MODAL ---------- */
  openProductModal(productId) {
    const producto = SheetsService.obtenerProducto(productId);
    if (!producto) return;

    const modal = document.getElementById('product-modal');
    if (!modal) return;

    // Main image
    const mainImg = document.getElementById('product-modal-main-img');
    if (mainImg) {
      mainImg.src = producto.imagen;
      mainImg.alt = producto.nombre;
    }

    // Thumbnails
    const thumbsContainer = document.getElementById('product-modal-thumbs');
    if (thumbsContainer) {
      const images = [producto.imagen, ...(producto.galeria || []).map(g => g.url)].filter(Boolean);
      thumbsContainer.innerHTML = images.map((img, idx) => `
        <img class="product-modal__thumb ${idx === 0 ? 'active' : ''}" src="${img}" alt="${producto.nombre} - vista ${idx + 1}" 
             onclick="App.switchProductModalImage(this, '${img.replace(/'/g, "\\'")}')" loading="lazy">
      `).join('');
    }

    // Badges
    const badgesEl = document.getElementById('product-modal-badges');
    if (badgesEl) {
      const badges = [];
      if (producto.tags?.includes('nuevo')) badges.push('<span class="product-modal__badge product-modal__badge--new">Nuevo</span>');
      if (producto.tags?.includes('oferta')) badges.push('<span class="product-modal__badge product-modal__badge--oferta">Oferta</span>');
      if (producto.destacado) badges.push('<span class="product-modal__badge product-modal__badge--bestseller">Destacado</span>');
      badgesEl.innerHTML = badges.join('');
    }

    // Title
    const titleEl = document.getElementById('product-modal-title');
    if (titleEl) titleEl.textContent = producto.nombre;

    // SKU
    const skuEl = document.getElementById('product-modal-sku');
    if (skuEl) {
      if (producto.sku) {
        skuEl.textContent = `SKU: ${producto.sku}`;
      } else {
        skuEl.textContent = '';
      }
    }

    // Price
    const priceRowEl = document.getElementById('product-modal-price-row');
    if (priceRowEl) {
      const precioARS = producto.precioARSManual || SheetsService.calcularPrecioARS(producto.precioUSD);
      let priceHtml = `<span class="product-modal__price">${SheetsService.formatPrecioARS(precioARS)}</span>`;
      if (producto.precioOferta && producto.precioOferta < precioARS) {
        priceHtml = `<span class="product-modal__price-old">${SheetsService.formatPrecioARS(precioARS)}</span> <span class="product-modal__price">${SheetsService.formatPrecioARS(producto.precioOferta)}</span> <span class="product-modal__discount-badge">-${Math.round((1 - producto.precioOferta / precioARS) * 100)}%</span>`;
      }
      priceRowEl.innerHTML = priceHtml;
    }

    // Description
    const descEl = document.getElementById('product-modal-desc');
    if (descEl) descEl.textContent = producto.descripcion || 'Sin descripción disponible.';

    // Specs
    const specsEl = document.getElementById('product-modal-specs');
    const specsGridEl = document.getElementById('product-modal-specs-grid');
    if (specsEl && specsGridEl && producto.caracteristicas && Object.keys(producto.caracteristicas).length > 0) {
      specsGridEl.innerHTML = Object.entries(producto.caracteristicas).map(([key, value]) => `
        <div class="product-modal__spec-item">
          <span class="product-modal__spec-label">${key}</span>
          <span class="product-modal__spec-value">${value}</span>
        </div>
      `).join('');
      specsEl.style.display = 'block';
    } else if (specsEl) {
      specsEl.style.display = 'none';
    }

    // Variants
    const variantsEl = document.getElementById('product-modal-variants');
    const variantsContainerEl = document.getElementById('product-modal-variants-container');
    if (variantsEl && variantsContainerEl && producto.variantes && producto.variantes.length > 0) {
      // Group by color
      const colors = [...new Set(producto.variantes.map(v => v.color))];
      let html = '';
      colors.forEach((color, colorIdx) => {
        const variantsOfColor = producto.variantes.filter(v => v.color === color);
        const colorHex = variantsOfColor[0]?.colorHex || '#800020';
        html += `
          <div class="product-modal__variant-group">
            <div class="product-modal__variant-label" style="display:flex; align-items:center; gap:0.5rem;">
              <span style="width:16px;height:16px;border-radius:50%;background:${colorHex};border:1px solid var(--border);"></span>
              ${color}
            </div>
            <div class="product-modal__variant-options">
              ${variantsOfColor.map(v => `
                <button class="product-modal__variant-option ${v.stock <= 0 ? 'disabled' : ''}" 
                        data-color="${color}" data-talle="${v.talle}" data-stock="${v.stock}"
                        onclick="App.selectProductVariant(this)" ${v.stock <= 0 ? 'disabled' : ''}>
                  ${v.talle}
                  ${v.stock > 0 && v.stock <= 5 ? `<span style="font-size:0.65rem;color:#F59E0B;"> (${v.stock})</span>` : ''}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      });
      variantsContainerEl.innerHTML = html;
      variantsEl.style.display = 'block';
    } else if (variantsEl) {
      variantsEl.style.display = 'none';
    }

    // Stock info
    const stockInfoEl = document.getElementById('product-modal-stock-info');
    if (stockInfoEl) {
      const totalStock = (producto.variantes && producto.variantes.length > 0) 
        ? producto.variantes.reduce((s, v) => s + (v.stock || 0), 0) 
        : producto.stock;
      
      let stockClass = 'in-stock';
      let stockText = `Disponible: ${totalStock} unidades`;
      if (totalStock <= 0) { stockClass = 'out-stock'; stockText = 'Sin stock disponible'; }
      else if (totalStock <= 5) { stockClass = 'low-stock'; stockText = `¡Solo ${totalStock} unidades!`; }
      
      stockInfoEl.innerHTML = `<span class="product-modal__stock-info ${stockClass}">${stockText}</span>`;
    }

    // Store current product ID for add to cart
    modal.dataset.productId = producto.id;
    modal.dataset.selectedColor = '';
    modal.dataset.selectedTalle = '';

    // Open modal
    modal.classList.add('open');
    document.body.classList.add('no-scroll');
  },

  closeProductModal() {
    const modal = document.getElementById('product-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.dataset.productId = '';
      modal.dataset.selectedColor = '';
      modal.dataset.selectedTalle = '';
      document.body.classList.remove('no-scroll');
    }
  },

  switchProductModalImage(thumbEl, newSrc) {
    const mainImg = document.getElementById('product-modal-main-img');
    if (mainImg) mainImg.src = newSrc;
    document.querySelectorAll('.product-modal__thumb').forEach(t => t.classList.remove('active'));
    thumbEl.classList.add('active');
  },

  selectProductVariant(btn) {
    if (btn.classList.contains('disabled')) return;
    
    document.querySelectorAll('.product-modal__variant-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    
    const modal = document.getElementById('product-modal');
    modal.dataset.selectedColor = btn.dataset.color;
    modal.dataset.selectedTalle = btn.dataset.talle;
    
    // Update stock info
    const stock = parseInt(btn.dataset.stock) || 0;
    const stockInfoEl = document.getElementById('product-modal-stock-info');
    if (stockInfoEl) {
      let stockClass = 'in-stock';
      let stockText = `Stock para esta variante: ${stock} unidades`;
      if (stock <= 0) { stockClass = 'out-stock'; stockText = 'Esta variante sin stock'; }
      else if (stock <= 5) { stockClass = 'low-stock'; stockText = `¡Solo ${stock} unidades de esta variante!`; }
      stockInfoEl.innerHTML = `<span class="product-modal__stock-info ${stockClass}">${stockText}</span>`;
    }
  },

  addToCartFromModal() {
    const modal = document.getElementById('product-modal');
    const productId = modal?.dataset.productId;
    const selectedColor = modal?.dataset.selectedColor;
    const selectedTalle = modal?.dataset.selectedTalle;
    
    const producto = SheetsService.obtenerProducto(productId);
    if (!producto) return;

    // Check if product has variants and one is required
    if (producto.variantes && producto.variantes.length > 0) {
      if (!selectedColor || !selectedTalle) {
        this.showToast('Por favor seleccioná color y talle');
        return;
      }
      
      const variant = producto.variantes.find(v => v.color === selectedColor && v.talle === selectedTalle);
      if (!variant || variant.stock <= 0) {
        this.showToast('Variante sin stock');
        return;
      }
      
      // Add with variant info
      const itemWithVariant = { ...producto, _variant: { color: selectedColor, talle: selectedTalle } };
      CartService.addItem(itemWithVariant);
      this.showToast(`Agregado: ${producto.nombre} (${selectedColor} / ${selectedTalle})`);
    } else {
      // No variants
      if (producto.stock <= 0) {
        this.showToast('Sin stock');
        return;
      }
      CartService.addItem(producto);
      this.showToast(`Agregado: ${producto.nombre}`);
    }
    
    this.closeProductModal();
  },

  buyViaWhatsAppFromModal() {
    const modal = document.getElementById('product-modal');
    const productId = modal?.dataset.productId;
    const selectedColor = modal?.dataset.selectedColor;
    const selectedTalle = modal?.dataset.selectedTalle;
    
    const producto = SheetsService.obtenerProducto(productId);
    if (!producto) return;

    let variantText = '';
    if (producto.variantes && producto.variantes.length > 0) {
      if (!selectedColor || !selectedTalle) {
        this.showToast('Por favor seleccioná color y talle');
        return;
      }
      variantText = ` - Color: ${selectedColor}, Talle: ${selectedTalle}`;
    }

    const precioARS = producto.precioARSManual || SheetsService.calcularPrecioARS(producto.precioUSD);
    const texto = `Hola! Me interesa: ${producto.nombre}${variantText} - ${SheetsService.formatPrecioARS(precioARS)}`;
    const url = `https://wa.me/${CONFIG.negocio.whatsapp}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
    this.closeProductModal();
  },

  /* ---------- SIDEBAR DRAWER ---------- */
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

  /* ---------- CARRITO ---------- */
  renderCartSidebar() {
    const itemsContainer = document.getElementById('cart-items');
    const totalsEl = document.getElementById('cart-totals');
    const headerCountEl = document.getElementById('cart-header-count');
    const footerEl = document.getElementById('cart-footer');
    if (!itemsContainer) return;

    const items = CartService.items;

    // Header count
    if (headerCountEl) {
      headerCountEl.textContent = `${items.length} producto${items.length !== 1 ? 's' : ''}`;
    }

    if (items.length === 0) {
      itemsContainer.innerHTML = `
        <div class="cart__empty">
          <div class="cart__empty-illustration" aria-hidden="true"></div>
          <h4 class="cart__empty-title">Tu carrito está vacío</h4>
          <p class="cart__empty-desc">Agregá tus productos favoritos y completá tu compra en pocos pasos.</p>
          <button class="btn btn--primary cart__empty-btn" onclick="App.closeCart(); App.scrollToProducts();">Seguir comprando</button>
        </div>
      `;
      if (footerEl) footerEl.innerHTML = '';
      if (totalsEl) totalsEl.innerHTML = '';
      this.hidePromoShippingCrossSell();
      return;
    }

    // Render items with premium layout
    itemsContainer.innerHTML = items.map(item => {
      const producto = SheetsService.obtenerProducto(item.id);
      const stock = producto?.stock ?? 99;
      const lowStock = stock > 0 && stock <= 3;
      const priceARS = item.precioARS * item.cantidad;
      const discount = item.descuento || 0;

      return `
        <article class="cart-item" data-id="${item.id}" role="listitem">
          <div class="cart-item__media">
            <img class="cart-item__image" src="${item.imagen}" alt="${item.nombre}"
                 loading="lazy"
                 onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2272%22 height=%2296%22><rect width=%2272%22 height=%2296%22 fill=%22%23eedbd8%22/></svg>'">
            ${lowStock ? '<span class="cart-item__badge cart-item__badge--low">Pocas unidades</span>' : ''}
          </div>
          <div class="cart-item__details">
            <h4 class="cart-item__name">${item.nombre}</h4>
            ${item.variante ? `<p class="cart-item__variant">${item.variante}</p>` : ''}
            <div class="cart-item__price-row">
              <span class="cart-item__price">${SheetsService.formatPrecioARS(priceARS)}</span>
              ${discount ? `<span class="cart-item__discount">-${discount}%</span>` : ''}
            </div>
            <div class="cart-item__qty">
              <div class="qty-selector" role="group" aria-label="Cantidad de ${item.nombre}">
                <button class="qty-btn" data-action="minus" data-id="${item.id}" aria-label="Disminuir cantidad" ${item.cantidad <= 1 ? 'disabled' : ''}>−</button>
                <input type="number" class="qty-input" data-id="${item.id}" value="${item.cantidad}" min="1" max="${stock}" aria-label="Cantidad" readonly>
                <button class="qty-btn" data-action="plus" data-id="${item.id}" aria-label="Aumentar cantidad" ${item.cantidad >= stock ? 'disabled' : ''}>+</button>
              </div>
              <button class="cart-item__remove" data-action="remove" data-id="${item.id}" aria-label="Eliminar ${item.nombre}" title="Eliminar">
                <span aria-hidden="true">🗑️</span>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Totals breakdown
    const subtotal = CartService.getSubtotalARS();
    const shipping = CartService.getShippingCost() || 0;
    const discount = CartService.getDiscountAmount() || 0;
    const total = CartService.getTotalARS();
    const count = CartService.getTotalItems();
    const freeShippingThreshold = 150000; // $150k ARS
    const progress = Math.min((subtotal / freeShippingThreshold) * 100, 100);
    const remaining = Math.max(freeShippingThreshold - subtotal, 0);

    // Update free shipping progress
    const freeBarFill = document.getElementById('free-bar-fill');
    const freeText = document.getElementById('free-text');
    const freeAmount = document.getElementById('free-amount');
    if (freeBarFill) freeBarFill.style.width = `${progress}%`;
    if (freeAmount) freeAmount.textContent = SheetsService.formatPrecioARS(remaining);
    if (freeText) {
      if (remaining <= 0) {
        freeText.innerHTML = `¡Tenés <strong>envío gratis</strong>! 🎉`;
      } else {
        freeText.innerHTML = `Agregá <strong>${SheetsService.formatPrecioARS(remaining)}</strong> más para envío gratis`;
      }
    }

    // Totals breakdown
    if (totalsEl) {
      totalsEl.innerHTML = `
        <div class="cart__totals-row cart__totals-row--subtotal">
          <span class="cart__totals-label">Subtotal (<span id="totals-count">${count} item${count !== 1 ? 's' : ''}</span>)</span>
          <span>${SheetsService.formatPrecioARS(subtotal)}</span>
        </div>
        ${discount > 0 ? `
        <div class="cart__totals-row cart__totals-row--discount">
          <span class="cart__totals-label">Descuento</span>
          <span>−${SheetsService.formatPrecioARS(discount)}</span>
        </div>` : ''}
        <div class="cart__totals-row cart__totals-row--shipping">
          <span class="cart__totals-label">
            Envío
            <span class="cart__totals-tooltip" title="Calculado en el checkout según tu ubicación">ⓘ</span>
          </span>
          <span>${shipping > 0 ? SheetsService.formatPrecioARS(shipping) : 'Calcular'}</span>
        </div>
        <div class="cart__totals-row cart__totals-row--total">
          <span class="cart__totals-label">Total</span>
          <span>${SheetsService.formatPrecioARS(total)}</span>
        </div>
      `;
    }

    // Cross-sell recommendations
    this.renderCrossSell();

    // Re-bind quantity inputs (readonly but keyboard accessible)
    itemsContainer.querySelectorAll('.qty-input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      });
    });
  },

  actualizarUI() {
    const count = CartService.getTotalItems();
    const countEl = document.getElementById('cart-count');
    if (countEl) {
      countEl.textContent = count;
      countEl.style.display = count > 0 ? 'flex' : 'none';
    }
    const headerCountEl = document.getElementById('cart-header-count');
    if (headerCountEl) {
      headerCountEl.textContent = `${count} producto${count !== 1 ? 's' : ''}`;
    }
    this.renderCartSidebar();
  },

  /* ---------- CART ADVANCED FEATURES ---------- */

  togglePromo() {
    const promo = document.getElementById('cart-promo');
    const form = document.getElementById('promo-form');
    const toggle = promo?.querySelector('.cart__promo-toggle');
    if (!promo || !form) return;
    const open = form.style.display !== 'none';
    form.style.display = open ? 'none' : 'flex';
    promo.classList.toggle('cart__promo--open', !open);
    toggle?.setAttribute('aria-expanded', !open);
    if (!open) {
      setTimeout(() => document.getElementById('promo-input')?.focus(), 50);
    }
  },

  applyPromo(e) {
    e.preventDefault();
    const input = document.getElementById('promo-input');
    const messageEl = document.getElementById('promo-message');
    if (!input || !messageEl) return;
    const code = input.value.trim().toUpperCase();
    if (!code) return;

    // Simulated promo validation (replace with real API call)
    const validPromos = {
      'WELCOME10': { type: 'percent', value: 10, desc: '10% de descuento' },
      'ENVIOGRATIS': { type: 'shipping', value: 0, desc: 'Envío gratis' },
      'PRINCESS20': { type: 'percent', value: 20, desc: '20% de descuento' }
    };

    const promo = validPromos[code];
    if (promo) {
      CartService.applyPromo(code, promo);
      messageEl.textContent = `✓ ${promo.desc} aplicado`;
      messageEl.className = 'cart__promo-message cart__promo-message--success';
      input.value = '';
      this.renderCartSidebar();
    } else {
      messageEl.textContent = '✗ Código inválido o expirado';
      messageEl.className = 'cart__promo-message cart__promo-message--error';
    }
  },

  calculateShipping(e) {
    e.preventDefault();
    const zip = document.getElementById('shipping-zip')?.value.trim();
    const city = document.getElementById('shipping-city')?.value.trim();
    const resultEl = document.getElementById('shipping-result');
    if (!zip || !city || !resultEl) return;

    // Simulated shipping calculation
    const envio = CONFIG.envios.find(e => e.id === 'correo_argentino') || CONFIG.envios[3];
    const cost = envio.precio;

    CartService.setShipping(envio.id, cost);
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <strong>Opciones para ${city} (${zip}):</strong>
      <div style="margin-top:8px; display:flex; flex-direction:column; gap:8px;">
        ${CONFIG.envios.filter(e => e.activo).map(e => `
          <div class="cart__shipping-option" data-shipping="${e.id}">
            <div class="cart__shipping-option-label">
              <span class="cart__shipping-option-name">${e.nombre}</span>
              <span class="cart__shipping-option-desc">${e.descripcion}</span>
            </div>
            <span class="cart__shipping-option-price">${e.precio > 0 ? SheetsService.formatPrecioARS(e.precio) : 'Gratis'}</span>
          </div>
        `).join('')}
      </div>
    `;
    this.renderCartSidebar();
  },

  renderCrossSell() {
    const grid = document.getElementById('cross-sell-grid');
    const section = document.getElementById('cart-cross-sell');
    if (!grid || !section) return;

    const items = CartService.items;
    const currentIds = new Set(items.map(i => i.id));
    const allProducts = SheetsService.productos.filter(p => p.stock > 0 && !currentIds.has(p.id));
    const recommended = allProducts
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);

    if (recommended.length === 0) {
      section.style.display = 'none';
      return;
    }

    grid.innerHTML = recommended.map(p => {
      const precioARS = SheetsService.calcularPrecioARS(p.precioUSD);
      return `
        <button class="cart__cross-sell-item" onclick="CartService.addItem(SheetsService.obtenerProducto('${p.id}')); App.showToast('Agregado: ${p.nombre}');" aria-label="Agregar ${p.nombre} - ${SheetsService.formatPrecioARS(precioARS)}">
          <img class="cart__cross-sell-img" src="${p.imagen}" alt="" loading="lazy"
               onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2256%22 height=%2256%22><rect width=%2256%22 height=%2256%22 fill=%22%23eedbd8%22/></svg>'">
          <div class="cart__cross-sell-info">
            <span class="cart__cross-sell-name">${p.nombre}</span>
            <span class="cart__cross-sell-price">${SheetsService.formatPrecioARS(precioARS)}</span>
          </div>
        </button>
      `;
    }).join('');

    section.style.display = 'block';
  },

  hidePromoShippingCrossSell() {
    const promoForm = document.getElementById('promo-form');
    const promoMsg = document.getElementById('promo-message');
    const shippingRes = document.getElementById('shipping-result');
    const crossSell = document.getElementById('cart-cross-sell');
    const promo = document.getElementById('cart-promo');
    if (promo) promo.classList.remove('cart__promo--open');
    if (promoForm) promoForm.style.display = 'none';
    if (promoMsg) promoMsg.textContent = '';
    if (shippingRes) shippingRes.style.display = 'none';
    if (crossSell) crossSell.style.display = 'none';
  },

  selectShipping(shippingId) {
    const envio = CONFIG.envios.find(e => e.id === shippingId);
    if (envio) {
      CartService.setShipping(envio.id, envio.precio);
      this.renderCartSidebar();
    }
  },

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
    if (CartService.items.length === 0) { this.showToast('El carrito está vacío'); return; }
    const envio = CONFIG.envios.find(e => e.id === 'retiro');
    CartService.enviarWhatsApp(envio, null);
    this.closeCart();
  },

  /* ---------- CHECKOUT ---------- */
  openCheckout() {
    if (CartService.items.length === 0) { this.showToast('El carrito está vacío'); return; }
    this.closeCart();
    CheckoutService.renderCheckout();
    document.getElementById('checkout-modal')?.classList.add('modal-overlay--open');
    document.body.classList.add('no-scroll');
  },

  closeCheckout() {
    document.getElementById('checkout-modal')?.classList.remove('modal-overlay--open');
    document.body.classList.remove('no-scroll');
  },

  /* ---------- SEARCH OVERLAY ---------- */
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
          <button class="search__result" onclick="App.toggleSearch(); App.openProductModal('${p.id}');" aria-label="${p.nombre} - ${SheetsService.formatPrecioARS(precioARS)}">
            <img class="search__result-img" src="${p.imagen}" alt="" loading="lazy" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2264%22><rect width=%2248%22 height=%2264%22 fill=%22%23eedbd8%22/></svg>'">
            <div>
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

  /* ---------- MOBILE MENU ---------- */
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
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  },

  /* ---------- LOADING ---------- */
  hideLoading() {
    const el = document.getElementById('loading-screen');
    if (el) {
      el.classList.add('loading-screen--hidden');
      setTimeout(() => el.remove(), 500);
    }
  },

  /* ---------- WHATSAPP ---------- */
  setupWhatsAppLink() {
    const btn = document.getElementById('contacto-whatsapp-btn');
    if (btn) btn.href = `https://wa.me/${CONFIG.negocio.whatsapp}?text=${encodeURIComponent('Hola! Quiero consultar por sus productos.')}`;
    const footerWa = document.getElementById('footer-whatsapp-link');
    if (footerWa) footerWa.innerHTML = `📱 WhatsApp: <a href="https://wa.me/${CONFIG.negocio.whatsapp}" target="_blank" style="color:var(--primary);">Escribinos</a>`;
    const footerIg = document.getElementById('footer-instagram');
    if (footerIg && CONFIG.negocio.instagram) footerIg.href = `https://instagram.com/${CONFIG.negocio.instagram}`;
    this.renderFooterCats();
  },

  /* ---------- FOOTER CATEGORÍAS ---------- */
  renderFooterCats() {
    const el = document.getElementById('footer-cats');
    if (!el) return;
    const cats = SheetsService.obtenerCategoriasConConteo().slice(0, 6);
    el.innerHTML = cats.map(cat => `
      <li><a href="#productos" class="footer__link" onclick="App.filtrarCategoria('${cat.id}'); return false;">${cat.nombre}</a></li>
    `).join('');
  },

  /* ---------- NEWSLETTER ---------- */
  subscribeNewsletter(e) {
    e.preventDefault();
    const input = document.getElementById('newsletter-email');
    const msg = document.getElementById('newsletter-msg');
    const email = input?.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (msg) {
        msg.textContent = 'Ingresá un correo válido.';
        msg.className = 'newsletter__msg newsletter__msg--error';
      }
      return;
    }
    // Guardar suscriptores en localStorage (fallback) y en Sheets si está configurado
    try {
      const subs = JSON.parse(localStorage.getItem('pl_newsletter') || '[]');
      if (!subs.includes(email)) {
        subs.push(email);
        localStorage.setItem('pl_newsletter', JSON.stringify(subs));
      }
      if (SheetsService.postToAppsScript) {
        SheetsService.postToAppsScript('subscribe_newsletter', { email }).catch(() => {});
      }
    } catch (err) { console.warn('Newsletter:', err); }

    if (msg) {
      msg.textContent = '¡Gracias por suscribirte! Te avisaremos de las novedades. 💕';
      msg.className = 'newsletter__msg newsletter__msg--success';
    }
    if (input) input.value = '';
  },

  /* ---------- CONTENIDO EDITABLE (categorías + frases) ---------- */
  applyCustomConfig() {
    try {
      const cats = localStorage.getItem('pl_admin_categorias');
      if (cats) { const arr = JSON.parse(cats); if (Array.isArray(arr) && arr.length) CONFIG.categorias = arr; }
      const contRaw = localStorage.getItem('pl_admin_contenido');
      if (contRaw) {
        const obj = JSON.parse(contRaw);
        if (obj && typeof obj === 'object') {
          const base = CONFIG.contenido || {};
          CONFIG.contenido = { ...base, ...obj };
          // arrays/objetos anidados: si custom trae valor, usa custom, sino base
          if (obj.promoBar) CONFIG.contenido.promoBar = obj.promoBar;
          if (obj.hero) CONFIG.contenido.hero = obj.hero;
          if (obj.showcase) CONFIG.contenido.showcase = obj.showcase;
          if (obj.servicios) CONFIG.contenido.servicios = obj.servicios;
          if (obj.promoBand) CONFIG.contenido.promoBand = obj.promoBand;
          if (obj.cta) CONFIG.contenido.cta = obj.cta;
          if (obj.newsletter) CONFIG.contenido.newsletter = obj.newsletter;
          if (obj.footer) CONFIG.contenido.footer = obj.footer;
        }
      }
    } catch (e) { console.warn('[App] custom config', e); }
  },

  renderContenidoCustom() {
    const c = CONFIG.contenido; if (!c) return;
    try {
      // Promo bar (3 frases)
      if (c.promoBar && Array.isArray(c.promoBar)) {
        const slides = document.querySelectorAll('.promo-bar__slide');
        c.promoBar.forEach((txt, i) => { if (slides[i]) slides[i].textContent = txt; });
      }
      // Hero (3 slides)
      if (c.hero && Array.isArray(c.hero)) {
        const slides = document.querySelectorAll('.hero__slide');
        c.hero.forEach((h, i) => {
          const s = slides[i]; if (!s) return;
          const kicker = s.querySelector('.hero__kicker'); if (kicker && h.kicker) kicker.textContent = h.kicker;
          const title = s.querySelector('.hero__title'); if (title && h.title) title.textContent = h.title;
          const desc = s.querySelector('.hero__desc'); if (desc && h.desc) desc.textContent = h.desc;
          const cta = s.querySelector('.hero__cta'); if (cta) { if (h.cta) cta.textContent = h.cta; if (h.categoria) cta.setAttribute('onclick', `App.filtrarCategoria('${h.categoria}'); scrollToProducts(); return false;`); }
          const img = s.querySelector('.hero__media img'); if (img && h.image) img.src = h.image;
        });
      }
      // Showcase
      if (c.showcase) {
        const kicker = document.querySelector('.cat-showcase .sec-head__kicker'); if (kicker && c.showcase.kicker) kicker.textContent = c.showcase.kicker;
        const title = document.querySelector('.cat-showcase .sec-head__title'); if (title && c.showcase.title) title.textContent = c.showcase.title;
      }
      // Servicios
      if (c.servicios) {
        const sk = document.querySelector('.services .sec-head__kicker'); if (sk && c.servicios.kicker) sk.textContent = c.servicios.kicker;
        const st = document.querySelector('.services .sec-head__title'); if (st && c.servicios.title) st.textContent = c.servicios.title;
        if (c.servicios.items) {
          const cards = document.querySelectorAll('.service-card');
          c.servicios.items.forEach((it, i) => {
            const card = cards[i]; if (!card) return;
            const ic = card.querySelector('.service-card__icon'); if (ic && it.icon) ic.textContent = it.icon;
            const ti = card.querySelector('.service-card__title'); if (ti && it.title) ti.textContent = it.title;
            const de = card.querySelector('.service-card__desc'); if (de && it.desc) de.textContent = it.desc;
          });
        }
      }
      // Promo band
      if (c.promoBand) {
        const pk = document.querySelector('.promo-band__kicker'); if (pk && c.promoBand.kicker) pk.textContent = c.promoBand.kicker;
        const pt = document.querySelector('.promo-band__title'); if (pt && c.promoBand.title) pt.textContent = c.promoBand.title;
        const pd = document.querySelector('.promo-band__desc'); if (pd && c.promoBand.desc) pd.textContent = c.promoBand.desc;
        const pc = document.querySelector('.promo-band__cta'); if (pc) { if (c.promoBand.cta) pc.textContent = c.promoBand.cta; if (c.promoBand.categoria) pc.setAttribute('onclick', `App.filtrarCategoria('${c.promoBand.categoria}'); scrollToProducts(); return false;`); }
        const pi = document.querySelector('.promo-band__img img'); if (pi && c.promoBand.image) pi.src = c.promoBand.image;
      }
      // CTA
      if (c.cta) {
        const ct = document.querySelector('.cta__title'); if (ct && c.cta.title) ct.textContent = c.cta.title;
        const cd = document.querySelector('.cta__desc'); if (cd && c.cta.desc) cd.textContent = c.cta.desc;
        const cb = document.querySelector('.cta__btn'); if (cb) { if (c.cta.btn) cb.lastChild.textContent = ' ' + c.cta.btn; const ic = cb.querySelector('span'); if (ic && c.cta.icon) ic.textContent = c.cta.icon; }
      }
      // Newsletter
      if (c.newsletter) {
        const nt = document.querySelector('.newsletter__title'); if (nt && c.newsletter.title) nt.textContent = c.newsletter.title;
        const nd = document.querySelector('.newsletter__desc'); if (nd && c.newsletter.desc) nd.textContent = c.newsletter.desc;
        const nb = document.querySelector('.newsletter__btn'); if (nb && c.newsletter.btn) nb.textContent = c.newsletter.btn;
        const ni = document.querySelector('.newsletter__input'); if (ni && c.newsletter.placeholder) ni.placeholder = c.newsletter.placeholder;
      }
      // Footer tagline
      if (c.footer?.tagline) { const ft = document.querySelector('.footer__tagline'); if (ft) ft.textContent = c.footer.tagline; }
    } catch (e) { console.warn('[App] renderContenidoCustom', e); }
  },

  renderMegaMenu() {
    const nav = document.getElementById('mega-mujer'); if (!nav) return;
    const cats = (typeof AdminData !== 'undefined' && AdminData.getEffectiveCategorias) ? AdminData.getEffectiveCategorias() : (CONFIG.categorias || []);
    const grouped = {};
    cats.forEach(c => { if (c.id === 'todos') return; if (!grouped[c.grupo]) grouped[c.grupo] = []; grouped[c.grupo].push(c); });
    const gruposOrden = Object.keys(grouped);
    // Construir columnas por grupo (máx 2 columnas + promo)
    let html = '';
    gruposOrden.slice(0,2).forEach(grupo => {
      html += `<div class="mega-menu__col"><h4 class="mega-menu__heading">${grupo}</h4>`;
      grouped[grupo].forEach(cat => { html += `<a href="#productos" class="mega-menu__link" onclick="App.filtrarCategoria('${cat.id}')">${cat.icon ? cat.icon + ' ' : ''}${cat.nombre}</a>`; });
      html += `</div>`;
    });
    // Columna promo (ofertas u última)
    const promoCat = cats.find(c=>c.id==='ofertas') || cats[cats.length-1];
    html += `<div class="mega-menu__col mega-menu__col--promo"><a href="#productos" class="mega-menu__promo" onclick="App.filtrarCategoria('${promoCat.id}')"><img src="assets/conjunto-deportivo-borgona.jpg" alt=""><span class="mega-menu__promo-label">${promoCat.nombre}</span></a></div>`;
    nav.innerHTML = html;
  },

  renderShowcase() {
    const grid = document.querySelector('.cat-showcase__grid'); if (!grid) return;
    const cont = CONFIG.contenido?.showcase;
    const cards = cont?.cards || [];
    if (!cards.length) return;
    // Si hay contenido custom, renderizar desde él; sino mantener HTML estático
    const hasCustom = localStorage.getItem('pl_admin_contenido');
    if (!hasCustom) return;
    grid.innerHTML = cards.map((card, idx) => {
      const large = idx === 0 ? ' cat-card--large' : '';
      const cat = card.categoria || 'todos';
      const img = card.image || 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="700"><rect width="600" height="700" fill="#eedbd8"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#9c684c" font-size="20">${card.title}</text></svg>`);
      const icon = card.icon ? `<span class="cat-card__icon" aria-hidden="true">${card.icon}</span>` : '';
      return `<a href="#productos" class="cat-card${large}" onclick="App.filtrarCategoria('${cat}'); ComponentReveal.scrollToProducts(); return false;" data-reveal><img src="${img}" alt="${card.title}"><div class="cat-card__overlay">${icon}<h3 class="cat-card__title">${card.title}</h3><span class="cat-card__link-under">Comprar →</span></div></a>`;
    }).join('');
  },

  renderServicios() { /* ya manejado en renderContenidoCustom */ },
};

/* ============================================
   EVENT LISTENERS
   ============================================ */
document.addEventListener('DOMContentLoaded', () => App.init());

document.addEventListener('click', (e) => {
  /* Quick-add from product card */
  const quickBtn = e.target.closest('.product-card__quick');
  if (quickBtn) {
    if (quickBtn.disabled) return;
    const id = quickBtn.dataset.id;
    const producto = SheetsService.obtenerProducto(id);
    if (producto && producto.stock > 0) {
      CartService.addItem(producto);
      App.showToast(`Agregado: ${producto.nombre}`);
    }
    return;
  }

  /* Cart open/close */
  if (e.target.closest('#cart-btn')) { App.openCart(); return; }
  if (e.target.id === 'cart-overlay' || e.target.closest('.cart__close')) { App.closeCart(); return; }

  /* Checkout close */
  if (e.target.id === 'checkout-modal' || e.target.closest('.modal__close')) { App.closeCheckout(); return; }

  /* Mobile menu */
  if (e.target.closest('#menu-btn')) { App.openMobileMenu(); return; }

  /* Promo toggle */
  if (e.target.closest('.cart__promo-toggle')) { App.togglePromo(); return; }

  /* Promo form submit */
  if (e.target.closest('#promo-form')) { return; } // handled by onsubmit

  /* Shipping form submit */
  if (e.target.closest('#shipping-form')) { return; } // handled by onsubmit

  /* Shipping option selection */
  const shippingOpt = e.target.closest('.cart__shipping-option[data-shipping]');
  if (shippingOpt) {
    App.selectShipping(shippingOpt.dataset.shipping);
    return;
  }

  /* Cross-sell add */
  if (e.target.closest('.cart__cross-sell-item')) { return; } // handled by onclick

  /* Cart qty */
  if (e.target.closest('.qty-btn')) {
    const btn = e.target.closest('.qty-btn');
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const item = CartService.items.find(i => i.id === id);
    if (item) {
      if (action === 'plus') CartService.updateQuantity(id, item.cantidad + 1);
      else if (action === 'minus') CartService.updateQuantity(id, item.cantidad - 1);
    }
    return;
  }

  /* Cart remove */
  if (e.target.closest('.cart-item__remove')) {
    const id = e.target.closest('.cart-item__remove').dataset.id;
    const itemEl = document.querySelector(`.cart-item[data-id="${id}"]`);
    if (itemEl) itemEl.classList.add('cart-item--removing');
    setTimeout(() => CartService.removeItem(id), 200);
    return;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    App.closeCart();
    App.closeCheckout();
    App.closeMobileMenu();
    App.closeSidebar();
    App.closeProductModal();
    const so = document.getElementById('search-overlay');
    if (so?.classList.contains('search-overlay--open')) App.toggleSearch();
  }
});