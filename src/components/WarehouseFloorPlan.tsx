'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ─────────────────────────────────────────────────────────────────────
type Zone = {
  id: string
  code: string
  name: string | null
  block_id: string
  x?: number | null
  y?: number | null
  width?: number | null
  height?: number | null
}

type Block = {
  id: string
  code: string
  name: string | null
  x?: number | null
  y?: number | null
  width?: number | null
  height?: number | null
  zones?: Zone[]
}

type AppMode = 'view' | 'edit'
type DrawTool = 'select' | 'block' | 'zone' | 'staging'

type CanvasElement = {
  id: string           // matches DB id OR local temp id
  dbId: string | null  // actual DB id
  type: 'block' | 'zone' | 'staging'
  label: string
  x: number; y: number; w: number; h: number
  color: string
  borderColor: string
  children: { code: string; name: string }[]
}

type DrawState =
  | { phase: 'idle' }
  | { phase: 'drawing'; startX: number; startY: number; curX: number; curY: number }

type DragState =
  | { active: false }
  | { active: true; elId: string; offX: number; offY: number }

type ResizeState =
  | { active: false }
  | { active: true; elId: string; startW: number; startH: number; startMouseX: number; startMouseY: number }

type AssignModal =
  | { open: false }
  | { open: true; x: number; y: number; w: number; h: number; mode: 'block' | 'zone' }

// ─── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg:        '#0d1117',
  surface:   '#161b22',
  surface2:  '#1c2128',
  border:    '#30363d',
  border2:   '#444c56',
  text:      '#e6edf3',
  text2:     '#8b949e',
  text3:     '#484f58',
  accent:    '#58a6ff',
  green:     '#3fb950',
  amber:     '#d29922',
  red:       '#f85149',
  block:     { fill: 'rgba(56,139,253,0.12)', stroke: '#388bfd', label: '#58a6ff' },
  zone:      { fill: 'rgba(63,185,80,0.12)',  stroke: '#3fb950', label: '#3fb950' },
  staging:   { fill: 'rgba(210,153,34,0.12)', stroke: '#d29922', label: '#d29922' },
  pending:   { fill: 'rgba(88,166,255,0.08)', stroke: '#58a6ff' },
}

const SNAP = 20

function snap(v: number) { return Math.round(v / SNAP) * SNAP }

function typeTheme(type: 'block' | 'zone' | 'staging') {
  return type === 'block' ? T.block : type === 'zone' ? T.zone : T.staging
}

// ─── Convert DB blocks → canvas elements ──────────────────────────────────────
function blocksToElements(blocks: Block[]): CanvasElement[] {
  const els: CanvasElement[] = []
  blocks.forEach(b => {
    if (b.x != null && b.y != null && b.width != null && b.height != null) {
      els.push({
        id: b.id, dbId: b.id, type: 'block',
        label: b.code + (b.name ? ` · ${b.name}` : ''),
        x: b.x, y: b.y, w: b.width, h: b.height,
        color: T.block.fill, borderColor: T.block.stroke,
        children: (b.zones ?? [])
          .filter(z => z.x == null)
          .map(z => ({ code: z.code, name: z.name ?? z.code })),
      })
    }
    ;(b.zones ?? []).forEach(z => {
      if (z.x != null && z.y != null && z.width != null && z.height != null) {
        els.push({
          id: z.id, dbId: z.id, type: 'zone',
          label: z.code + (z.name ? ` · ${z.name}` : ''),
          x: z.x, y: z.y, w: z.width, h: z.height,
          color: T.zone.fill, borderColor: T.zone.stroke,
          children: [],
        })
      }
    })
  })
  return els
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function WarehouseFloorPlan({
  blocks,
  onBlockUpdated,
  onZoneUpdated,
}: {
  blocks: Block[]
  onBlockUpdated?: (blockId: string) => void
  onZoneUpdated?: (zoneId: string) => void
}) {
  const wrapRef   = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // view transform
  const [vx, setVx] = useState(40)
  const [vy, setVy] = useState(40)
  const [vs, setVs] = useState(1)

  const [appMode,  setAppMode]  = useState<AppMode>('view')
  const [drawTool, setDrawTool] = useState<DrawTool>('select')

  const [elements,   setElements]   = useState<CanvasElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const drawState   = useRef<DrawState>({ phase: 'idle' })
  const dragState   = useRef<DragState>({ active: false })
  const resizeState = useRef<ResizeState>({ active: false })
  const panState    = useRef<{ active: boolean; sx: number; sy: number }>({ active: false, sx: 0, sy: 0 })

  const [assignModal, setAssignModal] = useState<AssignModal>({ open: false })
  const [assignMode2, setAssignMode2] = useState<'block' | 'zone'>('block')
  const [selBlock, setSelBlock] = useState('')
  const [selZone,  setSelZone]  = useState('')
  const [saving,   setSaving]   = useState(false)

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Derived ──────────────────────────────────────────────────────────────────
  const selectedEl = useMemo(() => elements.find(e => e.id === selectedId) ?? null, [elements, selectedId])

  const unmappedBlocks = useMemo(() => blocks.filter(b => b.x == null), [blocks])
  const unmappedZones  = useMemo(
    () => blocks.flatMap(b => (b.zones ?? []).filter(z => z.x == null).map(z => ({ ...z, blockCode: b.code }))),
    [blocks]
  )

  // ── Sync DB → elements ───────────────────────────────────────────────────────
  useEffect(() => {
    setElements(blocksToElements(blocks))
  }, [blocks])

  // ── Toast ────────────────────────────────────────────────────────────────────
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }

  // ── Coord helpers ─────────────────────────────────────────────────────────────
  function screenToCanvas(sx: number, sy: number) {
    const rect = wrapRef.current!.getBoundingClientRect()
    return {
      x: (sx - rect.left - vx) / vs,
      y: (sy - rect.top  - vy) / vs,
    }
  }

  function doZoom(delta: number, cx?: number, cy?: number) {
    const wrap = wrapRef.current!
    const rect = wrap.getBoundingClientRect()
    const ox = (cx ?? rect.width / 2) - rect.left
    const oy = (cy ?? rect.height / 2) - rect.top
    setVs(s => {
      const ns = Math.max(0.2, Math.min(3, s + delta))
      setVx(x => ox - (ox - x) * (ns / s))
      setVy(y => oy - (oy - y) * (ns / s))
      return ns
    })
  }

  // ── Save to Supabase ──────────────────────────────────────────────────────────
  const saveElement = useCallback(async (el: CanvasElement) => {
    if (!el.dbId) return
    const coords = { x: el.x, y: el.y, width: el.w, height: el.h }
    if (el.type === 'block') {
      const { error } = await supabase.from('blocks').update(coords).eq('id', el.dbId)
      if (error) { showToast(`Lỗi lưu block: ${error.message}`, false); return }
      showToast('Đã lưu vị trí block')
      onBlockUpdated?.(el.dbId)
    } else if (el.type === 'zone') {
      const { error } = await supabase.from('zones').update(coords).eq('id', el.dbId)
      if (error) { showToast(`Lỗi lưu zone: ${error.message}`, false); return }
      showToast('Đã lưu vị trí zone')
      onZoneUpdated?.(el.dbId)
    }
  }, [onBlockUpdated, onZoneUpdated])

  // ── Confirm assign modal ──────────────────────────────────────────────────────
  async function confirmAssign() {
    if (!assignModal.open) return
    const { x, y, w, h } = assignModal
    const coords = { x, y, width: w, height: h }
    setSaving(true)

    if (assignMode2 === 'block') {
      if (!selBlock) { showToast('Chọn block!', false); setSaving(false); return }
      const { error } = await supabase.from('blocks').update(coords).eq('id', selBlock)
      if (error) { showToast(error.message, false); setSaving(false); return }
      const b = blocks.find(b => b.id === selBlock)!
      const theme = T.block
      setElements(prev => [...prev.filter(e => e.dbId !== selBlock), {
        id: selBlock, dbId: selBlock, type: 'block',
        label: b.code + (b.name ? ` · ${b.name}` : ''),
        x, y, w, h,
        color: theme.fill, borderColor: theme.stroke,
        children: (b.zones ?? []).filter(z => z.x == null).map(z => ({ code: z.code, name: z.name ?? z.code })),
      }])
      showToast(`Block ${b.code} đã được đặt lên sơ đồ`)
      onBlockUpdated?.(selBlock)
    } else {
      if (!selZone) { showToast('Chọn zone!', false); setSaving(false); return }
      const zone = blocks.flatMap(b => b.zones ?? []).find(z => z.id === selZone)!
      const { error } = await supabase.from('zones').update(coords).eq('id', selZone)
      if (error) { showToast(error.message, false); setSaving(false); return }
      const theme = T.zone
      setElements(prev => [...prev.filter(e => e.dbId !== selZone), {
        id: selZone, dbId: selZone, type: 'zone',
        label: zone.code + (zone.name ? ` · ${zone.name}` : ''),
        x, y, w, h,
        color: theme.fill, borderColor: theme.stroke,
        children: [],
      }])
      showToast(`Zone ${zone.code} đã được đặt lên sơ đồ`)
      onZoneUpdated?.(selZone)
    }

    setAssignModal({ open: false })
    setSelBlock(''); setSelZone('')
    setSaving(false)
  }

  // ── Mouse handlers ────────────────────────────────────────────────────────────
  function onWrapMouseDown(e: React.MouseEvent) {
    if (e.button === 1 || appMode === 'view' || drawTool === 'select') {
      panState.current = { active: true, sx: e.clientX - vx, sy: e.clientY - vy }
      return
    }
    // draw mode (only reaches here when drawTool !== 'select')
    const p = screenToCanvas(e.clientX, e.clientY)
    drawState.current = { phase: 'drawing', startX: p.x, startY: p.y, curX: p.x, curY: p.y }
  }

  function onWrapMouseMove(e: React.MouseEvent) {
    if (panState.current.active) {
      setVx(e.clientX - panState.current.sx)
      setVy(e.clientY - panState.current.sy)
      return
    }
    if (dragState.current.active) {
      const p = screenToCanvas(e.clientX, e.clientY)
      const d = dragState.current
      setElements(prev => prev.map(el =>
        el.id === d.elId
          ? { ...el, x: snap(p.x - d.offX), y: snap(p.y - d.offY) }
          : el
      ))
      return
    }
    if (resizeState.current.active) {
      const r = resizeState.current
      const dx = (e.clientX - r.startMouseX) / vs
      const dy = (e.clientY - r.startMouseY) / vs
      setElements(prev => prev.map(el =>
        el.id === r.elId
          ? { ...el, w: Math.max(60, snap(r.startW + dx)), h: Math.max(40, snap(r.startH + dy)) }
          : el
      ))
      return
    }
    if (drawState.current.phase === 'drawing') {
      const p = screenToCanvas(e.clientX, e.clientY)
      drawState.current = { ...drawState.current, curX: p.x, curY: p.y }
      // force re-render for ghost
      setElements(prev => [...prev])
    }
  }

  function onWrapMouseUp(e: React.MouseEvent) {
    panState.current.active = false

    if (dragState.current.active) {
      const id = dragState.current.elId
      dragState.current = { active: false }
      const el = elements.find(el => el.id === id)
      if (el) saveElement(el)
      return
    }
    if (resizeState.current.active) {
      const id = resizeState.current.elId
      resizeState.current = { active: false }
      const el = elements.find(el => el.id === id)
      if (el) saveElement(el)
      return
    }
    if (drawState.current.phase === 'drawing') {
      const ds = drawState.current
      const w = Math.abs(ds.curX - ds.startX)
      const h = Math.abs(ds.curY - ds.startY)
      drawState.current = { phase: 'idle' }
      if (w < 30 || h < 20) return
      const x = snap(Math.min(ds.startX, ds.curX))
      const y = snap(Math.min(ds.startY, ds.curY))
      setAssignModal({ open: true, x, y, w: snap(w), h: snap(h), mode: drawTool === 'block' ? 'block' : 'zone' })
      setAssignMode2(drawTool === 'block' ? 'block' : 'zone')
    }
  }

  function onElMouseDown(e: React.MouseEvent, el: CanvasElement) {
    if (appMode === 'view') return
    e.stopPropagation()
    setSelectedId(el.id)
    if (drawTool !== 'select') return
    const p = screenToCanvas(e.clientX, e.clientY)
    dragState.current = { active: true, elId: el.id, offX: p.x - el.x, offY: p.y - el.y }
  }

  function onResizeMouseDown(e: React.MouseEvent, el: CanvasElement) {
    e.stopPropagation()
    resizeState.current = { active: true, elId: el.id, startW: el.w, startH: el.h, startMouseX: e.clientX, startMouseY: e.clientY }
  }

  function onWrapWheel(e: React.WheelEvent) {
    e.preventDefault()
    doZoom(e.deltaY > 0 ? -0.1 : 0.1, e.clientX, e.clientY)
  }

  // ── Draw ghost (during draw) ───────────────────────────────────────────────
  const ghost = (() => {
    if (drawState.current.phase !== 'drawing') return null
    const ds = drawState.current
    const gx = Math.min(ds.startX, ds.curX) * vs + vx
    const gy = Math.min(ds.startY, ds.curY) * vs + vy
    const gw = Math.abs(ds.curX - ds.startX) * vs
    const gh = Math.abs(ds.curY - ds.startY) * vs
    return { gx, gy, gw, gh }
  })()

  // ── Cursor ────────────────────────────────────────────────────────────────
  const cursor = appMode === 'view' ? 'grab'
    : drawTool !== 'select' ? 'crosshair'
    : 'default'

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', 'Fira Code', monospace", position: 'relative' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: T.surface,
        borderRadius: '10px 10px 0 0',
        border: `1px solid ${T.border}`,
        borderBottom: 'none',
        flexWrap: 'wrap',
      }}>
        {/* Mode toggle */}
        <div style={{ display: 'flex', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: 2, gap: 2 }}>
          {(['view', 'edit'] as AppMode[]).map(m => (
            <button key={m} onClick={() => { setAppMode(m); setDrawTool('select') }} style={{
              fontFamily: 'inherit', fontSize: 10, fontWeight: 600,
              padding: '4px 14px', border: 'none', borderRadius: 4, cursor: 'pointer',
              background: appMode === m ? T.surface2 : 'transparent',
              color: appMode === m ? T.text : T.text2,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              transition: 'all .15s',
            }}>{m}</button>
          ))}
        </div>

        {appMode === 'edit' && (
          <>
            <div style={{ width: 1, height: 20, background: T.border }} />
            {(['select', 'block', 'zone', 'staging'] as DrawTool[]).map(t => (
              <button key={t} onClick={() => setDrawTool(t)} style={{
                fontFamily: 'inherit', fontSize: 10, fontWeight: 500,
                padding: '5px 12px', border: `1px solid ${drawTool === t ? T.accent : T.border}`,
                borderRadius: 5, cursor: 'pointer',
                background: drawTool === t ? 'rgba(88,166,255,0.1)' : T.surface2,
                color: drawTool === t ? T.accent : T.text2,
                transition: 'all .15s', letterSpacing: '0.04em',
              }}>
                {t === 'select' ? '↖ select' : `+ ${t}`}
              </button>
            ))}
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Stats */}
        {[
          { label: `${elements.filter(e=>e.type==='block').length} blocks`, col: T.block.label },
          { label: `${elements.filter(e=>e.type==='zone').length} zones`, col: T.zone.label },
          { label: `${elements.filter(e=>e.type==='staging').length} staging`, col: T.staging.label },
        ].map(s => (
          <span key={s.label} style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 100,
            border: `1px solid ${T.border}`, color: s.col,
            letterSpacing: '0.04em',
          }}>{s.label}</span>
        ))}

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: '2px 4px' }}>
          <button onClick={() => doZoom(-0.15)} style={zoomBtnStyle}>−</button>
          <span style={{ fontSize: 10, color: T.text3, minWidth: 38, textAlign: 'center' }}>{Math.round(vs * 100)}%</span>
          <button onClick={() => doZoom(0.15)} style={zoomBtnStyle}>+</button>
          <button onClick={() => { setVx(40); setVy(40); setVs(1) }} style={{ ...zoomBtnStyle, fontSize: 11 }} title="Reset">⌂</button>
        </div>
      </div>

      {/* ── Canvas wrap ── */}
      <div
        ref={wrapRef}
        onMouseDown={onWrapMouseDown}
        onMouseMove={onWrapMouseMove}
        onMouseUp={onWrapMouseUp}
        onMouseLeave={onWrapMouseUp}
        onWheel={onWrapWheel}
        style={{
          position: 'relative',
          height: 640,
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: '0 0 10px 10px',
          overflow: 'hidden',
          cursor,
          userSelect: 'none',
        }}
      >
        {/* Grid dots */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `radial-gradient(circle, ${T.border} 1px, transparent 1px)`,
          backgroundSize: `${SNAP * vs}px ${SNAP * vs}px`,
          backgroundPosition: `${vx % (SNAP * vs)}px ${vy % (SNAP * vs)}px`,
        }} />

        {/* Elements */}
        <div
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${vx}px,${vy}px) scale(${vs})`, transformOrigin: '0 0' }}
        >
          {elements.map(el => {
            const th = typeTheme(el.type)
            const isSelected = el.id === selectedId
            return (
              <div
                key={el.id}
                onMouseDown={e => onElMouseDown(e, el)}
                style={{
                  position: 'absolute',
                  left: el.x, top: el.y, width: el.w, height: el.h,
                  background: el.color,
                  border: `1.5px solid ${isSelected ? T.accent : el.borderColor}`,
                  borderRadius: 6,
                  boxShadow: isSelected
                    ? `0 0 0 3px rgba(88,166,255,0.25), inset 0 0 0 1px rgba(88,166,255,0.15)`
                    : 'none',
                  cursor: appMode === 'edit' && drawTool === 'select' ? 'move' : 'pointer',
                  overflow: 'hidden',
                  transition: 'box-shadow .15s',
                }}
              >
                {/* Header strip */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '5px 8px 4px',
                  background: 'rgba(255,255,255,0.04)',
                  borderBottom: `1px solid rgba(255,255,255,0.07)`,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: th.label, letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>
                    {el.label}
                  </span>
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 100,
                    background: 'rgba(255,255,255,0.07)', color: T.text3,
                    letterSpacing: '0.08em', flexShrink: 0,
                  }}>{el.type.toUpperCase()}</span>
                </div>

                {/* Child chips */}
                {el.children.length > 0 && (
                  <div style={{ padding: '4px 6px', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {el.children.slice(0, 12).map(ch => (
                      <span key={ch.code} style={{
                        fontSize: 9, padding: '2px 6px', borderRadius: 4,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.6)',
                        whiteSpace: 'nowrap',
                      }}>{ch.code}</span>
                    ))}
                    {el.children.length > 12 && (
                      <span style={{ fontSize: 9, color: T.text3, padding: '2px 4px' }}>+{el.children.length - 12}</span>
                    )}
                  </div>
                )}

                {/* Resize handle */}
                {appMode === 'edit' && isSelected && (
                  <div
                    onMouseDown={e => onResizeMouseDown(e, el)}
                    style={{
                      position: 'absolute', right: 0, bottom: 0, width: 18, height: 18,
                      cursor: 'nwse-resize', zIndex: 10,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" style={{ opacity: 0.5 }}>
                      <line x1="6" y1="16" x2="16" y2="6" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="11" y1="16" x2="16" y2="11" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Draw ghost */}
        {ghost && (
          <div style={{
            position: 'absolute',
            left: ghost.gx, top: ghost.gy, width: ghost.gw, height: ghost.gh,
            border: `2px dashed ${T.accent}`,
            background: T.pending.fill,
            borderRadius: 6,
            pointerEvents: 'none',
          }} />
        )}

        {/* Empty state */}
        {elements.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 8, pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 36, opacity: 0.1 }}>🏭</span>
            <p style={{ fontSize: 11, color: T.text3, textAlign: 'center', lineHeight: 1.8 }}>
              Chuyển sang <strong style={{ color: T.text2 }}>EDIT</strong> mode<br/>
              rồi dùng tool để vẽ block đầu tiên
            </p>
          </div>
        )}

        {/* Unmapped hint */}
        {(unmappedBlocks.length > 0 || unmappedZones.length > 0) && appMode === 'edit' && (
          <div style={{
            position: 'absolute', top: 12, right: 12, zIndex: 50,
            background: T.surface, border: `1px solid ${T.border2}`,
            borderRadius: 10, padding: '10px 14px', maxWidth: 200,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: T.text3, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Chưa có vị trí
            </div>
            {unmappedBlocks.map(b => (
              <div key={b.id} style={{ fontSize: 11, color: T.block.label, padding: '2px 0' }}>
                ☐ {b.code}{b.name ? ` — ${b.name}` : ''}
              </div>
            ))}
            {unmappedZones.map(z => (
              <div key={z.id} style={{ fontSize: 11, color: T.zone.label, padding: '2px 0' }}>
                ◻ {z.blockCode} › {z.code}
              </div>
            ))}
            <div style={{ fontSize: 10, color: T.text3, marginTop: 8, lineHeight: 1.5 }}>
              Vẽ hình chữ nhật để đặt vị trí
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12, zIndex: 50,
          display: 'flex', gap: 12, alignItems: 'center',
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 8, padding: '6px 12px',
        }}>
          {[
            { color: T.block.stroke, label: 'Block' },
            { color: T.zone.stroke,  label: 'Zone',  dashed: true },
            { color: T.staging.stroke, label: 'Staging', dashed: true },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 16, height: 10, borderRadius: 2,
                border: `1.5px ${item.dashed ? 'dashed' : 'solid'} ${item.color}`,
                background: item.color + '22',
              }} />
              <span style={{ fontSize: 10, color: T.text2 }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Selected info bar */}
        {selectedEl && appMode === 'edit' && (
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 50, background: T.surface2, border: `1px solid ${T.border2}`,
            borderRadius: 8, padding: '6px 14px', fontSize: 10, color: T.text2,
            display: 'flex', gap: 12, alignItems: 'center', whiteSpace: 'nowrap',
          }}>
            <span style={{ color: typeTheme(selectedEl.type).label }}>{selectedEl.label}</span>
            <span>x={selectedEl.x} y={selectedEl.y}</span>
            <span>{selectedEl.w}×{selectedEl.h}</span>
            <button
              onClick={() => { setElements(prev => prev.filter(e => e.id !== selectedId)); setSelectedId(null) }}
              style={{ background: 'none', border: 'none', color: T.red, cursor: 'pointer', fontSize: 12, padding: 0 }}
              title="Xoá"
            >✕</button>
          </div>
        )}
      </div>

      {/* ── Assign Modal ── */}
      {assignModal.open && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', borderRadius: 10,
          backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            background: T.surface, border: `1px solid ${T.border2}`,
            borderRadius: 14, padding: 28, width: 360,
            boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>Gán vùng vừa vẽ</div>
            <div style={{ fontSize: 12, color: T.text2, marginBottom: 20, lineHeight: 1.5 }}>
              Chọn đây là vị trí của Block hay Zone nào trong hệ thống.
            </div>

            {/* Toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {(['block', 'zone'] as const).map(m => (
                <button key={m} onClick={() => setAssignMode2(m)} style={{
                  flex: 1, fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                  padding: '8px 0', border: `1px solid ${assignMode2 === m ? T.accent : T.border}`,
                  borderRadius: 7, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                  background: assignMode2 === m ? 'rgba(88,166,255,0.12)' : T.surface2,
                  color: assignMode2 === m ? T.accent : T.text2,
                  transition: 'all .15s',
                }}>
                  {m === 'block' ? '🏭 Block' : '📦 Zone'}
                </button>
              ))}
            </div>

            {assignMode2 === 'block' ? (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: T.text3, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Chọn Block *</div>
                <select value={selBlock} onChange={e => setSelBlock(e.target.value)} style={selectStyle}>
                  <option value="">— Chọn block —</option>
                  {blocks.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.code}{b.name ? ` — ${b.name}` : ''}{b.x != null ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
                {selBlock && blocks.find(b => b.id === selBlock)?.x != null && (
                  <p style={{ fontSize: 10, color: T.amber, margin: '6px 0 0' }}>⚠ Block này đã có vị trí — sẽ bị ghi đè.</p>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: T.text3, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Chọn Zone *</div>
                <select value={selZone} onChange={e => setSelZone(e.target.value)} style={selectStyle}>
                  <option value="">— Chọn zone —</option>
                  {blocks.map(b => (
                    <optgroup key={b.id} label={b.code}>
                      {(b.zones ?? []).map(z => (
                        <option key={z.id} value={z.id}>
                          {z.code}{z.name ? ` — ${z.name}` : ''}{z.x != null ? ' ✓' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setAssignModal({ open: false }); setSelBlock(''); setSelZone('') }}
                style={{ ...btnBase, flex: 1, background: T.surface2, color: T.text2, border: `1px solid ${T.border}` }}
              >Huỷ</button>
              <button
                onClick={confirmAssign}
                disabled={saving}
                style={{ ...btnBase, flex: 2, background: saving ? T.border2 : T.accent, color: saving ? T.text3 : '#0d1117', border: 'none', fontWeight: 700 }}
              >{saving ? 'Đang lưu...' : '✓ Xác nhận gán'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 16, right: 16, zIndex: 300,
          background: toast.ok ? T.surface2 : '#3d0f0e',
          border: `1px solid ${toast.ok ? T.border2 : T.red}`,
          color: toast.ok ? T.text : T.red,
          borderRadius: 8, padding: '10px 16px', fontSize: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          animation: 'fadeUp .2s ease',
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Shared micro-styles ───────────────────────────────────────────────────────
const zoomBtnStyle: React.CSSProperties = {
  width: 26, height: 26,
  background: 'transparent', border: 'none',
  color: '#8b949e', fontSize: 15, cursor: 'pointer',
  borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit', lineHeight: 1,
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: 7,
  color: '#e6edf3',
  fontSize: 12,
  padding: '8px 10px',
  outline: 'none',
  fontFamily: "'IBM Plex Mono', monospace",
}

const btnBase: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 12, padding: '10px 0',
  borderRadius: 7, cursor: 'pointer',
  transition: 'all .15s', letterSpacing: '0.02em',
}