/* ============================================
   CONFIG - PrincessLov Tienda Online
   Editá estos valores según tu negocio
   ============================================ */

const CONFIG = {
  // ==========================================
  // DATOS DEL NEGOCIO
  // ==========================================
  negocio: {
    nombre: "PrincessLov",
    descripcion: "Indumentaria deportiva y pijamas para mujeres",
    whatsapp: "5493757338837",    // Tu número de WhatsApp con código de país
    email: "princesslov@email.com",
    instagram: "princesslov",
    direccion: "Puerto Iguazú, Misiones, Argentina",
  },

  // ==========================================
  // GOOGLE SHEETS - BACKEND
  // ==========================================
  // IMPORTANTE: Tu Google Sheet debe tener esta estructura:
  // Columna A: ID (número único)
  // Columna B: Nombre del producto
  // Columna C: Categoría (ej: "Calzas", "Conjuntos", "Pijamas", etc.)
  // Columna D: Subcategoría (ej: "Largas", "Cortas")
  // Columna E: Descripción
  // Columna F: Precio USD
  // Columna G: URL de imagen
  // Columna H: Stock (cantidad)
  // Columna I: Activo (TRUE o FALSE)
  // Columna J: Tags (ej: "nuevo,oferta")
  //
  // Para obtener la URL del CSV publicado:
  // 1. Abrí tu Google Sheet
  // 2. Archivo > Compartir > Publicar en la web
  // 3. Elegí la hoja "Productos" y formato "Valores separados por coma (.csv)"
  // 4. Copiá la URL generada
  sheets: {
    url: "https://docs.google.com/spreadsheets/d/TU_SHEET_ID/pub?output=csv&gid=0",
    // URL del Google Apps Script Web App (para sync bidireccional completa)
    // Obtené esta URL deployando el código de google-apps-script.gs como Web App
    appsScriptUrl: "https://script.google.com/macros/s/TU_SCRIPT_ID/exec",
    // URL para cotización del dólar (opcional, editá manualmente si no funciona)
    dolarUrl: "https://criptoya.com/api/dolar", 
  },

  // ==========================================
  // COTIZACIÓN DEL DÓLAR
  // ==========================================
  // Si activás autoCotizacion, la web buscará el precio del dólar automáticamente.
  // Si lo dejás en false, usará el valor de cotizacionManual.
  cotizacion: {
    autoCotizacion: true,         // true = busca online, false = usa manual
    cotizacionManual: 1200,       // Valor manual del dólar (solo se usa si autoCotizacion es false)
    margenGanancia: 1.30,         // Markup: 1.30 = 30% de ganancia sobre costo USD
    // Fórmula: Precio ARS = Precio USD * Dólar * margenGanancia
  },

  // ==========================================
  // MERCADO PAGO
  // ==========================================
  // Para producción, necesitás tu Access Token de MP.
  // Para pruebas, usá el token de sandbox.
  mercadopago: {
    publicKey: "TEST-xxxx-xxxx-xxxx",       // Tu public key
    accessToken: "TEST-xxxx-xxxx-xxxx",     // Tu access token
    // En TEST: https://www.mercadopago.com.ar/developers/en/reference/preferences/_checkout_preferences/post
    // En PRODUCCIÓN: reemplazá "TEST" por tu public key real
  },

  // ==========================================
  // OPCIONES DE ENVÍO
  // ==========================================
  envios: [
    {
      id: "retiro",
      nombre: "Retiro en local",
      descripcion: "Puerto Iguazú",
      precio: 0,
      activo: true,
    },
    {
      id: "envio_gratis_iguazu",
      nombre: "Envío gratis Puerto Iguazú",
      descripcion: "Sin costo en la zona",
      precio: 0,
      activo: true,
    },
    {
      id: "neo_encomienda",
      nombre: "Neo Encomienda",
      descripcion: "Interior de Misiones",
      precio: 2500,
      activo: true,
    },
    {
      id: "correo_argentino",
      nombre: "Correo Argentino",
      descripcion: "A todo el país",
      precio: 3500,
      activo: true,
    },
    {
      id: "flecha_bootstrap",
      nombre: "Flecha Cargo / Vía Cargo",
      descripcion: "A todo el país",
      precio: 4000,
      activo: true,
    },
  ],

  // ==========================================
  // CATEGORÍAS CON ICONOS
  // ==========================================
  categorias: [
    { id: "calzas-largas",     nombre: "Calzas Largas",     icon: "👖", grupo: "Indumentaria Deportiva" },
    { id: "calzas-cortas",     nombre: "Calzas Cortas",     icon: "🩳", grupo: "Indumentaria Deportiva" },
    { id: "catsuits",          nombre: "Catsuits",          icon: "🐱", grupo: "Indumentaria Deportiva" },
    { id: "conjuntos",         nombre: "Conjuntos",         icon: "👚", grupo: "Indumentaria Deportiva" },
    { id: "remeras",           nombre: "Remeras",           icon: "👕", grupo: "Indumentaria Deportiva" },
    { id: "buzos",             nombre: "Buzos",             icon: "🧥", grupo: "Indumentaria Deportiva" },
    { id: "pijamas",           nombre: "Pijamas",           icon: "🌙", grupo: "Pijamas" },
    { id: "conjuntos-pijama",  nombre: "Conjuntos Pijama",  icon: "🌜", grupo: "Pijamas" },
    { id: "ropa-interior",     nombre: "Ropa Interior",     icon: "🎀", grupo: "Accesorios" },
    { id: "accesorios",        nombre: "Accesorios",        icon: "✨", grupo: "Accesorios" },
    { id: "ofertas",           nombre: "Ofertas",           icon: "🏷️", grupo: "Ofertas" },
    { id: "todos",             nombre: "Todos",             icon: "📦", grupo: "General" },
  ],

  // ==========================================
  // MENSAJE WHATSAPP TEMPLATE
  // ==========================================
  // {total} = total de la compra
  // {items} = lista de productos
  // {envio} = método de envío seleccionado
  // {datos} = nombre, dirección, etc.
  whatsappTemplate: `Hola! Quiero hacer un pedido en PrincessLov 🛍️

*Mi pedido:*
{items}

*Total:* ${"{total}"}
*Envío:* ${"{envio}"}
*Medio de pago:* ${"{pago}"}

*Datos:*
{datos}

¡Gracias! 💕`,

  // ==========================================
  // IMÁGENES
  // ==========================================
  imagenes: {
    logo: "assets/logo.jpg",
    placeholder: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='700'><rect width='600' height='700' fill='%23F8D0DC'/><text x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23800020' font-size='20' font-family='sans-serif'>Sin imagen</text></svg>",
    hero: "",
  },
};

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
