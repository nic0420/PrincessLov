/**
 * ClubPrinceForm.jsx — Entregable React/Next.js (Lead Gen)
 * Formulario: Nombre, Teléfono, Ciudad -> POST a endpoint Google Sheets (nueva pestaña ClubPrince_Leads)
 * Reutiliza el mismo endpoint de sheets.appsScriptUrl que el checkout.
 */
'use client';
import { useState } from 'react';

const ENDPOINT = process.env.NEXT_PUBLIC_SHEETS_URL || 'https://script.google.com/macros/s/TU_SCRIPT_ID/exec';

export default function ClubPrinceForm({ onSuccess }) {
  const [form, setForm] = useState({ nombre: '', telefono: '', ciudad: '' });
  const [status, setStatus] = useState({ loading: false, msg: '', ok: false });

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.telefono.trim() || !form.ciudad.trim()) {
      setStatus({ loading: false, msg: 'Completá nombre, teléfono y ciudad.', ok: false });
      return;
    }
    setStatus({ loading: true, msg: '', ok: false });
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'club_prince_lead',
          lead: { nombre: form.nombre.trim(), telefono: form.telefono.trim(), ciudad: form.ciudad.trim(), origen: 'Club Prince Web', estado: 'nuevo' },
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.error) throw new Error(data.error);
      setStatus({ loading: false, msg: '¡Gracias! Ya sos parte del Club Prince 💕', ok: true });
      setForm({ nombre: '', telefono: '', ciudad: '' });
      onSuccess?.();
    } catch (err) {
      setStatus({ loading: false, msg: err.message || 'Error al guardar. Intentá de nuevo.', ok: false });
    }
  }

  return (
    <form onSubmit={onSubmit} className="club-prince-form">
      <div className="grid">
        <label>Nombre *<input name="nombre" value={form.nombre} onChange={onChange} required placeholder="Tu nombre" autoComplete="name" /></label>
        <label>Teléfono *<input name="telefono" value={form.telefono} onChange={onChange} required placeholder="Ej: 3757 123456" inputMode="numeric" autoComplete="tel" /></label>
        <label>Ciudad *<input name="ciudad" value={form.ciudad} onChange={onChange} required placeholder="Ej: Puerto Iguazú" autoComplete="address-level2" /></label>
      </div>
      <button type="submit" disabled={status.loading}>{status.loading ? 'Enviando…' : '✨ Quiero ser parte'}</button>
      {status.msg && <p className={status.ok ? 'msg-ok' : 'msg-err'}>{status.msg}</p>}
      <style jsx>{`
        .club-prince-form .grid { display:grid; grid-template-columns: repeat(3,1fr); gap:12px; margin-bottom:16px; }
        @media(max-width:700px){ .club-prince-form .grid{ grid-template-columns:1fr; } }
        input{ width:100%; padding:12px 14px; border:1px solid #e8ddd9; border-radius:10px; }
        button{ width:100%; padding:14px; background:#800020; color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer; }
        .msg-ok{ color:#10B981; font-weight:600; } .msg-err{ color:#EF4444; font-weight:600; }
      `}</style>
    </form>
  );
}

/**
 * Uso:
 * import ClubPrinceForm from '@/components/ClubPrinceForm';
 * <ClubPrinceForm />
 *
 * Sheet nueva: ClubPrince_Leads con columnas ID, Fecha, Nombre, Telefono, Ciudad, Origen, Estado
 * Deploy Apps Script: ver google-apps-script.gs -> action: club_prince_lead
 */
