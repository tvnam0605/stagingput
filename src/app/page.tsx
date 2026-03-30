'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import type { Profile, Pallet, ActivityLog, Block } from '@/lib/types'
import PalletCreatePanel from '@/components/PalletCreatePanel'
import ScanPanel from '@/components/ScanPanel'
import { HistoryPanel } from '@/components/HistoryPanel'
import { AdminPanel } from '@/components/AdminPanel'
import MoverPanel from '@/components/MoverPanel'
import { MissingAsnPopup }       from '@/components/MissingAsnPopup'
import { SkuVariancePopup }      from '@/components/SkuVariancePopup'
import type { MissingAsnRow }    from '@/components/MissingAsnPopup'
import type { VarianceSummaryRow } from '@/components/SkuVariancePopup'
// ─── Helper (copy từ LayoutTab) ─────────────────────────────────────
function worstAging(rows: any[]): string | null {
  const order = ['red', 'orange', 'yellow', 'green']
  return rows.reduce<string | null>((worst, r) => {
    if (!r.aging_level) return worst
    if (!worst) return r.aging_level
    return order.indexOf(r.aging_level) < order.indexOf(worst) ? r.aging_level : worst
  }, null)
}
const WarehouseFloorPlan = dynamic(() => import('@/components/WarehouseFloorPlan'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 680, background: '#f8f7f3', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a09e96', fontSize: 13, border: '1px solid rgba(0,0,0,0.05)' }}>
      Đang tải bản đồ kho...
    </div>
  ),
})

export type Tab = 'dashboard' | 'create' | 'scan' | 'mover' | 'history' | 'admin'
const F = {
  display: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
  body:    "var(--font-body, 'Inter', sans-serif)",
  code:    "var(--font-code, 'Fira Code', monospace)",
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function pad2(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date)  { return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}` }
function toInputVal(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }
function fromInputVal(s: string): Date { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d) }
function fmtDateShort(d: Date) { return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) }
function getLast7Days(): Date[] {
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6-i)); return d })
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    pending:  { bg: '#fef3d7', color: '#7a4a00',  border: 'rgba(122,74,0,0.2)'  },
    ongoing:  { bg: '#e8f0fb', color: '#0d4a8f',  border: 'rgba(13,74,143,0.2)' },
    received: { bg: '#e8f0fb', color: '#185FA5',  border: 'rgba(13,74,143,0.2)' },
    staged:   { bg: '#fff7ed', color: '#c2410c',  border: 'rgba(234,88,12,0.2)' },
    done:     { bg: '#e8f5ee', color: '#1d6a3e',  border: 'rgba(29,106,62,0.2)' },
  }
  const s = map[status] ?? map['pending']
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontFamily: F.code, letterSpacing: '0.02em' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
      {status}
    </span>
  )
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, color = '#c8ff47', h = 30 }: { values: number[]; color?: string; h?: number }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const w = 80
  const pts = values.map((v, i) => `${(i / (values.length-1)) * w},${h - (v/max) * (h-2) - 1}`)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={parseFloat(pts[pts.length-1].split(',')[0])} cy={parseFloat(pts[pts.length-1].split(',')[1])} r="2.5" fill={color} />
    </svg>
  )
}

// ─── Donut ────────────────────────────────────────────────────────────────────
function Donut({ segs, size = 88 }: { segs: { v: number; c: string; label: string }[]; size?: number }) {
  const total = segs.reduce((s, x) => s + x.v, 0)
  if (!total) return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#f0efe9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 10, color: '#a09e96' }}>—</span>
    </div>
  )
  const cx = size/2, cy = size/2, r = size*0.38, ir = size*0.24
  let cum = 0
  function arc(s: number, e: number) {
    const sa = (s/total)*Math.PI*2 - Math.PI/2, ea = (e/total)*Math.PI*2 - Math.PI/2
    const x1 = cx+r*Math.cos(sa), y1 = cy+r*Math.sin(sa)
    const x2 = cx+r*Math.cos(ea), y2 = cy+r*Math.sin(ea)
    const ix1 = cx+ir*Math.cos(ea), iy1 = cy+ir*Math.sin(ea)
    const ix2 = cx+ir*Math.cos(sa), iy2 = cy+ir*Math.sin(sa)
    const lg = e - s > total / 2 ? 1 : 0
    return `M${x1} ${y1} A${r} ${r} 0 ${lg} 1 ${x2} ${y2} L${ix1} ${iy1} A${ir} ${ir} 0 ${lg} 0 ${ix2} ${iy2}Z`
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segs.map(seg => {
        if (!seg.v) return null
        const d = arc(cum, cum + seg.v); cum += seg.v
        return <path key={seg.label} d={d} fill={seg.c}><title>{seg.label}: {seg.v}</title></path>
      })}
      <text x={cx} y={cy-4}  textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">{total}</text>
      <text x={cx} y={cy+11} textAnchor="middle" fontSize="9"  fill="rgba(255,255,255,0.45)">total</text>
    </svg>
  )
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
type DayBar = { label: string; pending: number; ongoing: number; received: number; done: number }

function BarChart({ data, h = 120 }: { data: DayBar[]; h?: number }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.pending+d.ongoing+d.received+d.done), 1)
  const bw = 26, gap = 14, padL = 32
  const W = padL + data.length * (bw + gap) - gap + 8
  const cols = { done: '#1d6a3e', received: '#185FA5', ongoing: '#378ADD', pending: '#BA7517' }

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${Math.max(W, 360)} ${h + 48}`} style={{ minWidth: 300 }}>
        {[0.25, 0.5, 0.75, 1].map(f => {
          const y = h - f * h
          return (
            <g key={f}>
              <line x1={padL} y1={y} x2={W} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
              <text x={padL-4} y={y+4} textAnchor="end" fontSize="9" fill="#c8c7c0">{Math.round(f*max)}</text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const x = padL + i * (bw + gap)
          const total = d.pending + d.ongoing + d.received + d.done
          let y = h
          const order: (keyof typeof cols)[] = ['done','received','ongoing','pending']
          return (
            <g key={i}>
              {order.map(k => {
                const v = d[k]; if (!v) return null
                const bh = (v/max)*h; y -= bh
                return <rect key={k} x={x} y={y} width={bw} height={bh} fill={cols[k]}><title>{k}: {v}</title></rect>
              })}
              {total > 0 && (
                <rect x={x} y={h-(total/max)*h} width={bw} height={3} fill="#fff" opacity="0.3" rx="1.5" />
              )}
              <text x={x+bw/2} y={h+14} textAnchor="middle" fontSize="9" fill="#a09e96">{d.label}</text>
              {total > 0 && <text x={x+bw/2} y={h-(total/max)*h-5} textAnchor="middle" fontSize="9" fill="#6b6a64" fontWeight="600">{total}</text>}
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
        {Object.entries(cols).map(([k, c]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
            <span style={{ fontSize: 10, color: '#6b6a64', textTransform: 'capitalize' }}>{k}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Location types ────────────────────────────────────────────────────────────
interface LocationRow { aging_level: string | null; pallet_id: string }

// ─── HomePage ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter()
  const today  = new Date()
  const [stagingCriticalCount, setStagingCriticalCount] = useState(0)

  const [profile,          setProfile]          = useState<Profile | null>(null)
  const [tab,              setTab]              = useState<Tab>('dashboard')
  const [pallets,          setPallets]          = useState<Pallet[]>([])
  const [blocks,           setBlocks]           = useState<Block[]>([])
  const [activity,         setActivity]         = useState<ActivityLog[]>([])
  const [loading,          setLoading]          = useState(true)
  const [clock,            setClock]            = useState('')
  const [criticalCount,    setCriticalCount]    = useState(0)
  const [missingAsn,       setMissingAsn]       = useState<MissingAsnRow[]>([])
  const [varianceSummary,  setVarianceSummary]  = useState<VarianceSummaryRow[]>([])
  const [showMissingAsn,   setShowMissingAsn]   = useState(false)
  const [showVariance,     setShowVariance]     = useState(false)
  const [selectedDate,     setSelectedDate]     = useState<Date>(today)
  const [historyData,      setHistoryData]      = useState<DayBar[]>([])

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('vi-VN')), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!data || !data.is_active) { await supabase.auth.signOut(); router.push('/login'); return }
      setProfile(data as Profile); setLoading(false)
    })
  }, [router])

  const fetchBlocks = useCallback(async () => {
    const { data } = await supabase.from('blocks').select('*, zones(*)').order('code')
    if (data) setBlocks(data as Block[])
  }, [])

  const fetchData = useCallback(async () => {
    const dateStr = toDateStr(selectedDate)
    const [p, a] = await Promise.all([
      supabase.from('pallets').select('*, boxes(*)').eq('date_str', dateStr).order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(40),
    ])
    if (p.data) setPallets(p.data as Pallet[])
    if (a.data) setActivity(a.data as ActivityLog[])
  }, [selectedDate])

const fetchWarehouseStats = useCallback(async () => {
  const [{ data: locRows }, { data: stagingRows }, { data: missing }, { data: variance }] = await Promise.all([
    supabase.from('location_layout_view').select('aging_level, pallet_id'),           // giữ nguyên
    supabase.from('staging_layout_view').select('location_code, aging_level'),       // ← thêm
    supabase.from('asn_missing_from_staging').select('*').order('real_arrival_time', { ascending: true }),
    supabase.from('asn_sku_variance_summary').select('*').order('total_variance_qty', { ascending: false }),
  ])

  // Critical của warehouse thông thường (giữ nguyên)
  if (locRows) {
    const order = ['red', 'orange', 'yellow', 'green']
    const byPallet = (locRows as any[]).reduce<Record<string, string | null>>((acc, r) => {
      const cur = acc[r.pallet_id]
      if (!cur) { acc[r.pallet_id] = r.aging_level; return acc }
      if (!r.aging_level) return acc
      acc[r.pallet_id] = order.indexOf(r.aging_level) < order.indexOf(cur ?? '') ? r.aging_level : cur
      return acc
    }, {})
    setCriticalCount(Object.values(byPallet).filter(v => v === 'red').length)
  }

  // ── CRITICAL AGING CỦA STAGING (mới) ─────────────────────────────
  if (stagingRows) {
    const byLocation = (stagingRows as any[]).reduce<Record<string, any[]>>((acc, row) => {
      if (!acc[row.location_code]) acc[row.location_code] = []
      acc[row.location_code].push(row)
      return acc
    }, {})

    const stagingCritical = Object.values(byLocation).filter(rows => worstAging(rows) === 'red').length
    setStagingCriticalCount(stagingCritical)
  }

  setMissingAsn((missing as any[]) ?? [])
  setVarianceSummary((variance as any[]) ?? [])
}, [])
  const fetchHistory = useCallback(async () => {
    const days = getLast7Days()
    const results = await Promise.all(
      days.map(d => supabase.from('pallets').select('status').eq('date_str', toDateStr(d)))
    )
    setHistoryData(days.map((d, i) => {
      const rows = (results[i].data ?? []) as { status: string }[]
      return {
        label:    fmtDateShort(d),
        pending:  rows.filter(r => r.status === 'pending').length,
        ongoing:  rows.filter(r => r.status === 'ongoing').length,
        received: rows.filter(r => r.status === 'received').length,
        done:     rows.filter(r => r.status === 'done').length,
      }
    }))
  }, [])

  useEffect(() => {
    if (!loading && profile) {
      fetchData(); fetchBlocks(); fetchWarehouseStats(); fetchHistory()
      const ch = supabase.channel('dashboard-realtime')
        .on('postgres_changes', { event: '*',      schema: 'public', table: 'pallets' },          () => { fetchData(); fetchWarehouseStats(); fetchHistory() })
        .on('postgres_changes', { event: '*',      schema: 'public', table: 'boxes' },            fetchData)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' },     fetchData)
        .on('postgres_changes', { event: '*',      schema: 'public', table: 'asn_orders' },       fetchWarehouseStats)
        .on('postgres_changes', { event: '*',      schema: 'public', table: 'asn_devices' },      fetchWarehouseStats)
        .on('postgres_changes', { event: '*',      schema: 'public', table: 'asn_device_items' }, fetchWarehouseStats)
        .subscribe()
      return () => { supabase.removeChannel(ch) }
    }
  }, [loading, profile, fetchData, fetchBlocks, fetchWarehouseStats, fetchHistory])

  useEffect(() => { if (!loading && profile) fetchData() }, [selectedDate, loading, profile, fetchData])

  async function handleSignOut() { await supabase.auth.signOut(); router.push('/login') }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: F.code, color: '#c8ff47', fontSize: 14 }}>Đang tải...</div>
    </div>
  )

  const isToday = toDateStr(selectedDate) === toDateStr(today)
  const stats = {
    total:    pallets.length,
    pending:  pallets.filter(p => p.status === 'pending').length,
    ongoing:  pallets.filter(p => p.status === 'ongoing').length,
    received: pallets.filter(p => p.status === 'received').length,
    staged:   pallets.filter(p => p.status === 'staged').length,
    done:     pallets.filter(p => p.status === 'done').length,
  }
  const totalBoxes       = pallets.reduce((s, p) => s + (p.boxes ?? []).length, 0)
  const totalVarianceQty = varianceSummary.reduce((s, r) => s + r.total_variance_qty, 0)

  const NAV_TABS: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'create',    label: 'Tạo Pallet' },
    { key: 'scan',      label: 'Scan Box' },
    { key: 'history',   label: 'Lịch sử' },
    ...(['mover','admin'].includes(profile?.role ?? '') ? [{ key: 'mover' as Tab, label: 'Mover' }] : []),
    ...(profile?.role === 'admin' ? [{ key: 'admin' as Tab, label: 'Admin' }] : []),
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0', fontFamily: F.body }}>
      <nav style={{ background: '#1a1916', height: 56, padding: '0 24px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: '0.06em', marginRight: 28 }}>
          WMS<span style={{ color: '#c8ff47' }}>.</span>RCV
        </div>
        <div style={{ display: 'flex', height: '100%' }}>
          {NAV_TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ background: 'none', border: 'none', height: 56, padding: '0 16px', cursor: 'pointer', fontFamily: F.body, fontSize: 13, fontWeight: 500, color: tab === t.key ? '#fff' : 'rgba(255,255,255,0.4)', borderBottom: tab === t.key ? '2px solid #c8ff47' : '2px solid transparent', transition: 'all 0.15s' }}>{t.label}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: F.code, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{clock}</span>
          <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8ff47' }} />
            {profile?.full_name || profile?.email?.split('@')[0]}
            <span style={{ background: 'rgba(200,255,71,0.12)', color: '#c8ff47', fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{profile?.role}</span>
          </div>
          <button onClick={handleSignOut} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: 'rgba(255,255,255,0.4)', fontSize: 12, padding: '5px 10px', cursor: 'pointer' }}>Đăng xuất</button>
        </div>
      </nav>

      <main style={{ padding: 28, maxWidth: 1400, margin: '0 auto' }}>
        {tab === 'dashboard' && (
          <DashboardContent
            stats={stats} pallets={pallets} blocks={blocks} activity={activity}
            historyData={historyData} totalBoxes={totalBoxes}
            criticalCount={criticalCount} 
            stagingCriticalCount={stagingCriticalCount} missingAsnCount={missingAsn.length}
            varianceCount={varianceSummary.length} totalVarianceQty={totalVarianceQty}
            selectedDate={selectedDate} isToday={isToday} today={today}
            onDateChange={setSelectedDate} onNavigate={setTab}
            onBlocksRefetch={fetchBlocks}
            onShowMissingAsn={() => setShowMissingAsn(true)}
            onShowVariance={() => setShowVariance(true)}
          />
        )}
        {tab === 'create'  && <PalletCreatePanel profile={profile!} onCreated={fetchData} />}
        {tab === 'scan'    && <ScanPanel profile={profile!} onUpdated={fetchData} />}
        {tab === 'history' && <HistoryPanel />}
        {tab === 'mover'   && ['mover','admin'].includes(profile?.role ?? '') && <MoverPanel profile={profile!} onUpdated={fetchData} />}
        {tab === 'admin'   && profile?.role === 'admin' && <AdminPanel />}
      </main>

      {showMissingAsn && <MissingAsnPopup rows={missingAsn}     onClose={() => setShowMissingAsn(false)} />}
      {showVariance   && <SkuVariancePopup rows={varianceSummary} onClose={() => setShowVariance(false)} />}
    </div>
  )
}

// ─── DashboardContent ──────────────────────────────────────────────────────────
function DashboardContent({
  stats, pallets, blocks, activity, historyData, totalBoxes,
  criticalCount, missingAsnCount, varianceCount, totalVarianceQty,
  selectedDate, isToday, today,
  onDateChange, onNavigate, onBlocksRefetch, onShowMissingAsn, onShowVariance,
}: {
  stats: { total: number; pending: number; ongoing: number; received: number; staged: number; done: number }
  pallets: Pallet[]; blocks: Block[]; activity: ActivityLog[]; historyData: DayBar[]; totalBoxes: number
  criticalCount: number; missingAsnCount: number;stagingCriticalCount: number; varianceCount: number; totalVarianceQty: number
  selectedDate: Date; isToday: boolean; today: Date
  onDateChange: (d: Date) => void; onNavigate: (t: Tab) => void
  onBlocksRefetch: () => void; onShowMissingAsn: () => void; onShowVariance: () => void
}) {
  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  function goDate(offset: number) {
    const d = new Date(selectedDate); d.setDate(d.getDate() + offset)
    if (d <= today) onDateChange(d)
  }

  const completionRate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
  const avgBoxes       = stats.total > 0 ? (totalBoxes / stats.total).toFixed(1) : '—'
  const sparkTotal     = historyData.map(d => d.pending + d.ongoing + d.received + d.done)
  const sparkDone      = historyData.map(d => d.done)

  const activityDotColor: Record<string, string> = {
    pallet_created: '#378ADD', box_scanned: '#BA7517', pallet_done: '#1D9E75', pallet_moved: '#639922',
  }

  return (
    <div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, marginBottom: 3 }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: '#6b6a64' }}>
            {isToday ? 'Hôm nay' : selectedDate.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {/* Date nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => goDate(-1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#6b6a64', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <input type="date" value={toInputVal(selectedDate)} max={toInputVal(today)}
            onChange={e => e.target.value && onDateChange(fromInputVal(e.target.value))}
            style={{ fontFamily: F.code, fontSize: 13, fontWeight: 600, color: '#1a1916', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', outline: 'none' }}
          />
          <button onClick={() => goDate(1)} disabled={isToday}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', background: isToday ? '#f5f4f0' : '#fff', cursor: isToday ? 'not-allowed' : 'pointer', fontSize: 16, color: isToday ? '#c8c7c0' : '#6b6a64', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >›</button>
          {!isToday && (
            <button onClick={() => onDateChange(today)} style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: '#0d4a8f', background: '#e8f0fb', border: '1px solid rgba(13,74,143,0.2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
              Hôm nay
            </button>
          )}
        </div>
      </div>

      {/* ── Row 1: 4 hero KPI cards ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>

        {/* Hero: Total + donut */}
        <div style={{ background: '#1a1916', borderRadius: 16, padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(200,255,71,0.04)' }} />
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>Tổng Pallet</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 40, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{stats.total}</div>
              <div style={{ marginTop: 12 }}><Sparkline values={sparkTotal} color="#c8ff47" h={28} /></div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 5 }}>7 ngày gần nhất</div>
            </div>
            <Donut size={84} segs={[
              { v: stats.done,     c: '#1D9E75', label: 'Done'     },
              { v: stats.received, c: '#185FA5', label: 'Received' },
              { v: stats.staged,   c: '#ea580c', label: 'Staged'   },
              { v: stats.ongoing,  c: '#378ADD', label: 'Ongoing'  },
              { v: stats.pending,  c: '#BA7517', label: 'Pending'  },
            ]} />
          </div>
        </div>

        {/* Done + completion */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, padding: '20px' }}>
          <div style={{ fontSize: 10, color: '#a09e96', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>Hoàn thành</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
            <div style={{ fontFamily: F.display, fontSize: 40, fontWeight: 800, color: '#1d6a3e', lineHeight: 1 }}>{stats.done}</div>
            <div style={{ fontFamily: F.code, fontSize: 16, color: '#1d6a3e', fontWeight: 700, marginBottom: 4 }}>{completionRate}%</div>
          </div>
          <div style={{ height: 4, background: '#e8f5ee', borderRadius: 2, marginBottom: 10 }}>
            <div style={{ height: '100%', width: `${completionRate}%`, background: '#1d6a3e', borderRadius: 2, transition: 'width 0.6s ease' }} />
          </div>
          <Sparkline values={sparkDone} color="#1d6a3e" h={26} />
          <div style={{ fontSize: 10, color: '#a09e96', marginTop: 5 }}>completion rate</div>
        </div>

        {/* Boxes */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, padding: '20px' }}>
          <div style={{ fontSize: 10, color: '#a09e96', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>Tổng Box</div>
          <div style={{ fontFamily: F.display, fontSize: 40, fontWeight: 800, color: '#185FA5', lineHeight: 1, marginBottom: 16 }}>{totalBoxes}</div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <div style={{ fontSize: 10, color: '#a09e96', marginBottom: 3 }}>AVG / pallet</div>
              <div style={{ fontFamily: F.code, fontSize: 22, fontWeight: 700, color: '#0d4a8f' }}>{avgBoxes}</div>
            </div>
            <div style={{ width: 1, background: 'rgba(0,0,0,0.07)' }} />
            <div>
              <div style={{ fontSize: 10, color: '#a09e96', marginBottom: 3 }}>In progress</div>
              <div style={{ fontFamily: F.code, fontSize: 22, fontWeight: 700, color: '#0d4a8f' }}>
                {pallets.filter(p => ['ongoing','received'].includes(p.status)).reduce((s,p) => s+(p.boxes??[]).length, 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline bars */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, padding: '20px' }}>
          <div style={{ fontSize: 10, color: '#a09e96', letterSpacing: '0.08em', marginBottom: 14, textTransform: 'uppercase' }}>Pipeline</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Pending',  value: stats.pending,  color: '#BA7517' },
              { label: 'Ongoing',  value: stats.ongoing,  color: '#0d4a8f' },
              { label: 'Received', value: stats.received, color: '#185FA5' },
              { label: 'Staged',   value: stats.staged,   color: '#c2410c' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 52, fontSize: 10, color: '#a09e96', flexShrink: 0 }}>{s.label}</div>
                <div style={{ flex: 1, height: 6, background: '#f5f4f0', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: stats.total ? `${(s.value/stats.total)*100}%` : '0%', background: s.color, borderRadius: 3, transition: 'width 0.5s ease', minWidth: s.value > 0 ? 5 : 0 }} />
                </div>
                <div style={{ fontFamily: F.code, fontSize: 12, fontWeight: 700, color: s.color, minWidth: 18, textAlign: 'right' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: Alert cards ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Critical Aging',        value: criticalCount,   sub: 'pallet quá hạn xử lý',           alert: criticalCount > 0,   onClick: undefined as undefined | (() => void) },
          { label: 'Box Pending Hand-Over',  value: missingAsnCount, sub: 'ASN received chưa vào pallet',   alert: missingAsnCount > 0, onClick: onShowMissingAsn },
          { label: 'SKU Variance',           value: varianceCount,   sub: `${totalVarianceQty.toLocaleString()} qty lệch`, alert: varianceCount > 0, onClick: onShowVariance },
        ].map(s => (
          <div key={s.label} onClick={s.onClick}
            style={{ background: s.alert ? '#fef2f2' : '#fff', border: `1px solid ${s.alert ? 'rgba(220,38,38,0.18)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 14, padding: '16px 20px', cursor: s.onClick ? 'pointer' : 'default', transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: 16 }}
            onMouseEnter={e => s.onClick && ((e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)')}
            onMouseLeave={e => s.onClick && ((e.currentTarget as HTMLDivElement).style.transform = 'none')}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, color: s.alert ? '#b91c1c' : '#a09e96' }}>
                {s.label}{s.onClick && <span style={{ opacity: 0.6 }}>↗</span>}
              </div>
              <div style={{ fontFamily: F.display, fontSize: 30, fontWeight: 800, color: s.alert ? '#b91c1c' : '#1a1916', lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: s.alert ? '#ef4444' : '#a09e96' }}>{s.sub}</div>
            </div>
            {s.alert && s.value > 0 && (
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⚠</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Row 3: Chart + Table + Activity ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr 340px', gap: 16, marginBottom: 16 }}>

        {/* 7-day bar chart */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700 }}>7 ngày gần nhất</span>
            <span style={{ fontSize: 11, color: '#a09e96' }}>pallet / ngày</span>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <BarChart data={historyData} h={120} />
          </div>
        </div>

        {/* Pallet table */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700 }}>Pallets {isToday ? 'hôm nay' : fmtDateShort(selectedDate)}</span>
            {isToday && (
              <button onClick={() => onNavigate('create')} style={{ background: '#1a1916', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, padding: '5px 10px', cursor: 'pointer', fontFamily: F.body }}>+ Tạo mới</button>
            )}
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr style={{ background: '#f5f4f0' }}>
                  {['Mã Pallet', 'Status', 'Box', 'Giờ'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#a09e96', padding: '8px 14px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pallets.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 28, color: '#a09e96', fontSize: 13 }}>Không có pallet</td></tr>
                ) : pallets.slice(0, 20).map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9f9f7')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '9px 14px', fontFamily: F.code, fontSize: 11, fontWeight: 600 }}>{p.code}</td>
                    <td style={{ padding: '9px 14px' }}><StatusBadge status={p.status} /></td>
                    <td style={{ padding: '9px 14px', fontFamily: F.code, fontSize: 12 }}>{(p.boxes ?? []).length}</td>
                    <td style={{ padding: '9px 14px', fontFamily: F.code, fontSize: 10, color: '#a09e96' }}>{fmtTime(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700 }}>Activity Log</span>
            <span style={{ fontSize: 11, color: '#a09e96' }}>{activity.length}</span>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto', padding: '6px 16px' }}>
            {activity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 28, color: '#a09e96', fontSize: 13 }}>Chưa có hoạt động</div>
            ) : activity.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', alignItems: 'flex-start' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: activityDotColor[a.event_type] ?? '#888' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#1a1916', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: F.code, fontSize: 10, color: '#6b6a64' }}>[{a.event_type}]</span>
                    {' '}{a.pallet_code}
                    {a.box_code      ? ` → ${a.box_code}`      : ''}
                    {a.location_code ? ` → ${a.location_code}` : ''}
                  </div>
                  <div style={{ fontSize: 10, color: '#a09e96', fontFamily: F.code, marginTop: 1 }}>
                    {a.user_email?.split('@')[0]} · {fmtTime(a.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 4: Status breakdown strip ────────────────────────────────── */}
      {stats.total > 0 && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700 }}>Status breakdown</span>
            <span style={{ fontSize: 11, color: '#a09e96' }}>{stats.total} pallets · {totalBoxes} boxes</span>
          </div>
          <div style={{ height: 16, borderRadius: 6, overflow: 'hidden', display: 'flex', gap: 1 }}>
            {[
              { v: stats.done,     c: '#1d6a3e', label: 'Done'     },
              { v: stats.received, c: '#185FA5', label: 'Received' },
              { v: stats.staged,   c: '#ea580c', label: 'Staged'   },
              { v: stats.ongoing,  c: '#378ADD', label: 'Ongoing'  },
              { v: stats.pending,  c: '#BA7517', label: 'Pending'  },
            ].filter(s => s.v > 0).map(s => (
              <div key={s.label} style={{ flex: s.v, background: s.c, transition: 'flex 0.5s ease', minWidth: 4 }} title={`${s.label}: ${s.v}`} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Done',     v: stats.done,     c: '#1d6a3e' },
              { label: 'Received', v: stats.received, c: '#185FA5' },
              { label: 'Staged',   v: stats.staged,   c: '#ea580c' },
              { label: 'Ongoing',  v: stats.ongoing,  c: '#378ADD' },
              { label: 'Pending',  v: stats.pending,  c: '#BA7517' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.c }} />
                <span style={{ fontSize: 11, color: '#6b6a64' }}>{s.label}</span>
                <span style={{ fontFamily: F.code, fontSize: 11, fontWeight: 700, color: s.c }}>{s.v}</span>
                <span style={{ fontSize: 10, color: '#c8c7c0' }}>({stats.total ? Math.round(s.v/stats.total*100) : 0}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}