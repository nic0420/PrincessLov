/* ============================================
   AVISO DE COOKIES / ALMACENAMIENTO LOCAL
   --------------------------------------------
   La tienda NO usa cookies de publicidad ni analítica.
   Solo guarda en el navegador lo necesario para funcionar
   (carrito, filtros, y los datos del checkout si la clienta
   marca "recordar"). Este aviso informa eso una vez.

   Si algún día agregás Google Analytics o el Pixel de Meta,
   hay que pedir consentimiento ANTES de cargarlos: usá
   PLConsent.aceptoAnalitica() para decidir si cargarlos.
   ============================================ */

const PLConsent = {
  KEY: 'pl_cookie_consent_v1',

  leer() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch { return null; }
  },

  guardar(valor) {
    try { localStorage.setItem(this.KEY, JSON.stringify({ ...valor, fecha: new Date().toISOString() })); } catch {}
  },

  aceptoAnalitica() {
    return !!this.leer()?.analitica;
  },

  init() {
    const banner = document.getElementById('cookie-banner');
    const year = document.getElementById('footer-year');
    if (year) year.textContent = new Date().getFullYear();
    if (!banner) return;
    if (!this.leer()) banner.hidden = false;
    document.getElementById('cookie-accept')?.addEventListener('click', () => {
      this.guardar({ necesarias: true, analitica: false });
      banner.hidden = true;
    });
  },
};

document.addEventListener('DOMContentLoaded', () => PLConsent.init());
