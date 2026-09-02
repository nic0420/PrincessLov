/* ============================================
   ADMIN CONTENT - Categorías y frases del home
   ============================================ */

const AdminContent = {
  tab: 'categorias',

  render() {
    this.switchTab(this.tab || 'categorias');
  },

  switchTab(which) {
    this.tab = which;
    document.querySelectorAll('#content-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === which));
    const a = document.getElementById('content-panel-categorias');
    const b = document.getElementById('content-panel-frases');
    if (a) { a.classList.toggle('active', which === 'categorias'); a.style.display = which === 'categorias' ? 'block' : 'none'; }
    if (b) { b.classList.toggle('active', which === 'frases'); b.style.display = which === 'frases' ? 'block' : 'none'; }
    if (which === 'categorias') this.renderCategorias();
    else this.renderFrases();
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
    };
    AdminData.saveContenido(next);
    AdminApp.toast('Contenido guardado — se refleja al recargar la tienda');
  },

  resetFrases() {
    if (!confirm('¿Restaurar todos los textos por defecto?')) return;
    AdminData.resetContenido();
    this.renderFrases();
    AdminApp.toast('Textos restaurados');
  },

  esc(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
};
