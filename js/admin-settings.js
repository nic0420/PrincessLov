/* ============================================
   ADMIN SETTINGS - Configuración con Sincronía en Vivo
   ============================================ */

const AdminSettings = {
  render() {
    const settings = AdminData.getSettings();
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val == null ? '' : val;
    };

    set('set-nombre', settings.nombre || 'PrincessLov');
    set('set-whatsapp', settings.whatsapp || '');
    set('set-email', settings.email || '');
    set('set-instagram', settings.instagram || '');
    set('set-dolar-manual', settings.dolarManual || '');
    set('set-margen', settings.margen || '');

    // Gastos fijos
    const gf = settings.gastosFijos || {};
    set('set-gasto-alquiler', gf.alquiler || '');
    set('set-gasto-servicios', gf.servicios || '');
    set('set-gasto-internet', gf.internet || '');
    set('set-gasto-transporte', gf.transporte || '');
    set('set-gasto-otros', gf.otros || '');

    // Costos variables
    const cv = settings.costosVariables || {};
    set('set-cv-envoltorio', cv.envoltorio || '');
    set('set-cv-etiqueta', cv.etiqueta || '');
    set('set-cv-comision', cv.comisionMP || '');

    // Sync con Sheets si está configurado (asíncrono, no bloquea)
    if (SheetsService && SheetsService.appsScriptUrl) {
      SheetsService.obtenerConfig().then(remote => {
        if (remote && Object.keys(remote).length) {
          AdminData.saveSettings(this.sanitize(remote));
          AdminApp.toast('Config sincronizada desde Google Sheets');
        }
      }).catch(() => {});
    }
  },

  /**
   * Carga settings a nivel global (CONFIG y ADMIN_CONFIG).
   * LO NECESITA AdminApp.init() — no eliminar.
   */
  load() {
    const settings = AdminData.getSettings();

    if (settings.dolarManual) CONFIG.cotizacion.cotizacionManual = Number(settings.dolarManual) || CONFIG.cotizacion.cotizacionManual;
    if (settings.margen) CONFIG.cotizacion.margenGanancia = Number(settings.margen) || CONFIG.cotizacion.margenGanancia;
    if (settings.whatsapp) CONFIG.negocio.whatsapp = settings.whatsapp;
    if (settings.nombre) CONFIG.negocio.nombre = settings.nombre;
    if (settings.email) CONFIG.negocio.email = settings.email;
    if (settings.instagram) CONFIG.negocio.instagram = settings.instagram;

    // Gastos fijos
    if (settings.gastosFijos) Object.assign(ADMIN_CONFIG.gastosFijos, settings.gastosFijos);
    // Costos variables
    if (settings.costosVariables) Object.assign(ADMIN_CONFIG.costosVariables, settings.costosVariables);

    // Sincronizar también hacia SheetsService (para la tienda)
    if (SheetsService) {
      SheetsService.cotizacionDolar = SheetsService.cotizacionDolar || Number(settings.dolarManual) || CONFIG.cotizacion.cotizacionManual;
    }
  },

  sanitize(settings) {
    // Normaliza las settings remote para que coincidan con el formato del admin
    const s = settings || {};
    const gastosFijos = s.gastosFijos || {};
    const costosVariables = s.costosVariables || {};
    return {
      nombre: s.nombre || 'PrincessLov',
      whatsapp: s.whatsapp || '',
      email: s.email || '',
      instagram: s.instagram || '',
      dolarManual: s.dolarManual || 1200,
      margen: s.margen || 1.30,
      gastosFijos: {
        alquiler: gastosFijos.alquiler || 0,
        servicios: gastosFijos.servicios || 0,
        internet: gastosFijos.internet || 0,
        transporte: gastosFijos.transporte || 0,
        otros: gastosFijos.otros || 0,
      },
      costosVariables: {
        envoltorio: costosVariables.envoltorio || 0,
        etiqueta: costosVariables.etiqueta || 0,
        comisionMP: costosVariables.comisionMP || 0.035,
      },
    };
  },

  save(event) {
    event.preventDefault();
    const get = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : '';
    };

    const settings = {
      nombre: get('set-nombre').trim(),
      whatsapp: get('set-whatsapp').trim(),
      email: get('set-email').trim(),
      instagram: get('set-instagram').trim(),
      dolarManual: parseFloat(get('set-dolar-manual')) || 1200,
      margen: parseFloat(get('set-margen')) || 1.30,
      gastosFijos: {
        alquiler: parseFloat(get('set-gasto-alquiler')) || 0,
        servicios: parseFloat(get('set-gasto-servicios')) || 0,
        internet: parseFloat(get('set-gasto-internet')) || 0,
        transporte: parseFloat(get('set-gasto-transporte')) || 0,
        otros: parseFloat(get('set-gasto-otros')) || 0,
      },
      costosVariables: {
        envoltorio: parseFloat(get('set-cv-envoltorio')) || 0,
        etiqueta: parseFloat(get('set-cv-etiqueta')) || 0,
        comisionMP: parseFloat(get('set-cv-comision')) || 0.035,
      },
    };

    // Guardar local (fuente de verdad del admin)
    AdminData.saveSettings(settings);

    // Sincronizar a Sheets si está configurado
    if (SheetsService && SheetsService.appsScriptUrl) {
      SheetsService.guardarConfig(settings).then(result => {
        if (result.success) {
          AdminApp.toast('✅ Configuración guardada y sincronizada a la tienda');
        } else {
          AdminApp.toast('⚠️ Guardado local. No se sincronizó a Sheets.', 'error');
        }
      }).catch(() => {
        AdminApp.toast('⚠️ Guardado local. No se sincronizó a Sheets.', 'error');
      });
    } else {
      AdminApp.toast('Configuración guardada');
    }

    this.load();
    this.applyToLiveStore(settings);
  },

  /**
   * Aplica settings INMEDIATAMENTE a CONFIG global (tienda en vivo)
   * Sin necesidad de recargar la página
   */
  applyToLiveStore(settings) {
    if (!window.CONFIG) return;
    if (settings.nombre) CONFIG.negocio.nombre = settings.nombre;
    if (settings.whatsapp) CONFIG.negocio.whatsapp = settings.whatsapp;
    if (settings.email) CONFIG.negocio.email = settings.email;
    if (settings.instagram) CONFIG.negocio.instagram = settings.instagram;
    CONFIG.cotizacion.cotizacionManual = settings.dolarManual;
    CONFIG.cotizacion.margenGanancia = settings.margen;

    // Disparar evento personalizado para que otros módulos reaccionen
    window.dispatchEvent(new CustomEvent('config:updated', { detail: settings }));
  },
};

/* ============================================
   EVENTOS GLOBALES PARA SINCRONÍA
   ============================================ */

window.addEventListener('config:updated', (e) => {
  console.log('[LiveStore] Config actualizada:', e.detail);
});

// Sincronizar dólar cuando cambia en admin
window.addEventListener('dolar:updated', (e) => {
  if (window.SheetsService) {
    SheetsService.cotizacionDolar = e.detail;
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
