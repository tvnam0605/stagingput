'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, Pallet } from '@/lib/types'
import { StatusBadge } from '@/app/page'

const PREFIXES = [
  { code: 'PL', name: 'Pallet' },
  { code: 'RK', name: 'Rack' },
  { code: 'CR', name: 'Carton' },
  { code: 'BN', name: 'Bin' },
]

const LABEL_PRESETS = [
  { id: '60x40', label: '60 × 40 mm', w: 60, h: 40 },
  { id: '100x70', label: '100 × 70 mm', w: 100, h: 70 },
  { id: '148x105', label: 'A6 (148 × 105)', w: 148, h: 105 },
  { id: 'a4', label: 'A4 — nhiều nhãn', w: 0, h: 0 },
]

interface LabelSettings {
  preset: string
  widthMm: number
  heightMm: number
  colsPerRow: number
  showQr: boolean
  showBarcode: boolean
  showDate: boolean
  showNote: boolean
}

const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  preset: '100x70',
  widthMm: 100,
  heightMm: 70,
  colsPerRow: 2,
  showQr: true,
  showBarcode: false,
  showDate: true,
  showNote: false,
}

function LabelSettingsModal({
  settings,
  onClose,
  onApply,
}: {
  settings: LabelSettings
  onClose: () => void
  onApply: (s: LabelSettings) => void
}) {
  const [local, setLocal] = useState<LabelSettings>(settings)

  function set<K extends keyof LabelSettings>(k: K, v: LabelSettings[K]) {
    setLocal(prev => ({ ...prev, [k]: v }))
  }

  function selectPreset(id: string) {
    const p = LABEL_PRESETS.find(x => x.id === id)
    if (!p) return
    if (id === 'a4') {
      set('preset', 'a4')
    } else {
      setLocal(prev => ({ ...prev, preset: id, widthMm: p.w, heightMm: p.h }))
    }
  }

  return (
    /* Backdrop */
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 18, width: 360,
        boxShadow: '0 16px 60px rgba(0,0,0,0.25)',
        overflow: 'hidden', fontFamily: 'inherit',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1916' }}>Cài đặt nhãn in</div>
            <div style={{ fontSize: 12, color: '#a09e96', marginTop: 2 }}>Tuỳ chỉnh kích thước &amp; nội dung</div>
          </div>
          <button onClick={onClose} style={{
            background: '#f0efe9', border: 'none', borderRadius: 8,
            width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: '#6b6a64',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Preset size picker */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#a09e96', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Kích thước
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {LABEL_PRESETS.map(p => (
                <button key={p.id} onClick={() => selectPreset(p.id)} style={{
                  background: local.preset === p.id ? '#1a1916' : '#f0efe9',
                  color: local.preset === p.id ? '#fff' : '#6b6a64',
                  border: `1px solid ${local.preset === p.id ? '#1a1916' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 8, padding: '9px 10px', fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom dimensions — chỉ hiện khi không phải A4 */}
          {local.preset !== 'a4' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#a09e96', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Rộng (mm)</label>
                <input
                  type="number" value={local.widthMm} min={30} max={300}
                  onChange={e => set('widthMm', Math.max(30, Math.min(300, +e.target.value)))}
                  style={{
                    width: '100%', background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 8, color: '#1a1916', fontFamily: 'monospace', fontSize: 14,
                    padding: '9px 12px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#a09e96', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Cao (mm)</label>
                <input
                  type="number" value={local.heightMm} min={20} max={300}
                  onChange={e => set('heightMm', Math.max(20, Math.min(300, +e.target.value)))}
                  style={{
                    width: '100%', background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 8, color: '#1a1916', fontFamily: 'monospace', fontSize: 14,
                    padding: '9px 12px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          )}

          {/* Số cột mỗi hàng — chỉ hiện khi A4 */}
          {local.preset === 'a4' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#a09e96', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Số nhãn mỗi hàng &nbsp;<span style={{ fontFamily: 'monospace', color: '#1a1916', fontSize: 13 }}>{local.colsPerRow}</span>
              </label>
              <input type="range" min={1} max={4} value={local.colsPerRow}
                onChange={e => set('colsPerRow', +e.target.value)}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#a09e96', marginTop: 2 }}>
                {[1, 2, 3, 4].map(n => <span key={n}>{n}</span>)}
              </div>
            </div>
          )}

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }} />

          {/* Nội dung hiển thị */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#a09e96', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Nội dung hiển thị
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([
                ['showQr', 'QR code'],
                ['showBarcode', 'Barcode'],
                ['showDate', 'Ngày tạo'],
                ['showNote', 'Ghi chú'],
              ] as [keyof LabelSettings, string][]).map(([key, label]) => (
                <label key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: local[key] ? '#f0efe9' : 'transparent',
                  border: `1px solid ${local[key] ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)'}`,
                  borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                  transition: 'all 0.12s',
                }}>
                  <input type="checkbox"
                    checked={local[key] as boolean}
                    onChange={e => set(key, e.target.checked as LabelSettings[typeof key])}
                    style={{ width: 14, height: 14, accentColor: '#1a1916', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: '#1a1916', fontWeight: 500 }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Preview mini */}
          <div style={{
            background: '#f0efe9', borderRadius: 10, padding: 14,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            border: '1px dashed rgba(0,0,0,0.15)',
          }}>
            <div style={{
              background: '#fff', border: '1px solid #ddd', borderRadius: 6,
              padding: '10px 14px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 4, minWidth: 90,
              aspectRatio: local.preset !== 'a4' ? `${local.widthMm}/${local.heightMm}` : 'auto',
              maxHeight: 130, justifyContent: 'center',
            }}>
              <div style={{ fontSize: 7, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.1em' }}>WMS STATION</div>
              {local.showQr && (
                <div style={{ width: 36, height: 36, background: '#1a1916', borderRadius: 3, display: 'grid', gridTemplateColumns: 'repeat(6,6px)', gap: 0 }}>
                  {Array.from({ length: 36 }, (_, i) =>
                    <div key={i} style={{ width: 6, height: 6, background: [0,1,2,6,12,7,13,14,30,31,35,34,29,28,23,24,18,17].includes(i) ? '#fff' : 'transparent' }} />
                  )}
                </div>
              )}
              {local.showBarcode && (
                <div style={{ display: 'flex', gap: 1, height: 18 }}>
                  {[2,1,3,1,2,1,1,2,3,1,2,1,1,3,1].map((w, i) => (
                    <div key={i} style={{ width: w, background: i % 2 === 0 ? '#1a1916' : 'transparent', height: '100%' }} />
                  ))}
                </div>
              )}
              <div style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 600, color: '#1a1916' }}>PL-250403-0001</div>
              {local.showDate && <div style={{ fontSize: 7, color: '#bbb' }}>03/04/2025</div>}
              {local.showNote && <div style={{ fontSize: 7, color: '#999' }}>Supplier A</div>}
            </div>
            {local.preset === 'a4' && local.colsPerRow > 1 && (
              <div style={{ width: 3, height: 60, borderLeft: '1px dashed #ccc', margin: '0 6px' }} />
            )}
            {local.preset === 'a4' && local.colsPerRow > 1 && (
              <div style={{
                background: '#fff', border: '1px solid #ddd', borderRadius: 6,
                padding: '10px 14px', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4, minWidth: 90, maxHeight: 130, justifyContent: 'center', opacity: 0.5,
              }}>
                <div style={{ fontSize: 7, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.1em' }}>WMS STATION</div>
                <div style={{ width: 36, height: 36, background: '#eee', borderRadius: 3 }} />
                <div style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 600, color: '#ccc' }}>PL-250403-0002</div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, background: '#f0efe9', color: '#6b6a64',
              border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8,
              fontSize: 13, fontWeight: 600, padding: 11, cursor: 'pointer',
            }}>Huỷ</button>
            <button onClick={() => onApply(local)} style={{
              flex: 2, background: '#1a1916', color: '#fff',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 700, padding: 11, cursor: 'pointer', letterSpacing: '0.03em',
            }}>Áp dụng &amp; In</button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  const [showLabelSettings, setShowLabelSettings] = useState(false)
  const [labelSettings, setLabelSettings] = useState<LabelSettings>(DEFAULT_LABEL_SETTINGS)
  const labelSettingsRef = useRef<LabelSettings>(DEFAULT_LABEL_SETTINGS)
  const [allPallets, setAllPallets] = useState<Pallet[]>([])
  const [search, setSearch] = useState('')
  const [reprintingId, setReprintingId] = useState<string | null>(null)

  // Lưu QR dataURL và barcode SVG string riêng — không dùng DOM clone
  const qrDataUrls = useRef<Record<string, string>>({})
  const barcodeSvgs = useRef<Record<string, string>>({})

  const activePrefix = customPrefix.toUpperCase() || prefix

  async function fetchAllPallets() {
    const { data } = await supabase
      .from('pallets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (data) setAllPallets(data as Pallet[])
  }

  // In lại pallet bất kỳ — generate QR/barcode on-the-fly
  async function reprintSingle(p: Pallet) {
    setReprintingId(p.id)
    try {
      const QRCode = (await import('qrcode')).default
      const JsBarcode = (await import('jsbarcode')).default

      // QR → dataURL
      const qrUrl = await QRCode.toDataURL(p.code, { width: 200, margin: 1 })

      // Barcode → SVG string qua canvas tạm
      const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      JsBarcode(svgEl, p.code, { format: 'CODE128', width: 1.5, height: 48, displayValue: false, margin: 4 })
      const bcSvg = svgEl.outerHTML

      // Lưu vào refs để buildPrintHtml dùng
      qrDataUrls.current[p.id] = qrUrl
      barcodeSvgs.current[p.id] = bcSvg

      printWithSettings([p], labelSettingsRef.current)
    } catch (e) {
      showToast('Lỗi khi in: ' + String(e))
    } finally {
      setReprintingId(null)
    }
  }

  function buildPrintHtml(pallets: Pallet[], s: LabelSettings): string {
    const isA4 = s.preset === 'a4'
    const labelCss = isA4
      ? `.item { width: calc(${100 / s.colsPerRow}% - ${Math.ceil(8 * (s.colsPerRow - 1) / s.colsPerRow)}px); }`
      : `.item { width: ${s.widthMm}mm; min-height: ${s.heightMm}mm; }`

    const itemsHtml = pallets.map(p => {
      const qrImg = s.showQr && qrDataUrls.current[p.id]
        ? `<img src="${qrDataUrls.current[p.id]}" style="width:100px;height:100px;" />`
        : ''
      const bcSvg = s.showBarcode && barcodeSvgs.current[p.id]
        ? barcodeSvgs.current[p.id]
        : ''
      const dateStr = s.showDate
        ? `<div class="date">${new Date(p.created_at).toLocaleDateString('vi-VN')}</div>`
        : ''
      const noteStr = s.showNote && p.note
        ? `<div class="note">${p.note}</div>`
        : ''
      return `<div class="item">
  <div class="hdr">WMS — RECEIVER STATION</div>
  ${qrImg}
  ${bcSvg}
  <div class="code">${p.code}</div>
  ${dateStr}
  ${noteStr}
</div>`
    }).join('\n')

    return `<!DOCTYPE html>
<html>
<head>
  <title>In nhãn Pallet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: white; font-family: monospace; padding: ${isA4 ? '8mm' : '4px'}; }
    .wrap { display: flex; flex-wrap: wrap; gap: 8px; ${isA4 ? 'width:100%;' : ''} }
    .item {
      border: 1px solid #ccc; border-radius: 8px;
      padding: 12px 16px; display: flex; flex-direction: column;
      align-items: center; gap: 6px;
      break-inside: avoid; page-break-inside: avoid;
    }
    ${labelCss}
    .hdr { font-size: 9px; color: #999; letter-spacing:.1em; text-transform:uppercase; font-weight:700;
           border-bottom:1px solid #eee; padding-bottom:6px; width:100%; text-align:center; }
    .code { font-size: 11px; font-weight: 600; letter-spacing:.04em; }
    .date { font-size: 10px; color: #999; }
    .note { font-size: 10px; color: #777; }
    img, svg { display: block; max-width: 100%; }
    @media print { body { padding: ${isA4 ? '8mm' : '2px'}; } .wrap { gap: 6px; } }
  </style>
</head>
<body>
  <div class="wrap">${itemsHtml}</div>
</body>
</html>`
  }

  function printWithSettings(pallets: Pallet[], s: LabelSettings) {
    if (pallets.length === 0) return

    // Xóa iframe cũ nếu còn
    document.getElementById('__print_iframe')?.remove()

    const iframe = document.createElement('iframe')
    iframe.id = '__print_iframe'
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(buildPrintHtml(pallets, s))
    doc.close()

    // Chờ load xong rồi print — không cần timeout dài vì không có canvas/script bên trong
    iframe.onload = () => {
      iframe.contentWindow?.print()
      setTimeout(() => iframe.remove(), 1000)
    }
  }

  function handleApplyAndPrint(s: LabelSettings) {
    setLabelSettings(s)
    labelSettingsRef.current = s
    setShowLabelSettings(false)
    printWithSettings(created, s)
  }

  function handleQuickPrint() {
    printWithSettings(created, labelSettingsRef.current)
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

  useEffect(() => { fetchAllPallets() }, [])

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
    fetchAllPallets()
    showToast(`Đã tạo ${newPallets.length} pallet`)
    setTimeout(() => renderCodes(newPallets), 300)
  }

  async function renderCodes(pallets: Pallet[]) {
    if (typeof window === 'undefined') return
    const QRCode = (await import('qrcode')).default
    const JsBarcode = (await import('jsbarcode')).default
    for (const p of pallets) {
      // QR: render vào canvas preview + lưu dataURL để in
      try {
        const c = document.getElementById(`qr-${p.id}`) as HTMLCanvasElement | null
        if (c) {
          await QRCode.toCanvas(c, p.code, { width: 100, margin: 1 })
          qrDataUrls.current[p.id] = c.toDataURL('image/png')
        }
      } catch { /* ignore */ }
      // Barcode: render vào SVG preview + lưu outerHTML để in
      try {
        const s = document.getElementById(`bc-${p.id}`)
        if (s) {
          JsBarcode(s, p.code, { format: 'CODE128', width: 1.5, height: 48, displayValue: false, margin: 4 })
          barcodeSvgs.current[p.id] = s.outerHTML
        }
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
                style={{ width: '100%', background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, color: '#1a1916', fontFamily: 'monospace', fontSize: 13, padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6a64', marginBottom: 6 }}>Ngày tham chiếu</label>
                <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)}
                  style={{ width: '100%', background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, color: '#1a1916', fontSize: 13, padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6a64', marginBottom: 6 }}>Số lượng</label>
                <input type="number" value={qty} onChange={e => setQty(Math.max(1, Math.min(50, +e.target.value)))} min={1} max={50}
                  style={{ width: '100%', background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, color: '#1a1916', fontFamily: 'monospace', fontSize: 13, padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6a64', marginBottom: 6 }}>Ghi chú (tùy chọn)</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="VD: Hàng Supplier A, PO-2025..."
                style={{ width: '100%', background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, color: '#1a1916', fontSize: 13, padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }} />
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
              <div>
                <span style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 14, fontWeight: 700 }}>Xem trước nhãn in</span>
                {/* Badge hiển thị cài đặt hiện tại */}
                <span style={{
                  marginLeft: 10, fontSize: 11, color: '#6b6a64',
                  background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 6, padding: '2px 8px', fontFamily: 'monospace',
                }}>
                  {labelSettings.preset === 'a4'
                    ? `A4 · ${labelSettings.colsPerRow} cột`
                    : `${labelSettings.widthMm}×${labelSettings.heightMm}mm`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Nút cài đặt */}
                <button
                  onClick={() => setShowLabelSettings(true)}
                  style={{
                    background: 'transparent', color: '#6b6a64',
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: 6, fontSize: 12, padding: '6px 12px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="currentColor"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M8 1a1 1 0 0 1 .98.804l.23 1.15a5.02 5.02 0 0 1 1.06.617l1.1-.44a1 1 0 0 1 1.225.447l1 1.732a1 1 0 0 1-.225 1.277l-.9.72a5.1 5.1 0 0 1 0 1.186l.9.72a1 1 0 0 1 .225 1.277l-1 1.732a1 1 0 0 1-1.225.447l-1.1-.44a5.02 5.02 0 0 1-1.06.617l-.23 1.15A1 1 0 0 1 8 15a1 1 0 0 1-.98-.804l-.23-1.15a5.02 5.02 0 0 1-1.06-.617l-1.1.44a1 1 0 0 1-1.225-.447l-1-1.732a1 1 0 0 1 .225-1.277l.9-.72a5.1 5.1 0 0 1 0-1.186l-.9-.72a1 1 0 0 1-.225-1.277l1-1.732A1 1 0 0 1 4.63 3.13l1.1.44a5.02 5.02 0 0 1 1.06-.617l.23-1.15A1 1 0 0 1 8 1zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" fill="currentColor"/>
                  </svg>
                  Cài đặt nhãn
                </button>
                {/* Nút in nhanh */}
                <button
                  onClick={handleQuickPrint}
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
                  {/* Canvas + SVG luôn render để lưu data, ẩn/hiện qua style */}
                  <canvas id={`qr-${p.id}`} style={{ display: labelSettings.showQr ? 'block' : 'none' }} />
                  <svg id={`bc-${p.id}`} style={{ display: labelSettings.showBarcode ? 'block' : 'none' }} />
                  <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em' }}>{p.code}</div>
                  {labelSettings.showDate && <div style={{ fontSize: 10, color: '#999', fontFamily: 'monospace' }}>{new Date(p.created_at).toLocaleDateString('vi-VN')}</div>}
                  {labelSettings.showNote && p.note && <div style={{ fontSize: 10, color: '#777' }}>{p.note}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Bảng tất cả pallets */}
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                Tất cả Pallet
                <span style={{ marginLeft: 8, fontSize: 11, color: '#a09e96', fontWeight: 400 }}>({allPallets.length})</span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 300 }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm theo mã, ghi chú..."
                  style={{
                    flex: 1, background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 8, color: '#1a1916', fontSize: 12, padding: '7px 12px', outline: 'none',
                  }}
                />
                <button onClick={fetchAllPallets} title="Làm mới" style={{
                  background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8,
                  width: 32, height: 32, cursor: 'pointer', color: '#6b6a64', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>↻</button>
              </div>
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: '#f5f4f0' }}>
                    {['Mã', 'Status', 'Ghi chú', 'Tạo lúc', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#a09e96', padding: '9px 16px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allPallets
                    .filter(p => {
                      if (!search.trim()) return true
                      const q = search.toLowerCase()
                      return p.code.toLowerCase().includes(q) || (p.note ?? '').toLowerCase().includes(q)
                    })
                    .map(p => {
                      const isNew = created.some(c => c.id === p.id)
                      return (
                        <tr key={p.id} style={{
                          borderBottom: '1px solid rgba(0,0,0,0.05)',
                          background: isNew ? 'rgba(0,200,100,0.04)' : 'transparent',
                        }}>
                          <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {isNew && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#16a34a', marginRight: 6, verticalAlign: 'middle' }} />}
                            {p.code}
                          </td>
                          <td style={{ padding: '10px 16px' }}><StatusBadge status={p.status} /></td>
                          <td style={{ padding: '10px 16px', fontSize: 12, color: '#6b6a64', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.note ?? <span style={{ color: '#ccc' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: '#a09e96', whiteSpace: 'nowrap' }}>
                            {new Date(p.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            <button
                              onClick={() => reprintSingle(p)}
                              disabled={reprintingId === p.id}
                              title="In lại nhãn"
                              style={{
                                background: 'transparent',
                                color: reprintingId === p.id ? '#ccc' : '#0d4a8f',
                                border: `1px solid ${reprintingId === p.id ? '#eee' : 'rgba(13,74,143,0.25)'}`,
                                borderRadius: 6, fontSize: 11, padding: '5px 10px',
                                cursor: reprintingId === p.id ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap',
                              }}>
                              {reprintingId === p.id ? '...' : '⎙ In'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  {allPallets.filter(p => {
                    if (!search.trim()) return true
                    const q = search.toLowerCase()
                    return p.code.toLowerCase().includes(q) || (p.note ?? '').toLowerCase().includes(q)
                  }).length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: '#a09e96' }}>
                        Không tìm thấy pallet nào
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Label Settings Modal */}
      {showLabelSettings && (
        <LabelSettingsModal
          settings={labelSettings}
          onClose={() => setShowLabelSettings(false)}
          onApply={handleApplyAndPrint}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1a1916', color: '#fff', borderRadius: 8, padding: '12px 18px', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}