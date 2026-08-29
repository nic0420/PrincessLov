/**
 * Google Apps Script - Sincronización Bidireccional Google Sheets ↔ PrincessLov
 * 
 * INSTRUCCIONES DE DEPLOY:
 * 1. Abre tu Google Sheet (el mismo que usas como catálogo)
 * 2. Extensiones > Apps Script
 * 3. Borra el código por defecto y pega este archivo completo
 * 4. Guarda (Ctrl+S) > Proyecto: "PrincessLov Sync"
 * 5. Deploy > Nueva implementación > Tipo: "Aplicación web"
 * 6. Configuración:
 *    - Descripción: "PrincessLov API v1"
 *    - Ejecutar como: "Yo (tu-email@gmail.com)"
 *    - Quién tiene acceso: "Cualquiera" (IMPORTANTE para que Vercel pueda llamar)
 * 7. Deploy > Copia la URL generada (algo como https://script.google.com/macros/s/AKfycbx.../exec)
 * 8. En Vercel, agrega variable de entorno: SHEETS_WEBHOOK_URL = esa URL
 * 
 * ESTRUCTURA DE HOJAS REQUERIDA:
 * - Hoja "Productos": ID, Nombre, Categoria, Subcategoria, Descripcion, PrecioUSD, Imagen, Stock, Activo, Tags, SKU, PrecioARSManual, PrecioOferta, MargenPersonalizado, Peso, Dimensiones, Galeria, Variantes, Caracteristicas, Destacado, SoloWeb, SEOTitle, SEODesc
 * - Hoja "Pedidos": ID, Fecha, Cliente, Telefono, Email, Direccion, Localidad, Provincia, Estado, MedioPago, MetodoEnvio, Total, CostoTotal, Notas, Items (JSON), MP_PaymentID, MP_Status
 * - Hoja "Gastos": ID, Fecha, Concepto, Monto, Categoria, Notas
 * - Hoja "Config": Clave, Valor (para settings globales)
 * - Hoja "Dolar_Historial": Fecha, Valor
 */

// ============================================
// CONFIGURACIÓN
// ============================================
const SPREADSHEET_ID = 'TU_SHEET_ID_AQUI'; // Reemplazar con tu Sheet ID real
const SHEET_NAMES = {
  PRODUCTOS: 'Productos',
  PEDIDOS: 'Pedidos',
  GASTOS: 'Gastos',
  CONFIG: 'Config',
  DOLAR: 'Dolar_Historial',
};

const HEADERS = {
  PRODUCTOS: [
    'ID', 'Nombre', 'Categoria', 'Subcategoria', 'Descripcion', 'PrecioUSD',
    'Imagen', 'Stock', 'Activo', 'Tags', 'SKU', 'PrecioARSManual', 'PrecioOferta',
    'MargenPersonalizado', 'Peso', 'Dimensiones', 'Galeria', 'Variantes',
    'Caracteristicas', 'Destacado', 'SoloWeb', 'SEOTitle', 'SEODesc'
  ],
  PEDIDOS: [
    'ID', 'Fecha', 'Cliente', 'Telefono', 'Email', 'Direccion', 'Localidad',
    'Provincia', 'Estado', 'MedioPago', 'MetodoEnvio', 'Total', 'CostoTotal',
    'Notas', 'Items', 'MP_PaymentID', 'MP_Status'
  ],
  GASTOS: ['ID', 'Fecha', 'Concepto', 'Monto', 'Categoria', 'Notas'],
  CONFIG: ['Clave', 'Valor'],
  DOLAR: ['Fecha', 'Valor'],
};

// ============================================
// ENTRY POINTS (doGet/doPost)
// ============================================

function doGet(e) {
  const action = e?.parameter?.action || 'read';
  const sheet = e?.parameter?.sheet || 'productos';
  
  try {
    let result;
    switch (action) {
      case 'read':
        result = readSheet(sheet);
        break;
      case 'read_all':
        result = readAllSheets();
        break;
      case 'search':
        result = searchProducts(e.parameter.q, e.parameter.category);
        break;
      case 'stats':
        result = getStats(e.parameter.period);
        break;
      case 'config':
        result = getConfig();
        break;
      case 'dolar':
        result = getDolarHistory();
        break;
      default:
        result = { error: 'Acción no válida', actions: ['read', 'read_all', 'search', 'stats', 'config', 'dolar'] };
    }
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: error.toString() }, 500);
  }
}

function doPost(e) {
  const data = JSON.parse(e.postData?.contents || '{}');
  const action = data.action;
  
  try {
    let result;
    switch (action) {
      case 'upsert_product':
        result = upsertProduct(data.product);
        break;
      case 'delete_product':
        result = deleteProduct(data.id);
        break;
      case 'create_order':
        result = createOrder(data.order);
        break;
      case 'update_order':
        result = updateOrder(data.id, data.updates);
        break;
      case 'create_expense':
        result = createExpense(data.expense);
        break;
      case 'save_config':
        result = saveConfig(data.config);
        break;
      case 'add_dolar_rate':
        result = addDolarRate(data.valor);
        break;
      case 'webhook_mp':
        result = processWebhookMP(data);
        break;
      default:
        result = { error: 'Acción no válida' };
    }
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: error.toString() }, 500);
  }
}

// ============================================
// HELPERS
// ============================================

function jsonResponse(data, status = 200) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentType.JSON)
    .setHeaders({ 'Access-Control-Allow-Origin': '*' });
}

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Agregar headers si es nueva
    const headers = HEADERS[name.toUpperCase()];
    if (headers) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function getAllData(sheetName) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function writeRow(sheetName, rowData, id) {
  const sheet = getSheet(sheetName);
  const headers = HEADERS[sheetName.toUpperCase()];
  const lastRow = sheet.getLastRow();
  
  // Buscar fila existente por ID (columna A)
  let targetRow = -1;
  if (id && lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    const idx = ids.findIndex(v => v == id);
    if (idx !== -1) targetRow = idx + 2;
  }
  
  if (targetRow === -1) {
    // Nueva fila al final
    targetRow = lastRow + 1;
    if (targetRow === 2) {
      // Primera fila de datos, asegurar headers
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  
  const values = headers.map(h => rowData[h] !== undefined ? rowData[h] : '');
  sheet.getRange(targetRow, 1, 1, headers.length).setValues([values]);
  return targetRow;
}

// ============================================
// PRODUCTOS
// ============================================

function readSheet(sheetName) {
  return getAllData(SHEET_NAMES[sheetName.toUpperCase()] || sheetName);
}

function readAllSheets() {
  return {
    productos: readSheet('productos'),
    pedidos: readSheet('pedidos'),
    gastos: readSheet('gastos'),
    config: getConfig(),
    dolar: getDolarHistory(),
  };
}

function searchProducts(query, category) {
  const products = readSheet('productos');
  const q = (query || '').toLowerCase();
  return products.filter(p => {
    const matchesQuery = !q || 
      (p.Nombre?.toLowerCase().includes(q)) ||
      (p.Descripcion?.toLowerCase().includes(q)) ||
      (p.Categoria?.toLowerCase().includes(q)) ||
      (p.Tags?.toLowerCase().includes(q)) ||
      (p.SKU?.toLowerCase().includes(q));
    const matchesCat = !category || category === 'todos' || p.Categoria === category;
    return matchesQuery && matchesCat && p.Activo === true;
  });
}

function upsertProduct(product) {
  const sheetName = SHEET_NAMES.PRODUCTOS;
  const headers = HEADERS.PRODUCTOS;
  
  const rowData = {
    ID: product.id || `prod_${Date.now()}`,
    Nombre: product.nombre,
    Categoria: product.categoriaOriginal || product.categoria,
    Subcategoria: product.subcategoria || '',
    Descripcion: product.descripcion || '',
    PrecioUSD: product.precioUSD,
    Imagen: product.imagen || '',
    Stock: product.stock || 0,
    Activo: product.activo !== false,
    Tags: Array.isArray(product.tags) ? product.tags.join(', ') : (product.tags || ''),
    SKU: product.sku || '',
    PrecioARSManual: product.precioARSManual || '',
    PrecioOferta: product.precioOferta || '',
    MargenPersonalizado: product.margenPersonalizado || '',
    Peso: product.peso || '',
    Dimensiones: product.dimensiones || '',
    Galeria: JSON.stringify(product.galeria || []),
    Variantes: JSON.stringify(product.variantes || []),
    Caracteristicas: JSON.stringify(product.caracteristicas || {}),
    Destacado: product.destacado || false,
    SoloWeb: product.soloWeb || false,
    SEOTitle: product.seoTitle || '',
    SEODesc: product.seoDesc || '',
  };
  
  writeRow(sheetName, rowData, product.id);
  return { success: true, id: rowData.ID };
}

function deleteProduct(id) {
  const sheet = getSheet(SHEET_NAMES.PRODUCTOS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: 'No hay productos' };
  
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const idx = ids.findIndex(v => v == id);
  if (idx === -1) return { error: 'Producto no encontrado' };
  
  sheet.deleteRow(idx + 2);
  return { success: true };
}

// ============================================
// PEDIDOS
// ============================================

function createOrder(order) {
  const sheetName = SHEET_NAMES.PEDIDOS;
  const id = order.id || `ord_${Date.now()}`;
  
  const rowData = {
    ID: id,
    Fecha: new Date().toISOString(),
    Cliente: order.cliente,
    Telefono: order.telefono,
    Email: order.email,
    Direccion: order.direccion,
    Localidad: order.localidad,
    Provincia: order.provincia,
    Estado: order.estado || 'pendiente',
    MedioPago: order.medioPago,
    MetodoEnvio: order.metodoEnvio,
    Total: order.total,
    CostoTotal: order.costoTotal || 0,
    Notas: order.notas || '',
    Items: JSON.stringify(order.items || []),
    MP_PaymentID: order.mpPaymentId || '',
    MP_Status: order.mpStatus || '',
  };
  
  writeRow(sheetName, rowData, id);
  return { success: true, id };
}

function updateOrder(id, updates) {
  const sheet = getSheet(SHEET_NAMES.PEDIDOS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: 'No hay pedidos' };
  
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const idx = ids.findIndex(v => v == id);
  if (idx === -1) return { error: 'Pedido no encontrado' };
  
  const row = idx + 2;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Leer fila actual
  const current = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
  const rowData = {};
  headers.forEach((h, i) => rowData[h] = current[i]);
  
  // Aplicar actualizaciones
  Object.assign(rowData, updates);
  
  // Escribir
  const values = headers.map(h => rowData[h] !== undefined ? rowData[h] : '');
  sheet.getRange(row, 1, 1, headers.length).setValues([values]);
  
  return { success: true };
}

// ============================================
// GASTOS
// ============================================

function createExpense(expense) {
  const id = expense.id || `exp_${Date.now()}`;
  const rowData = {
    ID: id,
    Fecha: expense.fecha || new Date().toISOString(),
    Concepto: expense.concepto,
    Monto: expense.monto,
    Categoria: expense.categoria,
    Notas: expense.notas || '',
  };
  writeRow(SHEET_NAMES.GASTOS, rowData, id);
  return { success: true, id };
}

// ============================================
// CONFIG
// ============================================

function getConfig() {
  const data = readSheet('config');
  const config = {};
  data.forEach(row => {
    if (row.Clave) config[row.Clave] = row.Valor;
  });
  return config;
}

function saveConfig(configObj) {
  const sheet = getSheet(SHEET_NAMES.CONFIG);
  const existing = getConfig();
  const merged = { ...existing, ...configObj };
  
  // Limpiar y reescribir
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 2).clearContent();
  
  const rows = Object.entries(merged).map(([k, v]) => [k, v]);
  if (rows.length) sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  
  return { success: true, config: merged };
}

// ============================================
// DÓLAR
// ============================================

function getDolarHistory() {
  return readSheet('dolar');
}

function addDolarRate(valor) {
  const rowData = {
    Fecha: new Date().toISOString(),
    Valor: valor,
  };
  writeRow(SHEET_NAMES.DOLAR, rowData);
  return { success: true };
}

// ============================================
// WEBHOOK MERCADO PAGO
// ============================================

function processWebhookMP(data) {
  // Recibe: { externalReference, mpPaymentId, status, statusDetail, amount, ... }
  if (!data.externalReference) return { error: 'Falta externalReference' };
  
  const updates = {
    MP_PaymentID: data.mpPaymentId,
    MP_Status: data.status,
    Estado: mapMPStatus(data.status),
  };
  
  const result = updateOrder(data.externalReference, updates);
  
  // Si aprobado y era pendiente, disparar confirmación
  if (data.status === 'approved') {
    // TODO: Enviar email/WhatsApp de confirmación
    // TODO: Actualizar stock si no se hizo en frontend
  }
  
  return { success: true, ...result };
}

function mapMPStatus(mpStatus) {
  const map = {
    'approved': 'confirmado',
    'pending': 'pendiente',
    'rejected': 'cancelado',
    'cancelled': 'cancelado',
    'refunded': 'cancelado',
    'in_process': 'pendiente',
    'in_mediation': 'pendiente',
  };
  return map[mpStatus] || mpStatus;
}

// ============================================
// ESTADÍSTICAS
// ============================================

function getStats(period) {
  const orders = readSheet('pedidos').filter(o => o.Estado !== 'cancelado');
  const now = new Date();
  
  // Filtrar por período
  let filtered = orders;
  if (period && period !== 'all') {
    const cutoff = new Date(now);
    switch (period) {
      case 'hoy': cutoff.setHours(0,0,0,0); break;
      case 'semana': cutoff.setDate(cutoff.getDate() - 7); break;
      case 'mes': cutoff.setMonth(cutoff.getMonth() - 1); break;
      case 'trimestre': cutoff.setMonth(cutoff.getMonth() - 3); break;
      case 'anio': cutoff.setFullYear(cutoff.getFullYear() - 1); break;
    }
    filtered = orders.filter(o => new Date(o.Fecha) >= cutoff);
  }
  
  const ingresos = filtered.reduce((s, o) => s + (Number(o.Total) || 0), 0);
  const costos = filtered.reduce((s, o) => s + (Number(o.CostoTotal) || 0), 0);
  const ganancia = ingresos - costos;
  const margen = ingresos > 0 ? (ganancia / ingresos * 100) : 0;
  
  const porEstado = {};
  ['pendiente', 'confirmado', 'en_preparacion', 'enviado', 'entregado'].forEach(e => {
    porEstado[e] = filtered.filter(o => o.Estado === e).length;
  });
  
  // Top productos
  const vendidos = {};
  filtered.forEach(o => {
    try {
      const items = JSON.parse(o.Items || '[]');
      items.forEach(item => {
        vendidos[item.productoId] = (vendidos[item.productoId] || 0) + item.cantidad;
      });
    } catch (e) {}
  });
  
  const products = readSheet('productos');
  const topProductos = Object.entries(vendidos)
    .map(([id, cant]) => {
      const p = products.find(pr => pr.ID == id);
      return { id, nombre: p?.Nombre || id, cantidad: cant };
    })
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);
  
  // Ventas por día (últimos 30)
  const ventasPorDia = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    ventasPorDia[key] = { fecha: key, ingresos: 0, pedidos: 0 };
  }
  filtered.forEach(o => {
    const key = (o.Fecha || '').slice(0, 10);
    if (ventasPorDia[key]) {
      ventasPorDia[key].ingresos += Number(o.Total) || 0;
      ventasPorDia[key].pedidos += 1;
    }
  });
  
  return {
    periodo: period || 'total',
    totalPedidos: filtered.length,
    pedidosActivos: filtered.filter(o => !['entregado', 'cancelado'].includes(o.Estado)).length,
    ingresos,
    costos,
    ganancia,
    margen,
    ticketProm: filtered.length > 0 ? ingresos / filtered.length : 0,
    porEstado,
    topProductos,
    ventasPorDia: Object.values(ventasPorDia),
  };
}

// ============================================
// UTILIDADES
// ============================================

function testConnection() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    return { success: true, sheets: ss.getSheets().map(s => s.getName()) };
  } catch (e) {
    return { error: e.toString() };
  }
}

// Ejecutar una vez para crear hojas si no existen
function setupSheets() {
  Object.values(SHEET_NAMES).forEach(name => {
    const sheet = getSheet(name);
    const headers = HEADERS[name.toUpperCase()];
    if (headers && sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  });
  return { success: true, message: 'Hojas creadas/verificadas' };
}