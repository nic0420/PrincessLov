/* ============================================
   ADMIN SETTINGS - Configuración
   ============================================ */

const AdminSettings = {
  render() {
    const settings = AdminData.getSettings();

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
  },

  load() {
    const settings = AdminData.getSettings();

    if (settings.dolarManual) {
      CONFIG.cotizacion.cotizacionManual = settings.dolarManual;
    }
    if (settings.margen) {
      CONFIG.cotizacion.margenGanancia = settings.margen;
    }
    if (settings.whatsapp) {
      CONFIG.negocio.whatsapp = settings.whatsapp;
    }
    if (settings.nombre) {
      CONFIG.negocio.nombre = settings.nombre;
    }

    // Gastos fijos
    if (settings.gastosFijos) {
      Object.assign(ADMIN_CONFIG.gastosFijos, settings.gastosFijos);
    }

    // Costos variables
    if (settings.costosVariables) {
      Object.assign(ADMIN_CONFIG.costosVariables, settings.costosVariables);
    }
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
      },
    };

    AdminData.saveSettings(settings);
    this.load();
    AdminApp.toast('Configuración guardada');
  },
};
