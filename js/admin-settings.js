/* ============================================
   ADMIN SETTINGS - Configuración con Sincronía en Vivo
   ============================================ */

const AdminSettings = {
  async render() {
    await this.loadForm();
  },

  async loadForm() {
    // Cargar desde SheetsService (que lee Apps Script > localStorage)
    const settings = await SheetsService.obtenerConfig();

    document.getElementById('set-nombre').value = settings.nombre || 'PrincessLov';
    document.getElementById('set-whatsapp').value = settings.whatsapp || '';
    document.getElementById('set-email').value = settings.email || '';
    document.getElementById('set-instagram').value = settings.instagram || '';
    document.getElementById('set-dolar-manual').value = settings.dolarManual || '';
    document.getElementById('set-margen').value = settings.margen || '';

    // Gastos fijos
    const gf = settings.gastosFijos || {};
    document.getElementById('set-gasto-alquiler').value = gf.alquiler || '';
    document.getElementById('set-gasto-servicios').value = gf.servicios || '';
    document.getElementById('set-gasto-internet').value = gf.internet || '';
    document.getElementById('set-gasto-transporte').value = gf.transporte || '';
    document.getElementById('set-gasto-otros').value = gf.otros || '';

    // Costos variables
    const cv = settings.costosVariables || {};
    document.getElementById('set-cv-envoltorio').value = cv.envoltorio || '';
    document.getElementById('set-cv-etiqueta').value = cv.etiqueta || '';
    document.getElementById('set-cv-comision').value = cv.comisionMP || '';
  },

  save(event) {
    event.preventDefault();

    const settings = {
      nombre: document.getElementById('set-nombre').value.trim(),
      whatsapp: document.getElementById('set-whatsapp').value.trim(),
      email: document.getElementById('set-email').value.trim(),
      instagram: document.getElementById('set-instagram').value.trim(),
      dolarManual: parseFloat(document.getElementById('set-dolar-manual').value) || 1200,
      margen: parseFloat(document.getElementById('set-margen').value) || 1.30,
      gastosFijos: {
        alquiler: parseFloat(document.getElementById('set-gasto-alquiler').value) || 0,
        servicios: parseFloat(document.getElementById('set-gasto-servicios').value) || 0,
        internet: parseFloat(document.getElementById('set-gasto-internet').value) || 0,
        transporte: parseFloat(document.getElementById('set-gasto-transporte').value) || 0,
        otros: parseFloat(document.getElementById('set-gasto-otros').value) || 0,
      },
      costosVariables: {
        envoltorio: parseFloat(document.getElementById('set-cv-envoltorio').value) || 0,
        etiqueta: parseFloat(document.getElementById('set-cv-etiqueta').value) || 0,
        comisionMP: parseFloat(document.getElementById('set-cv-comision').value) || 0.035,
      },
    };

    // Guardar vía SheetsService (Apps Script > localStorage)
    SheetsService.guardarConfig(settings).then(result => {
      if (result.success) {
        // Aplicar INMEDIATAMENTE a la tienda en vivo
        this.applyToLiveStore(settings);
        
        // Forzar recarga de productos y dólar en tienda
        if (window.SheetsService) {
          SheetsService.refrescarTodo();
        }
        
        AdminApp.toast('✅ Configuración guardada y aplicada a la tienda');
      } else {
        AdminApp.toast('❌ Error guardando: ' + (result.error || 'desconocido'), 'error');
      }
    });
  },

  /**
   * Aplica settings INMEDIATAMENTE a CONFIG global (tienda en vivo)
   * Sin necesidad de recargar la página
   */
  applyToLiveStore(settings) {
    // Negocio
    if (settings.nombre) CONFIG.negocio.nombre = settings.nombre;
    if (settings.whatsapp) CONFIG.negocio.whatsapp = settings.whatsapp;
    if (settings.email) CONFIG.negocio.email = settings.email;
    if (settings.instagram) CONFIG.negocio.instagram = settings.instagram;

    // Cotización
    CONFIG.cotizacion.cotizacionManual = settings.dolarManual;
    CONFIG.cotizacion.margenGanancia = settings.margen;

    // Actualizar WhatsApp links en la página
    this.updateWhatsAppLinks(settings.whatsapp);
    
    // Actualizar Instagram link
    this.updateInstagramLink(settings.instagram);
    
    // Actualizar título de la página
    if (settings.nombre) document.title = settings.nombre + ' | Sportwears, Pijamas y Lencerías';
    
    // Disparar evento personalizado para que otros módulos reaccionen
    window.dispatchEvent(new CustomEvent('config:updated', { detail: settings }));
    
    console.log('[AdminSettings] Config aplicada en vivo:', settings);
  },

  updateWhatsAppLinks(whatsapp) {
    if (!whatsapp) return;
    
    // Botón contacto hero
    const btn = document.getElementById('contacto-whatsapp-btn');
    if (btn) btn.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent('Hola! Quiero consultar por sus productos.')}`;

    // Footer
    const footerWa = document.getElementById('footer-whatsapp-link');
    if (footerWa) {
      footerWa.innerHTML = `📱 WhatsApp: <a href="https://wa.me/${whatsapp}" target="_blank" style="color:var(--pink-300);">Escribinos</a>`;
    }

    // Carrito WhatsApp (se regenera al abrir)
    // Checkout WhatsApp (se regenera al abrir)
  },

  updateInstagramLink(instagram) {
    if (!instagram) return;
    const footerIg = document.getElementById('footer-instagram');
    if (footerIg) footerIg.href = `https://instagram.com/${instagram}`;
  },
};

/* ============================================
   EVENTOS GLOBALES PARA SINCRONÍA
   ============================================ */

// Escuchar cambios de config desde admin y aplicar a tienda
window.addEventListener('config:updated', (e) => {
  console.log('[LiveStore] Config actualizada:', e.detail);
  // Aquí podés agregar lógica extra: actualizar precios mostrados, etc.
});

// Sincronizar dólar cuando cambia en admin
window.addEventListener('dolar:updated', (e) => {
  if (window.SheetsService) {
    SheetsService.cotizacionDolar = e.detail;
    // Forzar recálculo de precios visibles
    if (window.App && App.productosFiltrados) {
      App.renderProductos(App.productosFiltrados);
    }
  }
});

// Sincronizar productos cuando cambian en admin
window.addEventListener('products:updated', async () => {
  if (window.SheetsService) {
    await SheetsService.refrescarTodo();
    if (window.App) {
      App.renderProductos(App.productosFiltrados || SheetsService.productos);
      App.renderSidebarFilters();
      App.renderCatBar();
    }
  }
});

// Helper global para forzar sync desde consola
window.forceSync = async () => {
  if (window.SheetsService) {
    await SheetsService.refrescarTodo();
    if (window.App) {
      App.renderProductos(App.productosFiltrados || SheetsService.productos);
      App.renderSidebarFilters();
      App.renderCatBar();
    }
    console.log('✅ Sync forzado completado');
  }
};