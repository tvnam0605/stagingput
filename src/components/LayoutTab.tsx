'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { LocationDetailPopup } from './LocationDetailPopup'

const F = {
  display: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
  code:    "var(--font-code, 'Fira Code', monospace)",
}

const AGING_STYLE: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  green:  { bg: '#f0fdf4', border: 'rgba(22,163,74,0.25)',  text: '#15803d', dot: '#16a34a', label: 'Fresh'    },
  yellow: { bg: '#fefce8', border: 'rgba(202,138,4,0.25)',  text: '#a16207', dot: '#ca8a04', label: 'Warning'  },
  orange: { bg: '#fff7ed', border: 'rgba(234,88,12,0.25)',  text: '#c2410c', dot: '#ea580c', label: 'Aging'    },
  red:    { bg: '#fef2f2', border: 'rgba(220,38,38,0.25)',  text: '#b91c1c', dot: '#dc2626', label: 'Critical' },
}

const TASK_STATUS_LABEL: Record<number, string> = {
  0: 'Pending', 1: 'Scanning', 2: 'Received', 3: 'Putting', 4: 'Done',
  6: 'Arrived', 7: 'Counting', 8: 'Counted',  9: 'Checking', 10: 'Checked', 12: 'Arriving',
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface LocationRow {
  location_id:       string
  location_code:     string
  zone_code:         string
  block_code:        string
  pallet_id:         string
  pallet_code:       string
  pallet_status:     string
  asn_id:            string | null
  asn_status:        number | null
  order_no:          string | null
  real_arrival_time: number | null
  leadtime_hours:    number | null
  aging_level:       string | null
  scanned_boxes:     number
  sku_count:         number
  moved_at?:         string | null
}

interface LocationMeta {
  id: string
  code: string
  description?: string | null
  block_id?: string | null
  blocks?: {
    id: string
    code: string
    name?: string
  } | null
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function worstAging(rows: LocationRow[]): string | null {
  const order = ['red', 'orange', 'yellow', 'green']
  return rows.reduce<string | null>((worst, r) => {
    if (!r.aging_level) return worst
    if (!worst) return r.aging_level
    return order.indexOf(r.aging_level) < order.indexOf(worst) ? r.aging_level : worst
  }, null)
}

function formatTs(unix: number | null): string {
  if (!unix || unix <= 0) return '—'
  return new Date(unix * 1000).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function formatLeadtime(h: number | null): string {
  if (h == null) return '—'
  if (h >= 24) return `${(h / 24).toFixed(1)}d`
  return `${h}h`
}

function leadtimeColor(h: number | null): string {
  if (h == null) return '#6b6a64'
  if (h >= 36) return '#b91c1c'
  if (h >= 24) return '#c2410c'
  if (h >= 15) return '#a16207'
  return '#15803d'
}

// ─── Location Card ─────────────────────────────────────────────────────────────
function LocationCard({ locationCode, rows, onClick }: { locationCode: string; rows: LocationRow[]; onClick: () => void }) {
  const occupied   = rows.length > 0
  const wa         = worstAging(rows)
  const as_        = wa ? AGING_STYLE[wa] : null
  const totalBoxes = rows.reduce((s, r) => s + (r.scanned_boxes ?? 0), 0)

  return (
    <button onClick={() => occupied && onClick()} style={{
      background: occupied ? (as_?.bg ?? '#f0fdf4') : '#f9f8f5',
      border: `1.5px solid ${occupied ? (as_?.border ?? 'rgba(0,0,0,0.08)') : 'rgba(0,0,0,0.06)'}`,
      borderRadius: 10, 
      padding: '10px 12px',
      cursor: occupied ? 'pointer' : 'default',
      textAlign: 'left', 
      transition: 'all 0.12s', 
      width: '100%',
    }}>
      <div style={{ fontFamily: F.code, fontSize: 12, fontWeight: 700, color: occupied ? '#1a1916' : '#c8c7c0', marginBottom: 5 }}>
        {locationCode}
      </div>
      {occupied ? (
        <>
          <div style={{ fontSize: 11, color: '#6b6a64', marginBottom: 3 }}>{rows.length}p · {totalBoxes}b</div>
          {as_ && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: as_.dot }} />
              <span style={{ fontSize: 10, color: as_.text, fontWeight: 600 }}>
                {as_.label}{rows[0]?.leadtime_hours != null && ` · ${rows[0].leadtime_hours >= 24 ? `${(rows[0].leadtime_hours / 24).toFixed(1)}d` : `${rows[0].leadtime_hours}h`}`}
              </span>
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 10, color: '#d1cfc8' }}>empty</div>
      )}
    </button>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export function LayoutTab() {
  const [viewData, setViewData]         = useState<LocationRow[]>([])
  const [allLocations, setAllLocations] = useState<LocationMeta[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterAging, setFilterAging]   = useState<string | null>(null)
  const [drawerCode, setDrawerCode]     = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)

    const [{ data: rows }, { data: locsRaw }] = await Promise.all([
      supabase.from('staging_layout_view').select('*'),
      
      supabase
        .from('locations_staging')
        .select(`
          id,
          code,
          description,
          block_id,
          blocks (
            id,
            code,
            name
          )
        `)
        .eq('is_active', true)
        .order('code')
    ])

    // Xử lý dữ liệu locations
    const locs: LocationMeta[] = (locsRaw || []).map((loc: any) => ({
      id: loc.id,
      code: loc.code,
      description: loc.description,
      block_id: loc.block_id,
      blocks: loc.blocks || null,
    }))

    setViewData((rows as LocationRow[]) ?? [])
    setAllLocations(locs)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()

    const ch = supabase.channel('staging-layout')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pallets' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boxes' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asn_orders' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asn_devices' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asn_device_items' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asn_skus' }, loadData)
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [loadData])

  // Group by location_code
  const byLocation = viewData.reduce<Record<string, LocationRow[]>>((acc, row) => {
    if (!acc[row.location_code]) acc[row.location_code] = []
    acc[row.location_code].push(row)
    return acc
  }, {})

  // Group by Block (quan trọng cho Staging)
  const byBlock = allLocations.reduce<Record<string, LocationMeta[]>>((acc, loc) => {
    const blockCode = loc.blocks?.code ?? 'OTHER'
    if (!acc[blockCode]) acc[blockCode] = []
    acc[blockCode].push(loc)
    return acc
  }, {})

  // Filter
  const filteredBlocks = Object.entries(byBlock)
    .map(([block, locs]) => ({
      block,
      locs: locs.filter(loc => {
        const matchSearch = !search || loc.code.toLowerCase().includes(search.toLowerCase())
        const matchAging  = !filterAging || worstAging(byLocation[loc.code] ?? []) === filterAging
        return matchSearch && matchAging
      })
    }))
    .filter(({ locs }) => locs.length > 0)

  // Stats
  const totalOccupied = Object.keys(byLocation).length
  const totalPallets  = viewData.filter((v, i, a) => a.findIndex(x => x.pallet_id === v.pallet_id) === i).length
  const totalBoxes    = Object.values(byLocation).flat().reduce((s, r) => s + r.scanned_boxes, 0)
  const criticalCount = Object.values(byLocation).filter(rows => worstAging(rows) === 'red').length

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: F.display, fontSize: 24, fontWeight: 700, color: '#1a1916' }}>
          Staging Location Layout
        </h1>
      </div>

      {/* Stats — 4 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { k: 'Locations đang dùng', v: `${totalOccupied}`, sub: `/ ${allLocations.length} tổng` },
          { k: 'Pallets', v: `${totalPallets}`, sub: 'đang lưu' },
          { k: 'Tổng box', v: `${totalBoxes}`, sub: 'đã scan' },
          { k: 'Critical aging', v: `${criticalCount}`, sub: 'cần xử lý', alert: criticalCount > 0 },
        ].map(item => (
          <div key={item.k} style={{
            background: item.alert ? '#fef2f2' : '#fff',
            border: `1px solid ${item.alert ? 'rgba(220,38,38,0.2)' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: 12,
            padding: '14px 18px',
          }}>
            <div style={{ 
              fontSize: 11, 
              color: item.alert ? '#b91c1c' : '#a09e96', 
              marginBottom: 4, 
              textTransform: 'uppercase' 
            }}>
              {item.k}
            </div>
            <div style={{ 
              fontFamily: F.code, 
              fontSize: 24, 
              fontWeight: 700, 
              color: item.alert ? '#b91c1c' : '#1a1916' 
            }}>
              {item.v}
            </div>
            <div style={{ fontSize: 11, color: item.alert ? '#b91c1c' : '#a09e96', marginTop: 2 }}>
              {item.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm staging location..."
          style={{ 
            flex: 1, 
            maxWidth: 320, 
            background: '#f5f4f0', 
            border: '1px solid rgba(0,0,0,0.1)', 
            borderRadius: 8, 
            color: '#1a1916', 
            fontFamily: F.code, 
            fontSize: 13, 
            padding: '9px 14px', 
            outline: 'none' 
          }}
        />

        <div style={{ display: 'flex', gap: 6 }}>
          {([null, 'red', 'orange', 'yellow', 'green'] as const).map(level => {
            const s = level ? AGING_STYLE[level] : null
            return (
              <button 
                key={level ?? 'all'} 
                onClick={() => setFilterAging(level)} 
                style={{
                  background: filterAging === level ? (s?.bg ?? '#1a1916') : '#fff',
                  color: filterAging === level ? (s?.text ?? '#fff') : '#6b6a64',
                  border: `1px solid ${filterAging === level ? (s?.border ?? '#1a1916') : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 20, 
                  padding: '6px 14px', 
                  fontSize: 12, 
                  fontWeight: 500, 
                  cursor: 'pointer',
                }}
              >
                {level ? s?.label : 'Tất cả'}
              </button>
            )
          })}
        </div>

        <button 
          onClick={loadData} 
          style={{ 
            marginLeft: 'auto', 
            background: 'transparent', 
            border: '1px solid rgba(0,0,0,0.1)', 
            borderRadius: 8, 
            padding: '8px 16px', 
            fontSize: 12, 
            cursor: 'pointer', 
            color: '#6b6a64' 
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Location grid grouped by Block */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#a09e96' }}>Đang tải...</div>
      ) : filteredBlocks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#a09e96', fontSize: 14 }}>
          Không có location nào
        </div>
      ) : (
        filteredBlocks.map(({ block, locs }) => {
          const occupiedCount = locs.filter(l => byLocation[l.code]?.length > 0).length

          return (
            <div key={block} style={{ 
              marginBottom: 40, 
              background: '#fff', 
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.07)',
              overflow: 'hidden'
            }}>
              {/* Block Header */}
              <div style={{
                padding: '16px 24px',
                background: '#f0f9ff',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#1a1916',
                    fontFamily: F.display
                  }}>
                    STAGING AREA {block}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: '#6b6a64',
                    background: '#fff',
                    padding: '3px 11px',
                    borderRadius: 20,
                    border: '1px solid rgba(0,0,0,0.1)'
                  }}>
                    {occupiedCount}/{locs.length} locations
                  </div>
                </div>

                <div style={{ fontSize: 13, color: '#a09e96' }}>
                  {locs.length} vị trí
                </div>
              </div>

              {/* Grid Locations */}
              <div style={{ 
                padding: '24px',
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
                gap: 14 
              }}>
                {locs.map(loc => (
                  <LocationCard 
                    key={loc.id} 
                    locationCode={loc.code} 
                    rows={byLocation[loc.code] ?? []} 
                    onClick={() => setDrawerCode(loc.code)} 
                  />
                ))}
              </div>
            </div>
          )
        })
      )}

      {drawerCode && <LocationDetailPopup locationCode={drawerCode} onClose={() => setDrawerCode(null)} />}
    </div>
  )
}