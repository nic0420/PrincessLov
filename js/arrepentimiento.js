/* ============================================
   BOTÓN DE ARREPENTIMIENTO (Res. 424/2020)
   Genera un código de trámite en el momento, registra la
   solicitud en la planilla (si está conectada) y abre WhatsApp.
   ============================================ */
(function () {
  const form = document.getElementById('form-arr');
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  const fecha = $('arr-fecha');
  if (fecha) fecha.max = new Date().toISOString().slice(0, 10);

  function codigoTramite() {
    const d = new Date();
    const f = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const r = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().slice(0, 5).padStart(5, '0');
    return `ARR-${f}-${r}`;
  }

  function setMsg(html, ok) {
    const el = $('arr-msg');
    el.innerHTML = html;
    el.className = 'form-arr__msg form-arr__msg--' + (ok ? 'ok' : 'err');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (id) => ($(id)?.value || '').trim();
    const datos = {
      nombre: v('arr-nombre'), telefono: v('arr-telefono'), email: v('arr-email'),
      pedido: v('arr-pedido'), fechaRecepcion: v('arr-fecha'), productos: v('arr-productos'), motivo: v('arr-motivo'),
    };
    if (datos.nombre.length < 2) return setMsg('Completá tu nombre.', false);
    const tel = datos.telefono.replace(/\D/g, '');
    if (tel.length < 8 || tel.length > 15) return setMsg('Revisá el teléfono.', false);
    if (datos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.email)) return setMsg('El email no parece válido.', false);
    if (!datos.fechaRecepcion) return setMsg('Indicá la fecha en que recibiste el producto.', false);
    if (!datos.productos) return setMsg('Contanos qué producto(s) querés devolver.', false);

    const codigo = codigoTramite();
    const texto = [
      'Hola PrincessLov, quiero ejercer mi DERECHO DE ARREPENTIMIENTO (Ley 24.240 art. 34).',
      `Código de trámite: ${codigo}`,
      '',
      `Nombre: ${datos.nombre}`,
      `Teléfono: ${datos.telefono}`,
      datos.email ? `Email: ${datos.email}` : '',
      datos.pedido ? `Pedido: ${datos.pedido}` : '',
      `Recibido el: ${datos.fechaRecepcion}`,
      `Producto(s): ${datos.productos}`,
      datos.motivo ? `Comentario: ${datos.motivo}` : '',
    ].filter(Boolean).join('\n');

    // WhatsApp primero (sin await antes) para que el celular no bloquee la ventana
    const numero = String(CONFIG.negocio?.whatsapp || '').replace(/\D/g, '');
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
    let win = null;
    try { win = window.open(url, '_blank'); } catch {}
    if (win) { try { win.opener = null; } catch {} }

    if (!$('arr-website').value && typeof SheetsService !== 'undefined') {
      SheetsService.appsScriptUrl = appsScriptConfigurado();
      if (SheetsService.appsScriptUrl) {
        SheetsService.postToAppsScript('arrepentimiento', { solicitud: { codigo, ...datos } }, { keepalive: true })
          .catch(err => console.warn('[Arrepentimiento] no se registró en la planilla:', err.message));
      }
    }

    setMsg(`Tu código de trámite es <span class="codigo">${escHtml(codigo)}</span>. Guardalo.<br>
      ${win ? 'Se abrió WhatsApp: tocá <strong>Enviar</strong> para completar la solicitud.' : ''}
      <br><a href="${escHtml(url)}" target="_blank" rel="noopener">Abrir WhatsApp con mi solicitud</a>`, true);
    $('arr-btn').disabled = true;
  });
})();
