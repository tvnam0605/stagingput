'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, Pallet, Box, Location } from '@/lib/types'
import { StatusBadge } from '@/app/page'
import { LayoutTab } from './LayoutTab'

const F = {
  display: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
  body:    "var(--font-body, 'Inter', sans-serif)",
  code:    "var(--font-code, 'Fira Code', monospace)",
}

type MoverStep = 'scan_pallet' | 'confirm_location'
type ActiveTab = 'mover' | 'layout'

// ── Received Pallet List ───────────────────────────────────────────────────────
function ReceivedPalletList({ onSelect }: { onSelect: (p: Pallet) => void }) {
  const [pallets, setPallets] = useState<Pallet[]>([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('pallets')
        .select('*, boxes(*)')
        .eq('status', 'received')
        .order('done_at', { ascending: false })
        .limit(30)
      setPallets((data as Pallet[]) ?? [])
    }
    load()
    const ch = supabase.channel('mover-received')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pallets' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  return (
    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700 }}>Pallet chờ di chuyển</span>
        <span style={{
          fontFamily: F.code, fontSize: 12,
          background: pallets.length > 0 ? '#fef3d7' : '#f5f4f0',
          color: pallets.length > 0 ? '#7a4a00' : '#a09e96',
          border: `1px solid ${pallets.length > 0 ? 'rgba(122,74,0,0.2)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 20, padding: '2px 10px',
        }}>
          {pallets.length} pallet
        </span>
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {pallets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 28, color: '#a09e96', fontSize: 13 }}>
            Không có pallet nào chờ di chuyển
          </div>
        ) : pallets.map(p => (
          <div
            key={p.id}
            onClick={() => onSelect(p)}
            style={{ padding: '11px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f9f9f7')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.code, fontSize: 13, fontWeight: 600 }}>{p.code}</div>
              <div style={{ fontSize: 11, color: '#a09e96', marginTop: 2 }}>
                {(p.boxes ?? []).length} box
                {p.done_at && ` · Chốt ${new Date(p.done_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
              </div>
            </div>
            <StatusBadge status={p.status} />
            <span style={{ color: '#a09e96', fontSize: 14 }}>→</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main MoverPanel ────────────────────────────────────────────────────────────
export default function MoverPanel({ profile, onUpdated }: { profile: Profile; onUpdated: () => void }) {
  const [activeTab,        setActiveTab]        = useState<ActiveTab>('mover')
  const [step,             setStep]             = useState<MoverStep>('scan_pallet')
  const [palletInput,      setPalletInput]      = useState('')
  const [selectedPallet,   setSelectedPallet]   = useState<Pallet | null>(null)
  const [boxes,            setBoxes]            = useState<Box[]>([])
  const [stagingLocations, setStagingLocations] = useState<Location[]>([])
  const [locationInput,    setLocationInput]    = useState('')
  const [locationSearch,   setLocationSearch]   = useState('')
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [loading,          setLoading]          = useState(false)
  const [confirming,       setConfirming]       = useState(false)
  const [donePallets,      setDonePallets]      = useState<Pallet[]>([])
  const [toast,            setToast]            = useState<{ msg: string; type: 'ok' | 'err' | 'info' } | null>(null)
  const [nowTime,          setNowTime]          = useState('')

  const palletInputRef   = useRef<HTMLInputElement>(null)
  const locationInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setInterval(() => setNowTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchStagingLocations = useCallback(async () => {
    const { data } = await supabase
      .from('locations_staging')
      .select('*')
      .eq('is_active', true)
      .order('code')
    setStagingLocations((data as Location[]) ?? [])
  }, [])

  // Lịch sử hôm nay: cả staged lẫn done
  const fetchDoneHistory = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const { data } = await supabase
      .from('pallets')
      .select('*, boxes(*)')
      .in('status', ['staged', 'done'])   // ← staged + done
      .eq('date_str', today)
      .order('moved_at', { ascending: false })
      .limit(20)
    setDonePallets((data as Pallet[]) ?? [])
  }, [])

  useEffect(() => {
    fetchStagingLocations()
    fetchDoneHistory()
    setTimeout(() => palletInputRef.current?.focus(), 100)
  }, [fetchStagingLocations, fetchDoneHistory])

  function showToast(msg: string, type: 'ok' | 'err' | 'info' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function resetToStep1() {
    setStep('scan_pallet')
    setSelectedPallet(null)
    setBoxes([])
    setSelectedLocation(null)
    setLocationInput('')
    setLocationSearch('')
    setPalletInput('')
    setTimeout(() => palletInputRef.current?.focus(), 100)
  }

  // ── Scan pallet ──────────────────────────────────────────────────────────────
  async function handleScanPallet() {
    const code = palletInput.trim().toUpperCase()
    if (!code) return
    setPalletInput('')
    setLoading(true)

    const { data, error } = await supabase
      .from('pallets')
      .select('*, boxes(*)')
      .eq('code', code)
      .single()

    setLoading(false)

    if (error || !data) {
      showToast(`Không tìm thấy pallet: ${code}`, 'err')
      palletInputRef.current?.focus()
      return
    }

    const pallet = data as Pallet
    if (pallet.status === 'pending')  { showToast(`Pallet ${code} chưa có box`, 'err');                   palletInputRef.current?.focus(); return }
    if (pallet.status === 'ongoing')  { showToast(`Pallet ${code} chưa được chốt bởi Receiver`, 'err');   palletInputRef.current?.focus(); return }
    if (pallet.status === 'staged')   { showToast(`Pallet ${code} đã ở staging rồi`, 'info');             palletInputRef.current?.focus(); return }
    if (pallet.status === 'done')     { showToast(`Pallet ${code} đã hoàn tất (ASN done)`, 'info');       palletInputRef.current?.focus(); return }

    setSelectedPallet(pallet)
    setBoxes((pallet.boxes as Box[]) ?? [])
    setStep('confirm_location')
    showToast(`${code} — ${(pallet.boxes ?? []).length} box`, 'info')
    setTimeout(() => locationInputRef.current?.focus(), 100)
  }

  function handleSelectPallet(p: Pallet) {
    setSelectedPallet(p)
    setBoxes((p.boxes as Box[]) ?? [])
    setStep('confirm_location')
    setTimeout(() => locationInputRef.current?.focus(), 100)
  }

  // ── Scan / select staging location ──────────────────────────────────────────
  function handleScanLocation() {
    const code = locationInput.trim().toUpperCase()
    if (!code) return
    const loc = stagingLocations.find(l => l.code.toUpperCase() === code)
    if (!loc) { showToast(`Staging ${code} không tồn tại`, 'err'); return }
    setSelectedLocation(loc)
    setLocationInput(loc.code)
    showToast(`Chọn: ${loc.code}`, 'info')
  }

  // ── Confirm move → status: staged ────────────────────────────────────────────
  async function handleConfirm() {
    if (!selectedPallet || !selectedLocation) { showToast('Chọn staging location trước!', 'err'); return }
    if (!confirm(`Đưa pallet ${selectedPallet.code} (${boxes.length} box) vào staging ${selectedLocation.code}?`)) return
    setConfirming(true)
    const now = new Date().toISOString()

    // 1. Update pallet → staged (không phải done)
    const { error: pe } = await supabase.from('pallets').update({
      status:              'staged',       // ← staged, không phải done
      staging_location_id: selectedLocation.id,
      staged_at:           now,            // ← timestamp vào staging
      moved_by:            profile.id,
      moved_at:            now,
    }).eq('id', selectedPallet.id)

    if (pe) { showToast(`Lỗi: ${pe.message}`, 'err'); setConfirming(false); return }

    // 2. Update boxes — backfill device_id + asn_id nếu chưa có
    const { data: boxRows } = await supabase
      .from('boxes')
      .select('id, box_code, device_id, asn_id')
      .eq('pallet_id', selectedPallet.id)

    const needBackfill = (boxRows ?? []).filter(b => !b.device_id || !b.asn_id)

    if (needBackfill.length > 0) {
      const { data: wmsRows } = await supabase
        .from('asn_devices')
        .select('device_id, inbound_id')
        .in('device_id', needBackfill.map(b => b.box_code))

      const wmsMap = Object.fromEntries((wmsRows ?? []).map(r => [r.device_id, r.inbound_id]))

      await Promise.all(needBackfill.map(b =>
        supabase.from('boxes').update({
          device_id:           b.box_code,
          asn_id:              wmsMap[b.box_code] ?? null,
          staging_location_id: selectedLocation.id,
          moved_at:            now,
        }).eq('id', b.id)
      ))

      const linked = (boxRows ?? []).filter(b => b.device_id && b.asn_id)
      if (linked.length > 0) {
        await supabase.from('boxes')
          .update({ staging_location_id: selectedLocation.id, moved_at: now })
          .in('id', linked.map(b => b.id))
      }
    } else {
      await supabase.from('boxes')
        .update({ staging_location_id: selectedLocation.id, moved_at: now })
        .eq('pallet_id', selectedPallet.id)
    }

    // 3. Activity log
    await supabase.from('activity_log').insert({
      event_type:    'pallet_moved',
      pallet_id:     selectedPallet.id,
      pallet_code:   selectedPallet.code,
      location_code: selectedLocation.code,
      user_id:       profile.id,
      user_email:    profile.email,
      meta:          { box_count: boxes.length, status: 'staged' },
    })

    showToast(`✓ ${selectedPallet.code} → ${selectedLocation.code}`, 'ok')
    resetToStep1()
    fetchDoneHistory()
    onUpdated()
    setConfirming(false)
  }

  const filteredStagings = stagingLocations.filter(l =>
    !locationSearch || l.code.toLowerCase().includes(locationSearch.toLowerCase())
  )

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Mover Station</h1>
        <p style={{ fontSize: 13, color: '#6b6a64' }}>Scan pallet → chọn staging → confirm</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        {([
          { key: 'mover'  as const, label: 'Di chuyển' },
          { key: 'layout' as const, label: 'Layout kho' },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 18px', fontSize: 14,
            fontWeight: activeTab === tab.key ? 700 : 400,
            color: activeTab === tab.key ? '#1a1916' : '#a09e96',
            borderBottom: activeTab === tab.key ? '2px solid #1a1916' : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.12s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'layout' && <LayoutTab />}

      {activeTab === 'mover' && (
        <>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
            {([
              { key: 'scan_pallet'      as const, label: '1. Scan Pallet' },
              { key: 'confirm_location' as const, label: '2. Chọn Staging' },
            ]).map((s, i) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: step === s.key ? '#1a1916' : '#fff',
                  color:      step === s.key ? '#fff' : '#a09e96',
                  border: `1px solid ${step === s.key ? '#1a1916' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500,
                }}>
                  {s.label}
                  {step === s.key && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8ff47' }} />}
                </div>
                {i < 1 && <div style={{ width: 24, height: 1, background: 'rgba(0,0,0,0.12)', margin: '0 4px' }} />}
              </div>
            ))}
            {step === 'confirm_location' && (
              <button onClick={resetToStep1} style={{
                marginLeft: 'auto', background: 'transparent',
                border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6,
                padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: '#6b6a64',
              }}>
                ← Quét pallet khác
              </button>
            )}
          </div>

          {/* ── Step 1 ── */}
          {step === 'scan_pallet' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700 }}>Scan mã Pallet</span>
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input
                        ref={palletInputRef}
                        value={palletInput}
                        onChange={e => setPalletInput(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && handleScanPallet()}
                        placeholder="Scan hoặc nhập mã pallet... (Enter)"
                        autoFocus
                        style={{
                          flex: 1, background: '#f5f4f0',
                          border: '2px solid rgba(0,0,0,0.12)', borderRadius: 8,
                          color: '#1a1916', fontFamily: F.code, fontSize: 15,
                          padding: '12px 14px', outline: 'none',
                        }}
                      />
                      <button
                        onClick={handleScanPallet}
                        disabled={loading || !palletInput.trim()}
                        style={{
                          background: '#1a1916', color: '#fff', border: 'none',
                          borderRadius: 8, padding: '0 20px',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          opacity: (!palletInput.trim() || loading) ? 0.4 : 1,
                        }}
                      >
                        {loading ? '...' : 'Scan'}
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: '#a09e96' }}>
                      Chỉ pallet có status <strong>received</strong> mới di chuyển được
                    </div>
                  </div>
                </div>
                <ReceivedPalletList onSelect={handleSelectPallet} />
              </div>

              {/* History */}
              <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700 }}>Đã xử lý hôm nay</span>
                  <span style={{
                    fontFamily: F.code, fontSize: 12,
                    background: '#e8f5ee', color: '#1d6a3e',
                    border: '1px solid rgba(29,106,62,0.2)', borderRadius: 20, padding: '2px 10px',
                  }}>
                    {donePallets.length} pallet
                  </span>
                </div>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {donePallets.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: '#a09e96', fontSize: 13 }}>
                      Chưa có pallet nào hôm nay
                    </div>
                  ) : donePallets.map(p => (
                    <div key={p.id} style={{ padding: '11px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: F.code, fontSize: 13, fontWeight: 600 }}>{p.code}</div>
                        <div style={{ fontSize: 11, color: '#a09e96', marginTop: 2 }}>
                          {(p.boxes ?? []).length} box
                          {p.moved_at && ` · ${new Date(p.moved_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 'confirm_location' && selectedPallet && (
            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Pallet info */}
                <div style={{ background: '#1a1916', borderRadius: 14, padding: '16px 20px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 6 }}>
                    PALLET CẦN DI CHUYỂN
                  </div>
                  <div style={{ fontFamily: F.code, fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
                    {selectedPallet.code}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                    {[
                      { k: 'Box',    v: String(boxes.length) },
                      { k: 'Prefix', v: selectedPallet.prefix },
                      { k: 'Ngày',   v: selectedPallet.date_str.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') },
                    ].map(item => (
                      <div key={item.k}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>{item.k}</div>
                        <div style={{ fontFamily: F.code, fontSize: 14, fontWeight: 600, color: '#fff' }}>{item.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Box list */}
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700 }}>Danh sách Box</span>
                    <span style={{ fontFamily: F.code, fontSize: 11, color: '#a09e96' }}>{boxes.length} box</span>
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto', padding: '6px 0' }}>
                    {boxes.map((b, i) => (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 18px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <span style={{ fontFamily: F.code, fontSize: 11, color: '#a09e96', minWidth: 22 }}>{i + 1}</span>
                        <span style={{ fontFamily: F.code, fontSize: 13, fontWeight: 500, flex: 1 }}>{b.box_code}</span>
                        <span style={{ fontSize: 10, color: '#a09e96' }}>
                          {new Date(b.scanned_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scan staging */}
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700 }}>Scan mã Staging</span>
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <input
                        ref={locationInputRef}
                        value={locationInput}
                        onChange={e => setLocationInput(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && handleScanLocation()}
                        placeholder="Scan mã staging... (Enter)"
                        style={{
                          flex: 1, background: '#f5f4f0',
                          border: `2px solid ${selectedLocation ? 'rgba(29,106,62,0.4)' : 'rgba(0,0,0,0.12)'}`,
                          borderRadius: 8, color: '#1a1916', fontFamily: F.code,
                          fontSize: 14, padding: '10px 12px', outline: 'none',
                        }}
                      />
                      <button
                        onClick={handleScanLocation}
                        disabled={!locationInput.trim()}
                        style={{
                          background: '#0d4a8f', color: '#fff', border: 'none',
                          borderRadius: 8, padding: '0 14px',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          opacity: !locationInput.trim() ? 0.4 : 1,
                        }}
                      >
                        Scan
                      </button>
                    </div>
                    {selectedLocation && (
                      <div style={{ background: '#e8f5ee', border: '1px solid rgba(29,106,62,0.25)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16 }}>📍</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: F.code, fontSize: 14, fontWeight: 700, color: '#1d6a3e' }}>
                            {selectedLocation.code}
                          </div>
                        </div>
                        <button
                          onClick={() => { setSelectedLocation(null); setLocationInput('') }}
                          style={{ background: 'transparent', border: 'none', color: '#1d6a3e', cursor: 'pointer', fontSize: 16, padding: 4 }}
                        >✕</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: grid + confirm */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700 }}>Chọn Staging Location</span>
                    <input
                      value={locationSearch}
                      onChange={e => setLocationSearch(e.target.value)}
                      placeholder="Tìm..."
                      style={{
                        marginLeft: 'auto', width: 140,
                        background: '#f5f4f0', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6,
                        color: '#1a1916', fontFamily: F.code, fontSize: 12,
                        padding: '5px 10px', outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto', padding: '10px 14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
                      {filteredStagings.map(loc => {
                        const isSelected = selectedLocation?.id === loc.id
                        return (
                          <button
                            key={loc.id}
                            onClick={() => { setSelectedLocation(loc); setLocationInput(loc.code) }}
                            style={{
                              background: isSelected ? '#1a1916' : '#f5f4f0',
                              color:      isSelected ? '#fff' : '#1a1916',
                              border: `1.5px solid ${isSelected ? '#1a1916' : 'rgba(0,0,0,0.08)'}`,
                              borderRadius: 8, padding: '10px 12px',
                              cursor: 'pointer', fontFamily: F.code,
                              fontSize: 12, fontWeight: 600, textAlign: 'left',
                              transition: 'all 0.12s',
                            }}
                          >
                            {loc.code}
                            {loc.description && (
                              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2, fontWeight: 400 }}>
                                {loc.description}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Confirm */}
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700 }}>Xác nhận di chuyển</span>
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ background: '#f5f4f0', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                      {[
                        { k: 'Pallet',    v: selectedPallet.code,                            clr: undefined },
                        { k: 'Box',       v: `${boxes.length} box`,                           clr: undefined },
                        { k: 'Staging',   v: selectedLocation?.code ?? '— chưa chọn —',       clr: selectedLocation ? '#1d6a3e' : '#a09e96' },
                        { k: 'Status',    v: '→ staged',                                      clr: '#854d0e' },
                        { k: 'Thời gian', v: nowTime,                                          clr: '#6b6a64' },
                        { k: 'Mover',     v: profile.full_name ?? profile.email.split('@')[0], clr: undefined },
                      ].map(item => (
                        <div key={item.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                          <span style={{ fontSize: 12, color: '#a09e96' }}>{item.k}</span>
                          <span style={{ fontFamily: F.code, fontSize: 13, fontWeight: 600, color: item.clr ?? '#1a1916' }}>{item.v}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleConfirm}
                      disabled={!selectedLocation || confirming}
                      style={{
                        width: '100%',
                        background: (!selectedLocation || confirming) ? '#ccc' : '#1d6a3e',
                        color: '#fff', border: 'none', borderRadius: 10,
                        fontFamily: F.display, fontSize: 15, fontWeight: 700,
                        padding: 15, cursor: (!selectedLocation || confirming) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {confirming ? 'Đang xử lý...' : `CONFIRM — Staged tại ${selectedLocation?.code ?? '...'}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          background: toast.type === 'ok' ? '#1d6a3e' : toast.type === 'err' ? '#8f1a1a' : '#0d4a8f',
          color: '#fff', borderRadius: 10, padding: '13px 20px',
          fontSize: 13, fontWeight: 500, fontFamily: F.body,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}