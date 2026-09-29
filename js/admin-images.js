/* ============================================================
   AdminImages — subir fotos desde la compu o el celular
   ------------------------------------------------------------
   Antes el admin solo aceptaba un link https:// a la imagen.
   Ahora:
   - Botón "📷 Subir foto": acepta JPG, PNG, WEBP, GIF, AVIF, BMP
     (y HEIC en los navegadores que lo abren, como Safari).
   - La foto se achica a 1600 px como máximo, se pasa a JPG y se
     corrige la rotación de las fotos de celular.
   - Se guarda en Google Drive (carpeta "PrincessLov - Fotos de
     productos") a través del Apps Script, y en la planilla queda
     solo el link, no la imagen entera.
   - Si pegan un link de Google Drive "compartido", se convierte
     solo al formato que se puede mostrar en la tienda.
   ============================================================ */

const AdminImages = {
  MAX_LADO: 1600,
  CALIDAD: 0.85,
  MAX_ORIGINAL: 25 * 1024 * 1024,

  /** drive.google.com/file/d/ID/view → https://lh3.googleusercontent.com/d/ID */
  normalizarUrl(url) {
    const u = String(url || '').trim();
    const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?(?:[^#]*&)?id=)([\w-]{20,})/);
    return m ? 'https://lh3.googleusercontent.com/d/' + m[1] : u;
  },

  esHeic(file) {
    return /hei[cf]/i.test(file.type || '') || /\.hei[cf]$/i.test(file.name || '');
  },

  esImagen(file) {
    return /^image\//.test(file.type || '') || /\.(jpe?g|png|webp|gif|avif|bmp|hei[cf])$/i.test(file.name || '');
  },

  /** Devuelve { fuente, ancho, alto, liberar } listo para dibujar en un canvas */
  async decodificar(file) {
    if (window.createImageBitmap) {
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return { fuente: bmp, ancho: bmp.width, alto: bmp.height, liberar: () => bmp.close && bmp.close() };
      } catch (e) { /* probamos con <img> */ }
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
    return { fuente: img, ancho: img.naturalWidth, alto: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) };
  },

  /** Cualquier imagen que el navegador pueda abrir → data URL JPG achicada */
  async aJpeg(file) {
    const d = await this.decodificar(file);
    try {
      if (!d.ancho || !d.alto) throw new Error('Imagen vacía');
      const esc = Math.min(1, this.MAX_LADO / Math.max(d.ancho, d.alto));
      const w = Math.round(d.ancho * esc), h = Math.round(d.alto * esc);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; // PNG con transparencia → fondo blanco (JPG no tiene transparencia)
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(d.fuente, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', this.CALIDAD);
    } finally {
      d.liberar();
    }
  },

  /** Procesa y sube un archivo. Devuelve el link público de la foto. */
  async subir(file) {
    if (!file) throw new Error('No se eligió ninguna foto');
    if (!this.esImagen(file)) throw new Error('Ese archivo no es una foto');
    if (file.size > this.MAX_ORIGINAL) throw new Error('La foto pesa más de 25 MB');
    if (typeof AdminSync !== 'undefined' && !AdminSync.habilitado()) {
      throw new Error('Para subir fotos primero conectá la planilla (Configuración → Token de administración)');
    }

    let dataUrl;
    try {
      dataUrl = await this.aJpeg(file);
    } catch (e) {
      if (this.esHeic(file)) {
        throw new Error('La foto está en formato HEIC (iPhone) y esta compu no la puede abrir. ' +
          'Mandátela por WhatsApp y guardala desde ahí (queda en JPG), o en el iPhone: ' +
          'Ajustes → Cámara → Formatos → "Más compatible".');
      }
      throw new Error('No se pudo abrir la foto. Probá guardarla como JPG o PNG.');
    }

    const res = await SheetsService.postToAppsScript('upload_image', {
      image: { data: dataUrl, mimeType: 'image/jpeg', name: file.name || 'producto' },
    });
    if (!res || !res.url) throw new Error('El servidor no devolvió el link de la foto');
    return res.url;
  },

  /**
   * Agrega el botón "📷 Subir foto" al lado de un campo de link de imagen.
   * Al terminar completa el campo y dispara 'input' (actualiza la vista previa).
   */
  attach(urlInput) {
    if (!urlInput || urlInput.dataset.imgUpload) return;
    urlInput.dataset.imgUpload = '1';

    const wrap = document.createElement('div');
    wrap.className = 'img-upload';
    urlInput.parentNode.insertBefore(wrap, urlInput);
    wrap.appendChild(urlInput);

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*,.heic,.heif';
    file.hidden = true;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-secondary img-upload__btn';
    btn.textContent = '📷 Subir foto';

    wrap.appendChild(btn);
    wrap.appendChild(file);

    btn.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0];
      file.value = '';
      if (!f) return;
      btn.disabled = true;
      btn.textContent = '⏳ Subiendo…';
      try {
        const url = await this.subir(f);
        urlInput.value = url;
        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
        AdminApp.toast('Foto subida ✅');
      } catch (e) {
        const msg = /autorizado/i.test(e.message) ? 'El token no coincide con el del Apps Script' : e.message;
        AdminApp.toast(msg, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '📷 Subir foto';
      }
    });

    // Links de Drive pegados a mano → formato que se ve en la tienda
    urlInput.addEventListener('change', () => {
      const n = this.normalizarUrl(urlInput.value);
      if (n !== urlInput.value) {
        urlInput.value = n;
        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  },
};
