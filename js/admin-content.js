/* ============================================
   ADMIN CONTENT - Categorías y frases del home
   ============================================ */

const AdminContent = {
  tab: 'categorias',

  render() {
    this.switchTab(this.tab || 'categorias');
  },

  switchTab(which) {
    if (!['categorias', 'frases', 'club'].includes(which)) which = 'categorias';
    this.tab = which;
    document.querySelectorAll('#content-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === which));
    const panels = { categorias: 'content-panel-categorias', frases: 'content-panel-frases', club: 'content-panel-club' };
    Object.entries(panels).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) { el.classList.toggle('active', key === which); el.style.display = key === which ? 'block' : 'none'; }
    });
    if (which === 'categorias') this.renderCategorias();
    else { this.renderFrases(); setTimeout(() => this.renderClubLeads(), 120); }
  },

  /* ---------- CATEGORÍAS ---------- */
  renderCategorias() {
    const cats = AdminData.getEffectiveCategorias();
    const tbody = document.getElementById('cats-tbody');
    if (!tbody) return;
    tbody.innerHTML = cats.map(c => `
      <tr>
        <td><input type="text" value="${this.esc(c.icon)}" data-id="${c.id}" data-field="icon" style="width:56px; text-align:center;" placeholder="👖" onchange="AdminContent.updateCatField('${c.id}','icon',this.value)"></td>
        <td><input type="text" value="${this.esc(c.nombre)}" data-id="${c.id}" data-field="nombre" style="width:100%;" onchange="AdminContent.updateCatField('${c.id}','nombre',this.value)"></td>
        <td><input type="text" value="${this.esc(c.id)}" style="width:100%; opacity:0.6;" disabled title="ID se genera del nombre"><br><small style="color:var(--texto-secundario);">${this.esc(c.id)}</small></td>
        <td><input type="text" value="${this.esc(c.grupo)}" data-id="${c.id}" data-field="grupo" style="width:100%;" placeholder="Grupo" onchange="AdminContent.updateCatField('${c.id}','grupo',this.value)"></td>
        <td style="white-space:nowrap;">
          <button class="btn btn-xs btn-secondary" onclick="AdminContent.moveCat('${c.id}',-1)">↑</button>
          <button class="btn btn-xs btn-secondary" onclick="AdminContent.moveCat('${c.id}',1)">↓</button>
          <button class="btn btn-xs btn-ghost" style="color:var(--rojo-500);" onclick="AdminContent.removeCat('${c.id}')">✕</button>
        </td>
      </tr>
    `).join('');
  },

  updateCatField(id, field, value) {
    const cats = AdminData.getEffectiveCategorias().map(c => c.id === id ? { ...c, [field]: value } : c);
    AdminData.saveCategorias(cats);
    AdminApp.toast('Categoría actualizada');
    this.renderCategorias();
  },

  addCat() {
    const nombre = document.getElementById('new-cat-nombre')?.value.trim();
    const icon = document.getElementById('new-cat-icon')?.value.trim() || '📦';
    const grupoEl = document.getElementById('new-cat-grupo');
    const grupo = grupoEl?.value.trim() || 'General';
    if (!nombre) { AdminApp.toast('Poné un nombre', 'error'); return; }
    const id = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    if (!id) { AdminApp.toast('Nombre inválido', 'error'); return; }
    const cats = AdminData.getEffectiveCategorias();
    if (cats.some(c=>c.id===id)) { AdminApp.toast('Ya existe una categoría con ese ID', 'error'); return; }
    cats.splice(cats.length-1, 0, { id, nombre, icon, grupo }); // antes de "todos"
    AdminData.saveCategorias(cats);
    document.getElementById('new-cat-nombre').value = '';
    document.getElementById('new-cat-icon').value = '';
    AdminApp.toast('Categoría agregada');
    this.renderCategorias();
  },

  removeCat(id) {
    if (id === 'todos') { AdminApp.toast('No se puede borrar "Todos"', 'error'); return; }
    if (!confirm('¿Borrar categoría "'+id+'"? Los productos quedarán sin reasignar.')) return;
    const cats = AdminData.getEffectiveCategorias().filter(c=>c.id!==id);
    AdminData.saveCategorias(cats);
    this.renderCategorias();
  },

  moveCat(id, dir) {
    const cats = [...AdminData.getEffectiveCategorias()];
    const idx = cats.findIndex(c=>c.id===id);
    if (idx<0) return;
    const nIdx = idx + dir;
    if (nIdx <0 || nIdx >= cats.length) return;
    // no mover "todos" del final? permitir pero mantenerlo último
    if (cats[idx].id==='todos' || cats[nIdx].id==='todos') {
      // mantener "todos" al final
      if (cats[idx].id==='todos') return;
      if (cats[nIdx].id==='todos' && dir===1) return;
    }
    [cats[idx], cats[nIdx]] = [cats[nIdx], cats[idx]];
    AdminData.saveCategorias(cats);
    this.renderCategorias();
  },

  resetCats() {
    if (!confirm('¿Restaurar categorías por defecto?')) return;
    AdminData.resetCategorias();
    AdminApp.toast('Categorías restauradas');
    this.renderCategorias();
  },

  /* ---------- FRASES / HOME ---------- */
  renderFrases() {
    const cont = AdminData.getEffectiveContenido();
    const q = (id) => document.getElementById(id);
    // Promo bar
    if (q('fr-promo-1')) q('fr-promo-1').value = cont.promoBar?.[0] || '';
    if (q('fr-promo-2')) q('fr-promo-2').value = cont.promoBar?.[1] || '';
    if (q('fr-promo-3')) q('fr-promo-3').value = cont.promoBar?.[2] || '';
    // Hero (3 slides)
    for (let i=0;i<3;i++){
      const h = cont.hero?.[i] || {};
      if (q('fr-hero-'+i+'-kicker')) q('fr-hero-'+i+'-kicker').value = h.kicker || '';
      if (q('fr-hero-'+i+'-title')) q('fr-hero-'+i+'-title').value = h.title || '';
      if (q('fr-hero-'+i+'-desc')) q('fr-hero-'+i+'-desc').value = h.desc || '';
      if (q('fr-hero-'+i+'-cta')) q('fr-hero-'+i+'-cta').value = h.cta || '';
      if (q('fr-hero-'+i+'-cat')) q('fr-hero-'+i+'-cat').value = h.categoria || '';
    }
    // Showcase
    if (q('fr-show-kicker')) q('fr-show-kicker').value = cont.showcase?.kicker || '';
    if (q('fr-show-title')) q('fr-show-title').value = cont.showcase?.title || '';
    // Servicios
    if (q('fr-serv-kicker')) q('fr-serv-kicker').value = cont.servicios?.kicker || '';
    if (q('fr-serv-title')) q('fr-serv-title').value = cont.servicios?.title || '';
    for (let i=0;i<4;i++){
      const s = cont.servicios?.items?.[i] || {};
      if (q('fr-serv-'+i+'-icon')) q('fr-serv-'+i+'-icon').value = s.icon || '';
      if (q('fr-serv-'+i+'-title')) q('fr-serv-'+i+'-title').value = s.title || '';
      if (q('fr-serv-'+i+'-desc')) q('fr-serv-'+i+'-desc').value = s.desc || '';
    }
    // Promo band + CTA + Newsletter + Footer
    if (q('fr-band-kicker')) q('fr-band-kicker').value = cont.promoBand?.kicker || '';
    if (q('fr-band-title')) q('fr-band-title').value = cont.promoBand?.title || '';
    if (q('fr-band-desc')) q('fr-band-desc').value = cont.promoBand?.desc || '';
    if (q('fr-band-cta')) q('fr-band-cta').value = cont.promoBand?.cta || '';
    if (q('fr-cta-title')) q('fr-cta-title').value = cont.cta?.title || '';
    if (q('fr-cta-desc')) q('fr-cta-desc').value = cont.cta?.desc || '';
    if (q('fr-cta-btn')) q('fr-cta-btn').value = cont.cta?.btn || '';
    if (q('fr-cta-icon')) q('fr-cta-icon').value = cont.cta?.icon || '';
    if (q('fr-nl-title')) q('fr-nl-title').value = cont.newsletter?.title || '';
    if (q('fr-nl-desc')) q('fr-nl-desc').value = cont.newsletter?.desc || '';
    if (q('fr-nl-btn')) q('fr-nl-btn').value = cont.newsletter?.btn || '';
    if (q('fr-footer-tagline')) q('fr-footer-tagline').value = cont.footer?.tagline || '';
    // Club Prince
    const cp = cont.clubPrince || CONFIG.contenido?.clubPrince || {};
    if (q('fr-club-badge')) q('fr-club-badge').value = cp.badge || '';
    if (q('fr-club-title')) q('fr-club-title').value = cp.title || '';
    if (q('fr-club-title-accent')) q('fr-club-title-accent').value = cp.titleAccent || '';
    if (q('fr-club-subtitle')) q('fr-club-subtitle').value = cp.subtitle || '';
    if (q('fr-club-desc')) q('fr-club-desc').value = cp.desc || '';
    if (q('fr-club-benefit-0')) q('fr-club-benefit-0').value = cp.benefits?.[0] || '';
    if (q('fr-club-benefit-1')) q('fr-club-benefit-1').value = cp.benefits?.[1] || '';
    if (q('fr-club-benefit-2')) q('fr-club-benefit-2').value = cp.benefits?.[2] || '';
    if (q('fr-club-form-title')) q('fr-club-form-title').value = cp.formTitle || '';
    if (q('fr-club-form-desc')) q('fr-club-form-desc').value = cp.formDesc || '';
    for (let i=0;i<3;i++){
      const b = cp.boxes?.[i] || {};
      if (q('fr-club-box-'+i+'-nombre')) q('fr-club-box-'+i+'-nombre').value = b.nombre || '';
      if (q('fr-club-box-'+i+'-desc')) q('fr-club-box-'+i+'-desc').value = b.descripcionCorta || b.desc || '';
      if (q('fr-club-box-'+i+'-detalle')) q('fr-club-box-'+i+'-detalle').value = b.detalleCompleto || '';
      if (q('fr-club-box-'+i+'-imagen')) q('fr-club-box-'+i+'-imagen').value = b.imagenUrl || b.imagen || '';
      if (q('fr-club-box-'+i+'-precio')) q('fr-club-box-'+i+'-precio').value = b.precioUSD || '';
      if (q('fr-club-box-'+i+'-icon')) q('fr-club-box-'+i+'-icon').value = b.icon || '';
      if (q('fr-club-box-'+i+'-tag')) q('fr-club-box-'+i+'-tag').value = b.tag || '';
    }
  },

  saveFrases(e) {
    e.preventDefault();
    const get = (id) => document.getElementById(id)?.value.trim() || '';
    const cont = AdminData.getEffectiveContenido();
    const next = {
      ...cont,
      promoBar: [get('fr-promo-1'), get('fr-promo-2'), get('fr-promo-3')].filter(Boolean),
      hero: [0,1,2].map(i=> ({
        kicker: get('fr-hero-'+i+'-kicker'),
        title: get('fr-hero-'+i+'-title'),
        desc: get('fr-hero-'+i+'-desc'),
        cta: get('fr-hero-'+i+'-cta'),
        categoria: get('fr-hero-'+i+'-cat'),
        image: cont.hero?.[i]?.image || CONFIG.contenido?.hero?.[i]?.image || ''
      })),
      showcase: { kicker: get('fr-show-kicker'), title: get('fr-show-title'), cards: cont.showcase?.cards || CONFIG.contenido?.showcase?.cards || [] },
      servicios: {
        kicker: get('fr-serv-kicker'),
        title: get('fr-serv-title'),
        items: [0,1,2,3].map(i=> ({ icon: get('fr-serv-'+i+'-icon'), title: get('fr-serv-'+i+'-title'), desc: get('fr-serv-'+i+'-desc') }))
      },
      promoBand: { ...cont.promoBand, kicker: get('fr-band-kicker'), title: get('fr-band-title'), desc: get('fr-band-desc'), cta: get('fr-band-cta') },
      cta: { ...cont.cta, title: get('fr-cta-title'), desc: get('fr-cta-desc'), btn: get('fr-cta-btn'), icon: get('fr-cta-icon') },
      newsletter: { ...cont.newsletter, title: get('fr-nl-title'), desc: get('fr-nl-desc'), btn: get('fr-nl-btn'), placeholder: cont.newsletter?.placeholder || 'Tu correo electrónico' },
      footer: { tagline: get('fr-footer-tagline') },
      clubPrince: {
        ...(cont.clubPrince || CONFIG.contenido?.clubPrince || {}),
        badge: get('fr-club-badge') || (cont.clubPrince?.badge || CONFIG.contenido?.clubPrince?.badge),
        title: get('fr-club-title') || (cont.clubPrince?.title || CONFIG.contenido?.clubPrince?.title),
        titleAccent: get('fr-club-title-accent') || (cont.clubPrince?.titleAccent || CONFIG.contenido?.clubPrince?.titleAccent),
        subtitle: get('fr-club-subtitle') || (cont.clubPrince?.subtitle || CONFIG.contenido?.clubPrince?.subtitle),
        desc: get('fr-club-desc') || (cont.clubPrince?.desc || CONFIG.contenido?.clubPrince?.desc),
        benefits: [get('fr-club-benefit-0'), get('fr-club-benefit-1'), get('fr-club-benefit-2')].filter(Boolean),
        formTitle: get('fr-club-form-title') || (cont.clubPrince?.formTitle),
        formDesc: get('fr-club-form-desc') || (cont.clubPrince?.formDesc),
        boxes: [0,1,2].map(i=> {
          const base = (cont.clubPrince?.boxes?.[i] || CONFIG.contenido?.clubPrince?.boxes?.[i] || {});
          const corta = get('fr-club-box-'+i+'-desc') || base.descripcionCorta || base.desc;
          return {
            ...base,
            id: base.id || `box-${i}`,
            nombre: get('fr-club-box-'+i+'-nombre') || base.nombre,
            descripcionCorta: corta,
            desc: corta, // alias histórico
            detalleCompleto: get('fr-club-box-'+i+'-detalle') || base.detalleCompleto || '',
            imagenUrl: get('fr-club-box-'+i+'-imagen') || base.imagenUrl || base.imagen || '',
            precioUSD: parseFloat(get('fr-club-box-'+i+'-precio')) || base.precioUSD || 0,
            icon: get('fr-club-box-'+i+'-icon') || base.icon,
            tag: get('fr-club-box-'+i+'-tag') || base.tag,
            destacado: base.destacado || i===1,
          };
        }),
      },
    };
    AdminData.saveContenido(next);
    // Push CMS a Google Sheets (clave `clubPrince_boxes`) si hay backend configurado
    try {
      const url = (typeof CONFIG !== 'undefined' && CONFIG.sheets?.appsScriptUrl) ? CONFIG.sheets.appsScriptUrl : null;
      if (url && !url.includes('TU_SCRIPT_ID') && typeof SheetsService !== 'undefined' && SheetsService.postToAppsScript) {
        SheetsService.postToAppsScript('save_config', { config: { clubPrince_boxes: JSON.stringify(next.clubPrince.boxes) } }).catch(() => {});
      }
    } catch {}
    AdminApp.toast('Contenido guardado — se refleja al recargar la tienda');
  },

  resetFrases() {
    if (!confirm('¿Restaurar todos los textos por defecto?')) return;
    AdminData.resetContenido();
    this.renderFrases();
    AdminApp.toast('Textos restaurados');
  },

  renderClubLeads(){
    const el = document.getElementById('club-leads-list'); if(!el) return;
    let leads = [];
    try { leads = JSON.parse(localStorage.getItem('pl_clubprince_leads')||'[]').reverse().slice(0,20); } catch {}
    if (!leads.length) { el.innerHTML = '<p style="color:var(--texto-secundario); font-size:0.85rem; background:var(--gris-100); padding:0.8rem; border-radius:8px;">Aún no hay leads. Probá el formulario del Club en la tienda.</p>'; return; }
    el.innerHTML = `<div class="table-container"><table class="products-table" style="font-size:0.85rem;"><thead><tr><th>Fecha</th><th>Nombre</th><th>Teléfono</th><th>Ciudad</th><th>Plan</th></tr></thead><tbody>${leads.map(l=> `<tr><td>${this.esc(new Date(l.fecha).toLocaleDateString('es-AR'))}</td><td>${this.esc(l.nombre)}</td><td>${this.esc(l.telefono)}</td><td>${this.esc(l.ciudad)}</td><td>${this.esc(l.plan || '-')}</td></tr>`).join('')}</tbody></table></div>`;
  },

  esc(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
};
