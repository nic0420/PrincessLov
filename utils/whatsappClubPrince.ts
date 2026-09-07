/**
 * whatsappClubPrince.ts — Entregable: función condicional Club Prince para URL de WhatsApp
 * Si el carrito contiene un producto categoría "club-prince" o flag isClubPrince, el mensaje
 * IGNORA el saludo estándar e inicia obligatoriamente con: "Yanela del club Prince quiero esto"
 */

export type CartItem = {
  id: string;
  nombre: string;
  categoria?: string;
  isClubPrince?: boolean;
  tags?: string[];
  cantidad: number;
  variante?: string | null;
  precioARS: number;
};

// Saludo exacto exigido
export const CLUB_PRINCE_HEADER = 'Yanela del club Prince quiero esto';

export function hasClubPrinceItem(items: CartItem[]): boolean {
  return items.some((it) => {
    const catVip = it.categoria === 'club-prince' || it.categoria === 'Club Prince' || it.isClubPrince === true;
    const tagVip = Array.isArray(it.tags) && it.tags.some((t) => String(t).toLowerCase().includes('club'));
    return catVip || tagVip;
  });
}

/**
 * Construye la URL de WhatsApp con encodeURIComponent y bloque condicional if/else VIP.
 * - detallePedido: string ya armado con items, subtotal, envío, total y datos del cliente.
 * - phone: número sin + (ej: 5493757338837)
 */
export function buildWhatsAppUrl(items: CartItem[], detallePedido: string, phone: string): string {
  const isVip = hasClubPrinceItem(items);

  // if/else requerido
  let header: string;
  if (isVip) {
    header = CLUB_PRINCE_HEADER; // inicia obligatoriamente con esta cadena exacta
  } else {
    header = `Hola! Quiero hacer un pedido en PrincessLov 🛍️`;
  }

  const mensaje = `${header}\n\n${detallePedido}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
}

// Ejemplo vanilla implementado en js/cart.js:
// generarMensajeWhatsApp() usa this._hasClubPrinceItem() y hace:
// if (isClubPrince) mensaje = `Yanela del club Prince quiero esto\n\n${detalle}`;
// else mensaje = CONFIG.whatsappTemplate.replace(...)
