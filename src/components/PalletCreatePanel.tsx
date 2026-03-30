'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, Pallet } from '@/lib/types'
import { StatusBadge } from '@/app/page'

const PREFIXES = [
  { code: 'PL', name: 'Pallet' },
  { code: 'RK', name: 'Rack' },
  { code: 'CR', name: 'Carton' },
  { code: 'BN', name: 'Bin' },
]

export default function PalletCreatePanel({ profile, onCreated }: { profile: Profile; onCreated: () => void }) {
  const [prefix, setPrefix] = useState('PL')
  const [customPrefix, setCustomPrefix] = useState('')
  const [refDate, setRefDate] = useState(new Date().toISOString().slice(0, 10))
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState('PL-20250323-0001')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<Pallet[]>([])
  const [toast, setToast] = useState('')

  const activePrefix = customPrefix.toUpperCase() || prefix

  // Chỉ in label area — mở popup riêng
  function printLabelsOnly() {
    const area = document.getElementById('label-print-area')
    if (!area) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>In nhãn Pallet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: white; font-family: monospace; padding: 16px; }
    .wrap { display: flex; flex-wrap: wrap; gap: 16px; }
    .item {
      border: 1px solid #ccc; border-radius: 8px;
      padding: 16px 20px; display: flex; flex-direction: column;
      align-items: center; gap: 8px; min-width: 220px;
      break-inside: avoid; page-break-inside: avoid;
    }
    .hdr {
      font-size: 10px; color: #999; letter-spacing: .12em;
      text-transform: uppercase; font-weight: 700;
      border-bottom: 1px solid #eee; padding-bottom: 8px;
      width: 100%; text-align: center;
    }
    .code { font-size: 12px; font-weight: 600; letter-spacing: .04em; text-align: center; }
    .date { font-size: 10px; color: #999; text-align: center; }
    .note { font-size: 10px; color: #777; text-align: center; }
    canvas, svg { display: block; max-width: 100%; }
    @media print { body { padding: 8px; } .wrap { gap: 8px; } }
  </style>
</head>
<body>
  <div class="wrap">${area.innerHTML}</div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 800); }
  <\/script>
</body>
</html>`)
    win.document.close()
  }

  useEffect(() => {
    async function calc() {
      const ds = refDate.replace(/-/g, '')
      const { data } = await supabase
        .from('pallets')
        .select('seq')
        .eq('prefix', activePrefix)
        .eq('date_str', ds)
        .order('seq', { ascending: false })
        .limit(1)
      const nextSeq = data && data.length > 0 ? (data[0].seq as number) + 1 : 1
      setPreview(`${activePrefix}-${ds}-${String(nextSeq).padStart(4, '0')}`)
    }
    if (activePrefix && refDate) calc()
  }, [activePrefix, refDate])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleCreate() {
    if (!activePrefix) { showToast('Chọn hoặc nhập tiền tố!'); return }
    setLoading(true)
    const ds = refDate.replace(/-/g, '')
    const newPallets: Pallet[] = []

    for (let i = 0; i < qty; i++) {
      const { data: seqRows } = await supabase
        .from('pallets').select('seq')
        .eq('prefix', activePrefix).eq('date_str', ds)
        .order('seq', { ascending: false }).limit(1)
      const seq = seqRows && seqRows.length > 0 ? (seqRows[0].seq as number) + 1 : 1
      const code = `${activePrefix}-${ds}-${String(seq).padStart(4, '0')}`

      const { data, error } = await supabase.from('pallets').insert({
        code, prefix: activePrefix, date_str: ds, seq,
        note: note || null, created_by: profile.id,
      }).select().single()

      if (error) { showToast(`Lỗi: ${error.message}`); break }
      if (data) newPallets.push(data as Pallet)

      await supabase.from('activity_log').insert({
        event_type: 'pallet_created',
        pallet_id: (data as Pallet).id,
        pallet_code: code,
        user_id: profile.id,
        user_email: profile.email,
      })
    }

    setCreated(newPallets)
    setLoading(false)
    onCreated()
    showToast(`Đã tạo ${newPallets.length} pallet`)
    setTimeout(() => renderCodes(newPallets), 300)
  }

  async function renderCodes(pallets: Pallet[]) {
    if (typeof window === 'undefined') return
    const QRCode = (await import('qrcode')).default
    const JsBarcode = (await import('jsbarcode')).default
    for (const p of pallets) {
      // Preview trên màn hình
      try {
        const c = document.getElementById(`qr-${p.id}`) as HTMLCanvasElement | null
        if (c) await QRCode.toCanvas(c, p.code, { width: 100, margin: 1 })
      } catch { /* ignore */ }
      try {
        const s = document.getElementById(`bc-${p.id}`)
        if (s) JsBarcode(s, p.code, { format: 'CODE128', width: 1.5, height: 48, displayValue: false, margin: 4 })
      } catch { /* ignore */ }
      // Print area (popup in)
      try {
        const cp = document.getElementById(`qr-print-${p.id}`) as HTMLCanvasElement | null
        if (cp) await QRCode.toCanvas(cp, p.code, { width: 100, margin: 1 })
      } catch { /* ignore */ }
      try {
        const sp = document.getElementById(`bc-print-${p.id}`)
        if (sp) JsBarcode(sp, p.code, { format: 'CODE128', width: 1.5, height: 48, displayValue: false, margin: 4 })
      } catch { /* ignore */ }
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Tạo Pallet mới</h1>
        <p style={{ fontSize: 13, color: '#6b6a64' }}>Sinh mã, cấu hình và in nhãn dán lên pallet thực tế</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Form */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <span style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 14, fontWeight: 700 }}>Thông tin Pallet</span>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6a64', marginBottom: 8 }}>Tiền tố thiết bị</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {PREFIXES.map(p => (
                  <button key={p.code} onClick={() => { setPrefix(p.code); setCustomPrefix('') }} style={{
                    background: (!customPrefix && prefix === p.code) ? '#1a1916' : '#f0efe9',
                    color: (!customPrefix && prefix === p.code) ? '#fff' : '#6b6a64',
                    border: '1px solid',
                    borderColor: (!customPrefix && prefix === p.code) ? '#1a1916' : 'rgba(0,0,0,0.1)',
                    borderRadius: 6, padding: '6px 14px', fontFamily: 'monospace', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}>{p.code} — {p.name}</button>
                ))}
              </div>
              <input value={customPrefix} onChange={e => setCustomPrefix(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="Hoặc nhập tùy chỉnh (VD: WH)"
                style={{ width: '100%', background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, color: '#1a1916', fontFamily: 'monospace', fontSize: 13, padding: '9px 12px', outline: 'none' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6a64', marginBottom: 6 }}>Ngày tham chiếu</label>
                <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)}
                  style={{ width: '100%', background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, color: '#1a1916', fontSize: 13, padding: '9px 12px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6a64', marginBottom: 6 }}>Số lượng</label>
                <input type="number" value={qty} onChange={e => setQty(Math.max(1, Math.min(50, +e.target.value)))} min={1} max={50}
                  style={{ width: '100%', background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, color: '#1a1916', fontFamily: 'monospace', fontSize: 13, padding: '9px 12px', outline: 'none' }} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6a64', marginBottom: 6 }}>Ghi chú (tùy chọn)</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="VD: Hàng Supplier A, PO-2025..."
                style={{ width: '100%', background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, color: '#1a1916', fontSize: 13, padding: '9px 12px', outline: 'none' }} />
            </div>

            <div style={{ background: '#f0efe9', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 8, padding: '12px 14px', fontFamily: 'monospace', fontSize: 15, fontWeight: 600, textAlign: 'center', marginBottom: 16, letterSpacing: '0.04em' }}>
              {preview}
            </div>

            <button onClick={handleCreate} disabled={loading} style={{
              width: '100%', background: loading ? '#ccc' : '#1a1916', color: '#fff',
              border: 'none', borderRadius: 8, fontFamily: 'var(--font-display, sans-serif)',
              fontSize: 14, fontWeight: 700, padding: 12, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.04em',
            }}>{loading ? 'Đang tạo...' : '⊕ Tạo & In nhãn'}</button>
          </div>
        </div>

        {/* Print preview */}
        <div>
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 14, fontWeight: 700 }}>Xem trước nhãn in</span>
              <button
                onClick={printLabelsOnly}
                disabled={created.length === 0}
                style={{
                  background: 'transparent', color: created.length === 0 ? '#ccc' : '#0d4a8f',
                  border: `1px solid ${created.length === 0 ? '#ccc' : 'rgba(13,74,143,0.3)'}`,
                  borderRadius: 6, fontSize: 12, padding: '6px 14px',
                  cursor: created.length === 0 ? 'not-allowed' : 'pointer',
                }}>
                ⎙ In nhãn
              </button>
            </div>

            {/* Label preview — hiển thị trên màn hình */}
            <div style={{ padding: 20, background: '#f0efe9', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', minHeight: 200, alignItems: 'center' }}>
              {created.length === 0 ? (
                <div style={{ color: '#a09e96', fontSize: 13, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🏷️</div>
                  Nhấn &quot;Tạo &amp; In nhãn&quot; để xem trước
                </div>
              ) : created.map(p => (
                <div key={p.id} style={{
                  background: '#fff', border: '1px solid #ddd', borderRadius: 8,
                  padding: '16px 20px', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minWidth: 220,
                }}>
                  <div style={{ fontSize: 10, color: '#999', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #eee', paddingBottom: 8, width: '100%', textAlign: 'center' }}>
                    WMS — RECEIVER STATION
                  </div>
                  <canvas id={`qr-${p.id}`} />
                  <svg id={`bc-${p.id}`} />
                  <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em' }}>{p.code}</div>
                  <div style={{ fontSize: 10, color: '#999', fontFamily: 'monospace' }}>{new Date(p.created_at).toLocaleDateString('vi-VN')}</div>
                  {p.note && <div style={{ fontSize: 10, color: '#777' }}>{p.note}</div>}
                </div>
              ))}
            </div>

            {/* Hidden area dùng để copy sang popup in — dùng class thay vì canvas/svg để tránh mất data */}
            <div id="label-print-area" style={{ display: 'none' }}>
              {created.map(p => (
                <div key={p.id} className="item">
                  <div className="hdr">WMS — RECEIVER STATION</div>
                  <canvas id={`qr-print-${p.id}`} />
                  <svg id={`bc-print-${p.id}`} />
                  <div className="code">{p.code}</div>
                  <div className="date">{new Date(p.created_at).toLocaleDateString('vi-VN')}</div>
                  {p.note && <div className="note">{p.note}</div>}
                </div>
              ))}
            </div>
          </div>

          {created.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <span style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 13, fontWeight: 700 }}>Vừa tạo ({created.length})</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f4f0' }}>
                    {['Mã', 'Status', 'Tạo lúc'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#a09e96', padding: '9px 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {created.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, fontWeight: 500 }}>{p.code}</td>
                      <td style={{ padding: '10px 16px' }}><StatusBadge status={p.status} /></td>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: '#a09e96' }}>
                        {new Date(p.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1a1916', color: '#fff', borderRadius: 8, padding: '12px 18px', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}