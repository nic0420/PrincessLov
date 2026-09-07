/* ============================================
   CLUB PRINCE — Landing, cajas y lead gen
   Form: Nombre, Teléfono, Ciudad -> POST a Apps Script sheet ClubPrince_Leads
   Checkout: si carrito tiene club-prince, WhatsApp inicia con "Yanela del club Prince quiero esto"
   ============================================ */

const ClubPrince = {
  endpoint() {
    return (typeof CONFIG !== 'undefined' && CONFIG.sheets?.appsScriptUrl) ? CONFIG.sheets.appsScriptUrl : null;
  },

  init() {
    const form = document.getElementById('club-prince-form');
    if (form) form.addEventListener('submit', (e) => this.onSubmit(e));
    this.renderBoxesFromConfig();
    // Escucha actualizaciones de contenido editable (admin)
    window.addEventListener('contenido:updated', () => this.renderBoxesFromConfig());
  },

  renderBoxesFromConfig() {
    const cfg = (typeof CONFIG !== 'undefined' && CONFIG.contenido?.clubPrince) ? CONFIG.contenido.clubPrince : null;
    if (!cfg) return;
    // Head
    const b = document.getElementById('club-badge'); if (b && cfg.badge) b.textContent = cfg.badge;
    const t = document.getElementById('club-title-accent'); if (t && cfg.titleAccent) t.textContent = cfg.titleAccent;
    const ti = document.getElementById('club-title'); if (ti && cfg.title) ti.firstChild.textContent = cfg.title + ' ';
    const sub = document.getElementById('club-subtitle'); if (sub && cfg.subtitle) sub.textContent = cfg.subtitle;
    const desc = document.getElementById('club-desc'); if (desc && cfg.desc) desc.textContent = cfg.desc;
    const ft = document.getElementById('club-form-title'); if (ft && cfg.formTitle) ft.textContent = cfg.formTitle;
    const fd = document.getElementById('club-form-desc'); if (fd && cfg.formDesc) fd.textContent = cfg.formDesc;
    if (cfg.benefits && Array.isArray(cfg.benefits)) {
      const ben = document.getElementById('club-benefits');
      if (ben) ben.innerHTML = cfg.benefits.map((b,i)=> `${i?'<span class="dot">·</span>':''}<span>${this.esc(b)}</span>`).join('');
    }
    // Boxes: actualizar precios/nombres si hay config
    if (cfg.boxes && Array.isArray(cfg.boxes)) {
      const wrap = document.getElementById('club-boxes');
      if (wrap) {
        // Si la cantidad de boxes cambió, re-render completo
        if (wrap.children.length !== cfg.boxes.length) {
          wrap.innerHTML = cfg.boxes.map((box,i) => {
            const feat = box.destacado ? ' club-box--featured' : '';
            const btnClass = box.destacado ? 'btn--primary' : 'btn--dark';
            return `<article class="club-box${feat}" data-box="${this.esc(box.id)}">
              <div class="club-box__stripe" aria-hidden="true"></div>
              <div class="club-box__icon">${this.esc(box.icon||'🎀')}</div>
              <span class="club-box__tag">${this.esc(box.tag||'')}</span>
              <h3 class="club-box__name">${this.esc(box.nombre)}</h3>
              <p class="club-box__meta">${this.esc(box.desc||'')}</p>
              <div class="club-box__price" data-price-usd="${box.precioUSD}">Cargando precio…</div>
              <button class="btn ${btnClass} btn--block" onclick="ClubPrince.addBoxToCart('${this.esc(box.id)}')">Agregar al carrito</button>
            </article>`;
          }).join('');
        } else {
          // Update in place
          cfg.boxes.forEach((box) => {
            const el = wrap.querySelector(`[data-box="${box.id}"]`);
            if (!el) return;
            const nameEl = el.querySelector('.club-box__name'); if (nameEl) nameEl.textContent = box.nombre;
            const metaEl = el.querySelector('.club-box__meta'); if (metaEl) metaEl.textContent = box.desc || '';
            const tagEl = el.querySelector('.club-box__tag'); if (tagEl) tagEl.textContent = box.tag || '';
            const iconEl = el.querySelector('.club-box__icon'); if (iconEl) iconEl.textContent = box.icon || '🎀';
            const priceEl = el.querySelector('.club-box__price'); if (priceEl) { priceEl.dataset.priceUsd = box.precioUSD; priceEl.textContent = 'Cargando precio…'; }
            if (box.destacado) el.classList.add('club-box--featured'); else el.classList.remove('club-box--featured');
          });
        }
        this.updateBoxPricesARS();
      }
    }
  },

  updateBoxPricesARS() {
    if (typeof SheetsService === 'undefined' || !SheetsService.cotizacionDolar) return;
    document.querySelectorAll('.club-box__price[data-price-usd]').forEach(el=>{
      const usd = parseFloat(el.dataset.priceUsd)||0;
      if (!usd) return;
      try {
        const ars = SheetsService.calcularPrecioARS ? SheetsService.calcularPrecioARS(usd) : Math.round(usd * SheetsService.cotizacionDolar * 1.3);
        const arsTxt = SheetsService.formatPrecioARS ? SheetsService.formatPrecioARS(ars) : `$ ${ars.toLocaleString('es-AR')}`;
        el.textContent = arsTxt;
      } catch {}
    });
  },

  addBoxToCart(boxId) {
    const cfg = CONFIG.contenido?.clubPrince;
    const box = cfg?.boxes?.find(b=>b.id===boxId);
    if (!box) { if (typeof App !== 'undefined') App.showToast('Caja no encontrada'); return; }
    // Crear producto virtual Club Prince (se marca como categoría club-prince para la lógica condicional de WhatsApp)
    const producto = {
      id: box.id,
      nombre: `Club Prince — ${box.nombre}`,
      descripcion: box.desc || '',
      categoria: 'club-prince',
      categoriaOriginal: 'Club Prince',
      precioUSD: box.precioUSD,
      precioARSManual: null,
      imagen: CONFIG.imagenes?.placeholder || '',
      stock: 999,
      activo: true,
      isClubPrince: true,
      tags: ['club-prince','club','suscripcion'],
      variantes: [],
    };
    if (typeof CartService !== 'undefined') {
      CartService.addItem(producto);
      if (typeof App !== 'undefined' && App.openCart) App.openCart();
    }
  },

  async onSubmit(e) {
    e.preventDefault();
    const nombre = document.getElementById('club-nombre')?.value.trim();
    const telefono = document.getElementById('club-telefono')?.value.trim();
    const ciudad = document.getElementById('club-ciudad')?.value.trim();
    const msgEl = document.getElementById('club-form-msg');
    const btn = document.getElementById('club-submit-btn');

    const setMsg = (t, ok) => {
      if (!msgEl) return;
      msgEl.textContent = t;
      msgEl.className = 'club-prince__form-msg ' + (ok ? 'club-prince__form-msg--ok' : 'club-prince__form-msg--err');
    };

    if (!nombre || !telefono || !ciudad) { setMsg('Completá nombre, teléfono y ciudad.', false); return; }
    if (telefono.replace(/\D/g,'').length < 8) { setMsg('Revisá el teléfono.', false); return; }

    if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }

    const payload = { action: 'club_prince_lead', lead: { nombre, telefono, ciudad, origen: 'Club Prince Web', estado: 'nuevo' } };
    // Fallback local (siempre guardar localmente además del Sheets)
    try {
      const local = JSON.parse(localStorage.getItem('pl_clubprince_leads') || '[]');
      local.push({ id: `club_${Date.now()}`, fecha: new Date().toISOString(), ...payload.lead });
      localStorage.setItem('pl_clubprince_leads', JSON.stringify(local));
    } catch {}

    const url = this.endpoint();
    // Si no hay endpoint configurado, igual mostrar éxito (queda en localStorage para que admin lo vea)
    if (!url || url.includes('TU_SCRIPT_ID')) {
      setMsg('¡Gracias! Te contactamos muy pronto para activar tu suscripción. ✨', true);
      e.target.reset();
      if (btn) { btn.disabled = false; btn.textContent = '✨ Quiero ser parte'; }
      if (typeof App !== 'undefined') App.showToast('¡Bienvenida al Club Prince! 👑');
      return;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      // Apps Script responde texto JSON aunque sea opaque en cors; intentar leer
      let data = null;
      try { data = await res.json(); } catch { try { data = JSON.parse(await res.text()); } catch {} }

      if (data && data.error) throw new Error(data.error);

      setMsg('¡Gracias! Ya sos parte del Club Prince. Te escribimos en breve. 💕', true);
      e.target.reset();
      if (typeof App !== 'undefined') App.showToast('¡Lead guardado en ClubPrince_Leads! 👑');
    } catch (err) {
      console.error('[ClubPrince] fetch', err);
      // Aunque falle el Sheets, el lead quedó local
      setMsg('¡Recibido! Te contactamos pronto. (Guardado localmente)', true);
      e.target.reset();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '✨ Quiero ser parte'; }
    }
  },

  esc(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
};

document.addEventListener('DOMContentLoaded', () => ClubPrince.init());
// También actualizar precios ARS cuando el dólar se conoce
window.addEventListener('load', () => setTimeout(()=> ClubPrince.updateBoxPricesARS(), 800));
