'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const F = {
  display: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
  code:    "var(--font-code, 'Fira Code', monospace)",
}

export interface MissingAsnRow {
  inbound_id:         string
  inbound_type:       string | null  // ← string thay vì number
  real_arrival_time:  number | null
  inbound_date:       number | null
  arrival_tag:        number | null
  ship_method:        number | null
  last_synced_at:     string
  created_at:         string
  box_count:          number
  sku_count:          number
  total_received_qty: number
  leadtime_hours:     number | null
}

interface BoxDetailRow {
  inbound_id:        string
  device_id:         string
  device_status:     number | null
  sku_id:            string | null
  sku_name:          string | null
  received_quantity: number | null
  leadtime_hours:    number | null
}

type SortKey = keyof Pick<MissingAsnRow,
  'inbound_id' | 'inbound_type' | 'real_arrival_time' |
  'leadtime_hours' | 'box_count' | 'sku_count' | 'total_received_qty'>
type SortDir = 'asc' | 'desc'

// COLS: thay Status → Type
const COLS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'inbound_id',         label: 'Inbound ID' },
  { key: 'inbound_type',       label: 'Type'        },  // ← thay task_status
  { key: 'real_arrival_time',  label: 'Arrival',    numeric: true },
  { key: 'leadtime_hours',     label: 'Leadtime',   numeric: true },
  { key: 'box_count',          label: 'Boxes',      numeric: true },
  { key: 'sku_count',          label: 'SKUs',       numeric: true },
  { key: 'total_received_qty', label: 'Recv Qty',   numeric: true },
]

function formatTs(unix: number | null) {
  if (!unix || unix <= 0) return '—'
  return new Date(unix * 1000).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}
function formatLeadtime(h: number | null) {
  if (h == null) return '—'
  return h >= 24 ? `${(h / 24).toFixed(1)}d` : `${h}h`
}
function leadtimeColor(h: number | null) {
  if (h == null) return '#6b6a64'
  if (h >= 36) return '#b91c1c'
  if (h >= 24) return '#c2410c'
  if (h >= 15) return '#a16207'
  return '#15803d'
}
function inboundTypeBadge(type: string | null) {
  const isMove = type === 'Move Inbound'
  return {
    bg:     isMove ? '#e6f1fb' : '#e8f5ee',
    color:  isMove ? '#0c447c' : '#1d6a3e',
    border: isMove ? 'rgba(13,74,143,0.25)' : 'rgba(29,106,62,0.25)',
    label:  type ?? '—',
  }
}

export function MissingAsnPopup({ rows, onClose }: { rows: MissingAsnRow[]; onClose: () => void }) {
  const [sortKey,    setSortKey]    = useState<SortKey>('real_arrival_time')
  const [sortDir,    setSortDir]    = useState<SortDir>('asc')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [boxRows,    setBoxRows]    = useState<BoxDetailRow[]>([])
  const [boxLoading, setBoxLoading] = useState(false)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? (typeof a[sortKey] === 'number' ? -Infinity : '')
    const bv = b[sortKey] ?? (typeof b[sortKey] === 'number' ? -Infinity : '')
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  async function selectInbound(id: string) {
    if (selectedId === id) { setSelectedId(null); setBoxRows([]); return }
    setSelectedId(id)
    setBoxLoading(true)
    const { data } = await supabase
      .from('asn_missing_box_detail')
      .select('*')
      .eq('inbound_id', id)
      .order('device_id')
    setBoxRows((data as BoxDetailRow[]) ?? [])
    setBoxLoading(false)
  }

  const byDevice = boxRows.reduce<Record<string, BoxDetailRow[]>>((acc, r) => {
    if (!acc[r.device_id]) acc[r.device_id] = []
    acc[r.device_id].push(r)
    return acc
  }, {})

  const selectedRow = rows.find(r => r.inbound_id === selectedId)

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16,
        width: '100%', maxWidth: selectedId ? 1100 : 860,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden',
        transition: 'max-width 0.2s',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 15 }}>Box Pending Hand-Over</div>
            <div style={{ fontSize: 12, color: '#a09e96', marginTop: 2 }}>
              {rows.length} inbound ở trạng thái received nhưng chưa có pallet trong staging
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f5f4f0', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#6b6a64', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* LEFT */}
          <div style={{ flex: selectedId ? '0 0 500px' : '1', overflowY: 'auto', borderRight: selectedId ? '1px solid rgba(0,0,0,0.07)' : 'none', transition: 'flex 0.2s' }}>
            {rows.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#a09e96', fontSize: 13 }}>✅ Không có ASN nào bị thiếu staging</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9f8f5', position: 'sticky', top: 0, zIndex: 1 }}>
                    {COLS.map(col => {
                      const active = sortKey === col.key
                      return (
                        <th key={col.key} onClick={() => toggleSort(col.key)} style={{
                          padding: '10px 14px', textAlign: col.numeric ? 'right' : 'left',
                          fontFamily: F.display, fontWeight: 600, fontSize: 11,
                          color: active ? '#1a1916' : '#a09e96',
                          letterSpacing: '0.05em', textTransform: 'uppercase',
                          borderBottom: '1px solid rgba(0,0,0,0.07)',
                          cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                        }}>
                          {col.label}
                          <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 10 }}>
                            {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(row => {
                    const isSelected = selectedId === row.inbound_id
                    const s = inboundTypeBadge(row.inbound_type)
                    return (
                      <tr key={row.inbound_id} onClick={() => selectInbound(row.inbound_id)}
                        style={{ background: isSelected ? '#f0f9ff' : 'transparent', cursor: 'pointer' }}
                        onMouseEnter={e => !isSelected && ((e.currentTarget as HTMLTableRowElement).style.background = '#f9f8f5')}
                        onMouseLeave={e => !isSelected && ((e.currentTarget as HTMLTableRowElement).style.background = 'transparent')}
                      >
                        <td style={{ padding: '9px 14px', fontFamily: F.code, fontWeight: 600, fontSize: 11 }}>{row.inbound_id}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                            {s.label}
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', color: '#6b6a64', fontFamily: F.code, fontSize: 10, textAlign: 'right' }}>{formatTs(row.real_arrival_time)}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                          <span style={{ fontFamily: F.code, fontWeight: 700, color: leadtimeColor(row.leadtime_hours) }}>{formatLeadtime(row.leadtime_hours)}</span>
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: F.code }}>{row.box_count ?? 0}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: F.code }}>{row.sku_count ?? 0}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: F.code, fontWeight: 600 }}>{(row.total_received_qty ?? 0).toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* RIGHT — box detail */}
          {selectedId && (
            <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#f9f8f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 1 }}>
                <div>
                  <span style={{ fontFamily: F.code, fontWeight: 700, fontSize: 12 }}>{selectedId}</span>
                  {selectedRow && (
                    <span style={{ fontSize: 11, color: '#a09e96', marginLeft: 10 }}>
                      {Object.keys(byDevice).length} boxes · leadtime{' '}
                      <span style={{ color: leadtimeColor(selectedRow.leadtime_hours), fontWeight: 600 }}>{formatLeadtime(selectedRow.leadtime_hours)}</span>
                    </span>
                  )}
                </div>
                <button onClick={() => { setSelectedId(null); setBoxRows([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a09e96', fontSize: 16 }}>×</button>
              </div>

              {boxLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#a09e96', fontSize: 12 }}>Đang tải...</div>
              ) : Object.keys(byDevice).length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#a09e96', fontSize: 12 }}>Không có box nào</div>
              ) : (
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(byDevice).map(([deviceId, skus]) => (
                    <div key={deviceId} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 14px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: F.code, fontWeight: 700, fontSize: 12 }}>📦 {deviceId}</span>
                        <span style={{ fontSize: 11, color: '#a09e96' }}>{skus.filter(s => s.sku_id).length} SKU</span>
                      </div>
                      {skus.filter(s => s.sku_id).length === 0 ? (
                        <div style={{ padding: '8px 14px', fontSize: 11, color: '#c8c7c0' }}>Chưa có SKU</div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: '#fafaf9' }}>
                              {['SKU ID', 'Tên SKU', 'Recv Qty'].map(h => (
                                <th key={h} style={{ padding: '6px 14px', textAlign: h === 'Recv Qty' ? 'right' : 'left', fontFamily: F.display, fontWeight: 600, fontSize: 10, color: '#a09e96', letterSpacing: '0.04em', textTransform: 'uppercase', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {skus.filter(s => s.sku_id).map((s, i) => (
                              <tr key={`${s.device_id}-${s.sku_id}`} style={{ background: i % 2 === 0 ? '#fff' : '#fafaf9' }}>
                                <td style={{ padding: '7px 14px', fontFamily: F.code, fontWeight: 600 }}>{s.sku_id}</td>
                                <td style={{ padding: '7px 14px', color: '#6b6a64' }}>{s.sku_name ?? '—'}</td>
                                <td style={{ padding: '7px 14px', textAlign: 'right', fontFamily: F.code, fontWeight: 600 }}>{(s.received_quantity ?? 0).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}