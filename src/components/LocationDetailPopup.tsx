'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ── Design tokens ──────────────────────────────────────────────────────────────
const F = {
  display: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
  code:    "var(--font-code, 'Fira Code', monospace)",
}

// ── Status maps ───────────────────────────────────────────────────────────────
const ASN_STATUS: Record<number, { label: string; color: string; bg: string }> = {
  0:  { label: 'Pending',   color: '#6b6a64', bg: '#f5f4f0' },
  1:  { label: 'Scanning',  color: '#0d4a8f', bg: '#e8f0fb' },
  2:  { label: 'Received',  color: '#1d6a3e', bg: '#e8f5ee' },
  3:  { label: 'Putting',   color: '#7a4a00', bg: '#fef3d7' },
  4:  { label: 'Done',      color: '#1d6a3e', bg: '#e8f5ee' },
  6:  { label: 'Arrived',   color: '#0c447c', bg: '#e6f1fb' },
  7:  { label: 'Counting',  color: '#633806', bg: '#faeeda' },
  8:  { label: 'Counted',   color: '#3B6D11', bg: '#EAF3DE' },
  9:  { label: 'Checking',  color: '#712B13', bg: '#FAECE7' },
  10: { label: 'Checked',   color: '#3C3489', bg: '#EEEDFE' },
  12: { label: 'Arriving',  color: '#085041', bg: '#E1F5EE' },
}

const DEVICE_STATUS: Record<number, { label: string; color: string; bg: string }> = {
  10:  { label: 'Pending',  color: '#6b6a64', bg: '#f5f4f0' },
  100: { label: 'Assigned', color: '#0c447c', bg: '#e6f1fb' },
  20:  { label: 'Ongoing',  color: '#633806', bg: '#faeeda' },
  80:  { label: 'Done',     color: '#1d6a3e', bg: '#e8f5ee' },
}

const AGING_STYLE: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  green:  { bg: '#f0fdf4', border: 'rgba(22,163,74,0.25)',  text: '#15803d', dot: '#16a34a', label: 'Fresh'    },
  yellow: { bg: '#fefce8', border: 'rgba(202,138,4,0.25)',  text: '#a16207', dot: '#ca8a04', label: 'Warning'  },
  orange: { bg: '#fff7ed', border: 'rgba(234,88,12,0.25)',  text: '#c2410c', dot: '#ea580c', label: 'Aging'    },
  red:    { bg: '#fef2f2', border: 'rgba(220,38,38,0.25)',  text: '#b91c1c', dot: '#dc2626', label: 'Critical' },
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface BoxDetail {
  id:                 string
  box_code:           string
  scanned_at:         string
  device_status:      number | null
  device_status_label?: string
  device_qty?:        number
  asn_id?:            string
  order_no?:          string
  asn_status_label?:  string
  arrived_at?:        string
  leadtime_hours?:    number
  aging_level?:       string
  skus: {
    sku_id:            string
    sku_name:          string | null
    received_quantity: number
  }[]
}

interface PalletGroup {
  pallet_id:       string
  pallet_code:     string
  pallet_status:   string
  asn_id?:         string
  order_no?:       string
  asn_status:      number | null          // ← fix undefined
  aging_level:     string | null          // ← fix undefined
  leadtime_hours:  number | null          // ← fix undefined
  scanned_boxes:   number
  sku_count:       number
  boxes: BoxDetail[]
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function AsnStatusBadge({ status }: { status: number | null }) {
  if (status === null) return <span style={{ color: '#a09e96', fontSize: 12 }}>—</span>
  const s = ASN_STATUS[status] ?? { label: `Status ${status}`, color: '#6b6a64', bg: '#f5f4f0' }
  return (
    <span style={{
      display: 'inline-block',
      background: s.bg, color: s.color,
      borderRadius: 6, padding: '2px 8px',
      fontSize: 11, fontWeight: 600,
    }}>{s.label}</span>
  )
}

function AgingChip({ level, hours }: { level: string | null; hours: number | null }) {
  if (!level || !AGING_STYLE[level]) return null
  const s = AGING_STYLE[level]
  const display = hours != null
    ? hours >= 24 ? `${(hours / 24).toFixed(1)}d` : `${hours}h`
    : null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: s.bg, color: s.text,
      border: `1px solid ${s.border}`,
      borderRadius: 20, padding: '3px 10px',
      fontSize: 12, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {s.label}{display ? ` · ${display}` : ''}
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function LocationDetailPopup({
  locationCode,
  onClose,
}: {
  locationCode: string
  onClose: () => void
}) {
  const [pallets, setPallets] = useState<PalletGroup[]>([])
  const [expandedPallet, setExpandedPallet] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch trực tiếp từ view
  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const { data, error } = await supabase
        .from('staging_box_detail')
        .select('*')
        .eq('staging_code', locationCode)
        .order('pallet_code', { ascending: true })
        .order('scanned_at', { ascending: true })

      if (error) {
        console.error('Lỗi fetch location detail:', error)
        setLoading(false)
        return
      }

      const grouped: Record<string, PalletGroup> = {}

      data.forEach((b: any) => {
        if (!grouped[b.pallet_id]) {
          grouped[b.pallet_id] = {
            pallet_id: b.pallet_id,
            pallet_code: b.pallet_code,
            pallet_status: b.pallet_status || 'staged',
            asn_id: b.asn_id,
            order_no: b.order_no,
            asn_status: b.asn_task_status ?? null,
            aging_level: b.aging_level ?? null,
            leadtime_hours: b.leadtime_hours ?? null,
            scanned_boxes: 0,
            sku_count: 0,
            boxes: []
          }
        }

        grouped[b.pallet_id].boxes.push({
          id: b.box_id,
          box_code: b.box_code,
          scanned_at: b.scanned_at,
          device_status: b.device_status,
          device_status_label: b.device_status_label,
          device_qty: b.device_qty,
          asn_id: b.asn_id,
          order_no: b.order_no,
          asn_status_label: b.asn_status_label,
          arrived_at: b.arrived_at,
          leadtime_hours: b.leadtime_hours,
          aging_level: b.aging_level,
          skus: Array.isArray(b.skus) ? b.skus : [],
        })

        grouped[b.pallet_id].scanned_boxes += 1
        grouped[b.pallet_id].sku_count += Array.isArray(b.skus) ? b.skus.length : 0
      })

      setPallets(Object.values(grouped))
      setLoading(false)
    }

    if (locationCode) fetchData()
  }, [locationCode])

  const togglePallet = (palletId: string) => {
    setExpandedPallet(prev => prev === palletId ? null : palletId)
  }

  const totalPallets = pallets.length
  const totalBoxes = pallets.reduce((sum, p) => sum + p.scanned_boxes, 0)
  const totalSkus = pallets.reduce((sum, p) => sum + p.sku_count, 0)

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#fff' }}>Đang tải dữ liệu location...</div>
      </div>
    )
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 680,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, background: '#e5e4de', borderRadius: 2, margin: '0 auto 16px' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: '#a09e96', letterSpacing: '0.08em', marginBottom: 4 }}>LOCATION</div>
              <div style={{ fontFamily: F.code, fontSize: 22, fontWeight: 700, color: '#1a1916' }}>{locationCode}</div>
            </div>
            <div style={{ display: 'flex', gap: 16, textAlign: 'right' }}>
              {[
                { k: 'Pallet', v: totalPallets },
                { k: 'Box',    v: totalBoxes },
                { k: 'SKU',    v: totalSkus },
              ].map(item => (
                <div key={item.k}>
                  <div style={{ fontFamily: F.code, fontSize: 20, fontWeight: 700, color: '#1a1916' }}>{item.v}</div>
                  <div style={{ fontSize: 11, color: '#a09e96' }}>{item.k}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(0,0,0,0.07)' }} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 24px 32px' }}>
          {pallets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#a09e96', fontSize: 13 }}>
              Không có pallet nào tại location này
            </div>
          ) : pallets.map((pallet) => {
            const isExpanded = expandedPallet === pallet.pallet_id

            return (
              <div
                key={pallet.pallet_id}
                style={{
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 12,
                  marginBottom: 10,
                  overflow: 'hidden',
                  background: isExpanded ? '#fafaf8' : '#fff',
                }}
              >
                <div
                  onClick={() => togglePallet(pallet.pallet_id)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: isExpanded ? '#f5f4f0' : 'transparent',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: F.code, fontSize: 14, fontWeight: 700 }}>{pallet.pallet_code}</span>
                      <AsnStatusBadge status={pallet.asn_status} />
                      <AgingChip level={pallet.aging_level} hours={pallet.leadtime_hours} />
                    </div>
                    {pallet.asn_id && (
                      <div style={{ fontFamily: F.code, fontSize: 11, color: '#a09e96', marginTop: 3 }}>
                        {pallet.asn_id} {pallet.order_no && `• ${pallet.order_no}`}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: F.code, fontSize: 16, fontWeight: 700 }}>{pallet.scanned_boxes}</div>
                      <div style={{ fontSize: 10, color: '#a09e96' }}>box</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: F.code, fontSize: 16, fontWeight: 700 }}>{pallet.sku_count}</div>
                      <div style={{ fontSize: 10, color: '#a09e96' }}>sku</div>
                    </div>
                  </div>

                  <span style={{ fontSize: 14, color: '#a09e96', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
                </div>

                {/* Box List */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '10px 16px' }}>
                    {pallet.boxes.map((box, bi) => {
                      const ds = box.device_status !== null ? DEVICE_STATUS[box.device_status] : null
                      return (
                        <div key={box.id} style={{
                          background: '#fff',
                          border: '1px solid rgba(0,0,0,0.07)',
                          borderRadius: 8,
                          padding: '10px 12px',
                          marginBottom: 6
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <span style={{ fontFamily: F.code, fontSize: 11, color: '#c8c7c0' }}>{bi + 1}</span>
                            <span style={{ fontFamily: F.code, fontSize: 13, fontWeight: 600, flex: 1 }}>{box.box_code}</span>
                            {ds && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: ds.bg, color: ds.color }}>{ds.label}</span>}
                            <span style={{ fontSize: 10, color: '#c8c7c0' }}>
                              {new Date(box.scanned_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {box.skus.length > 0 ? (
                            <div style={{ paddingLeft: 30, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {box.skus.map(sku => (
                                <div key={sku.sku_id} style={{
                                  background: '#f5f4f0',
                                  borderRadius: 6,
                                  padding: '5px 10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                }}>
                                  <span style={{ fontFamily: F.code, fontSize: 11, color: '#6b6a64', flex: 1 }}>{sku.sku_id}</span>
                                  {sku.sku_name && <span style={{ fontSize: 10, color: '#a09e96', flex: 2 }}>{sku.sku_name}</span>}
                                  <span style={{ fontFamily: F.code, fontSize: 11, fontWeight: 600 }}>×{sku.received_quantity}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ paddingLeft: 30, fontSize: 11, color: '#c8c7c0' }}>Chưa có SKU data</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px 24px', borderTop: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              width: '100%', background: '#1a1916', color: '#fff',
              border: 'none', borderRadius: 10,
              fontFamily: F.display, fontSize: 14, fontWeight: 700,
              padding: 14, cursor: 'pointer',
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}