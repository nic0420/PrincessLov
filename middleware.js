/**
 * Protección del panel de administración (Vercel Routing Middleware).
 * --------------------------------------------------------------------
 * Pide usuario y contraseña (HTTP Basic, siempre sobre HTTPS) antes de
 * servir /admin y los archivos que solo usa el admin.
 *
 * Configurar en Vercel > Settings > Environment Variables:
 *   ADMIN_USER       ej: yanela
 *   ADMIN_PASSWORD   una contraseña larga (12+ caracteres, no reutilizada)
 *
 * Si las variables no están cargadas, el admin queda BLOQUEADO (fail-closed).
 */

export const config = {
  matcher: [
    '/admin',
    '/admin.html',
    '/admin/:path*',
    '/js/:file',
    '/css/admin.css',
    '/data/admin-config.js',
  ],
};

function esRutaAdmin(pathname) {
  return pathname === '/admin'
    || pathname === '/admin.html'
    || pathname.startsWith('/admin/')
    || /^\/js\/admin-[\w-]+\.js$/.test(pathname)
    || pathname === '/js/admin.js'
    || pathname === '/css/admin.css'
    || pathname === '/data/admin-config.js';
}

/** Comparación en tiempo constante (evita ataques de timing) */
function igual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

function pedirLogin(mensaje = 'Acceso restringido') {
  return new Response(mensaje, {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="PrincessLov Admin", charset="UTF-8"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url);
  if (!esRutaAdmin(pathname)) return; // la tienda pública sigue normal

  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass || pass.length < 10) {
    return new Response(
      'Panel bloqueado: configurá ADMIN_USER y ADMIN_PASSWORD (10+ caracteres) en Vercel > Settings > Environment Variables y volvé a desplegar.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } },
    );
  }

  const header = request.headers.get('authorization') || '';
  if (header.startsWith('Basic ')) {
    let decoded = '';
    try { decoded = atob(header.slice(6)); } catch { decoded = ''; }
    const idx = decoded.indexOf(':');
    const u = idx >= 0 ? decoded.slice(0, idx) : '';
    const p = idx >= 0 ? decoded.slice(idx + 1) : '';
    const okUser = igual(u, user);
    const okPass = igual(p, pass);
    if (okUser && okPass) return; // continúa hacia el archivo estático
  }

  // Frena un poco los intentos de fuerza bruta
  await new Promise((r) => setTimeout(r, 400));
  return pedirLogin();
}
