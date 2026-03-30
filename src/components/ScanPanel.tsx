'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, Pallet, Box } from '@/lib/types'
import { StatusBadge } from '@/app/page'

const F = {
  display: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
  body:    "var(--font-body, 'Inter', sans-serif)",
  code:    "var(--font-code, 'Fira Code', monospace)",
}

export default function ScanPanel({ profile, onUpdated }: { profile: Profile; onUpdated: () => void }) {
  const [activePallets,   setActivePallets]   = useState<Pallet[]>([])
  const [selectedPallet,  setSelectedPallet]  = useState<Pallet | null>(null)
  const [boxes,           setBoxes]           = useState<Box[]>([])
  const [boxInput,        setBoxInput]        = useState('')
  const [palletSearch,    setPalletSearch]    = useState('')
  const [loading,         setLoading]         = useState(false)
  const [toast,           setToast]           = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchActivePallets = useCallback(async () => {
    const { data } = await supabase
      .from('pallets')
      .select('*')
      .in('status', ['pending', 'ongoing'])
      .order('created_at', { ascending: false })
    setActivePallets((data as Pallet[]) ?? [])
  }, [])

  const fetchBoxes = useCallback(async (palletId: string) => {
    const { data } = await supabase
      .from('boxes')
      .select('*')
      .eq('pallet_id', palletId)
      .order('scanned_at', { ascending: false })
    setBoxes((data as Box[]) ?? [])
  }, [])

  useEffect(() => {
    fetchActivePallets()
    const ch = supabase.channel('scan-pallets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pallets' }, fetchActivePallets)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchActivePallets])

  useEffect(() => {
    if (!selectedPallet) return
    fetchBoxes(selectedPallet.id)
    const ch = supabase.channel(`boxes-${selectedPallet.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'boxes',
        filter: `pallet_id=eq.${selectedPallet.id}`,
      }, () => fetchBoxes(selectedPallet.id))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [selectedPallet, fetchBoxes])

  // ── Helpers ────────────────────────────────────────────────────────────────
  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function selectPallet(p: Pallet) {
    setSelectedPallet(p)
    await fetchBoxes(p.id)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // ── Add box ────────────────────────────────────────────────────────────────
  async function addBox() {
    const code = boxInput.trim().toUpperCase()
    if (!code || !selectedPallet) return
    setBoxInput('')

    if (selectedPallet.status === 'received') {
      showToast('Pallet đã chốt, không thể thêm box!', 'err')
      return
    }
    if (boxes.find(b => b.box_code === code)) {
      showToast(`Box ${code} đã có trong pallet này!`, 'err')
      return
    }

    setLoading(true)

    const { error } = await supabase.from('boxes').insert({
      box_code:   code,
      pallet_id:  selectedPallet.id,
      scanned_by: profile.id,
    })

    if (error) {
      showToast(`Lỗi: ${error.message}`, 'err')
      setLoading(false)
      return
    }

    if (selectedPallet.status === 'pending') {
      await supabase.from('pallets').update({ status: 'ongoing' }).eq('id', selectedPallet.id)
      setSelectedPallet(prev => prev ? { ...prev, status: 'ongoing' } : prev)
    }

    await supabase.from('activity_log').insert({
      event_type:  'box_scanned',
      pallet_id:   selectedPallet.id,
      pallet_code: selectedPallet.code,
      box_code:    code,
      user_id:     profile.id,
      user_email:  profile.email,
    })

    await fetchBoxes(selectedPallet.id)
    fetchActivePallets()
    onUpdated()
    showToast(`✓ ${code}`)
    setLoading(false)
    inputRef.current?.focus()
  }

  // ── Remove box ─────────────────────────────────────────────────────────────
  async function removeBox(box: Box) {
    await supabase.from('boxes').delete().eq('id', box.id)
    const remaining = boxes.filter(b => b.id !== box.id)
    if (remaining.length === 0 && selectedPallet) {
      await supabase.from('pallets').update({ status: 'pending' }).eq('id', selectedPallet.id)
      setSelectedPallet(prev => prev ? { ...prev, status: 'pending' } : prev)
    }
    await fetchBoxes(selectedPallet!.id)
    fetchActivePallets()
    onUpdated()
  }

  // ── Done pallet ────────────────────────────────────────────────────────────
  async function donePallet() {
    if (!selectedPallet || boxes.length === 0) { showToast('Pallet chưa có box!', 'err'); return }
    if (!confirm(`Chốt pallet ${selectedPallet.code} với ${boxes.length} box?`)) return

    const { error } = await supabase.from('pallets').update({
      status:  'received',
      done_by: profile.id,
      done_at: new Date().toISOString(),
    }).eq('id', selectedPallet.id)

    if (error) { showToast('Lỗi khi chốt!', 'err'); return }

    await supabase.from('activity_log').insert({
      event_type:  'pallet_done',
      pallet_id:   selectedPallet.id,
      pallet_code: selectedPallet.code,
      user_id:     profile.id,
      user_email:  profile.email,
      meta:        { box_count: boxes.length },
    })

    showToast(`Chốt ${selectedPallet.code} — ${boxes.length} box`)
    setSelectedPallet(null)
    setBoxes([])
    fetchActivePallets()
    onUpdated()
  }

  const filtered = activePallets.filter(p =>
    !palletSearch || p.code.toLowerCase().includes(palletSearch.toLowerCase())
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Scan Box vào Pallet</h1>
        <p style={{ fontSize: 13, color: '#6b6a64' }}>Chọn pallet → scan từng box → nhấn Done để chốt</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Pallet list ─────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700 }}>Chọn Pallet</span>
            <span style={{ fontSize: 12, color: '#a09e96' }}>{activePallets.length} active</span>
          </div>
          <div style={{ padding: 12 }}>
            <input
              value={palletSearch}
              onChange={e => setPalletSearch(e.target.value)}
              placeholder="Tìm mã pallet..."
              style={{
                width: '100%', background: '#f0efe9',
                border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8,
                color: '#1a1916', fontFamily: F.code, fontSize: 13,
                padding: '9px 12px', outline: 'none',
                marginBottom: 10, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#a09e96', fontSize: 13 }}>
                  Không có pallet đang hoạt động
                </div>
              ) : filtered.map(p => (
                <div
                  key={p.id}
                  onClick={() => selectPallet(p)}
                  style={{
                    background: selectedPallet?.id === p.id ? '#e8f0fb' : '#f5f4f0',
                    border: `1px solid ${selectedPallet?.id === p.id ? 'rgba(13,74,143,0.3)' : 'rgba(0,0,0,0.07)'}`,
                    borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: F.code, fontSize: 13, fontWeight: 600 }}>{p.code}</div>
                    <div style={{ fontSize: 11, color: '#a09e96', marginTop: 2 }}>
                      {new Date(p.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Scan area ───────────────────────────────────────────────────── */}
        {!selectedPallet ? (
          <div style={{
            background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 420, flexDirection: 'column', gap: 10, color: '#a09e96',
          }}>
            <div style={{ fontSize: 36 }}>📦</div>
            <div style={{ fontSize: 14 }}>Chọn một pallet để bắt đầu scan</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Pallet info bar */}
            <div style={{ background: '#1a1916', borderRadius: 16, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 4 }}>
                    PALLET ĐANG XỬ LÝ
                  </div>
                  <div style={{ fontFamily: F.code, fontSize: 18, fontWeight: 600, color: '#fff' }}>
                    {selectedPallet.code}
                  </div>
                </div>
                <StatusBadge status={selectedPallet.status} />
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16,
                borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12,
              }}>
                {[
                  { k: 'Prefix',      v: selectedPallet.prefix },
                  { k: 'Ngày',        v: selectedPallet.date_str.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') },
                  { k: 'Box đã scan', v: String(boxes.length) },
                ].map(item => (
                  <div key={item.k}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>{item.k}</div>
                    <div style={{ fontFamily: F.code, fontSize: 14, fontWeight: 600, color: '#fff' }}>{item.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scan input + box list */}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700 }}>Scan Box ID</span>
                <span style={{ fontFamily: F.code, fontSize: 12, background: '#e8f0fb', color: '#0d4a8f', border: '1px solid rgba(13,74,143,0.2)', borderRadius: 20, padding: '2px 10px' }}>
                  {boxes.length} box
                </span>
              </div>
              <div style={{ padding: 16 }}>

                {/* Input */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input
                    ref={inputRef}
                    value={boxInput}
                    onChange={e => setBoxInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addBox()}
                    placeholder="Scan hoặc nhập Box ID... (Enter)"
                    style={{
                      flex: 1, background: '#f5f4f0',
                      border: '2px solid rgba(0,0,0,0.12)', borderRadius: 8,
                      color: '#1a1916', fontFamily: F.code, fontSize: 15,
                      padding: '11px 14px', outline: 'none',
                    }}
                    autoFocus
                  />
                  <button
                    onClick={addBox}
                    disabled={loading || !boxInput.trim()}
                    style={{
                      background: '#1a1916', color: '#fff', border: 'none',
                      borderRadius: 8, fontSize: 13, fontWeight: 600,
                      padding: '0 20px', cursor: 'pointer',
                      opacity: (!boxInput.trim() || loading) ? 0.4 : 1,
                    }}
                  >
                    + Thêm
                  </button>
                </div>

                {/* Box list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', marginBottom: 14 }}>
                  {boxes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#a09e96', fontSize: 13 }}>
                      Chưa có box. Bắt đầu scan...
                    </div>
                  ) : boxes.map((b, idx) => (
                    <div
                      key={b.id}
                      style={{
                        background: '#f5f4f0', border: '1px solid rgba(0,0,0,0.07)',
                        borderRadius: 8, padding: '9px 12px',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <span style={{ fontFamily: F.code, fontSize: 11, color: '#a09e96', minWidth: 20 }}>
                        {boxes.length - idx}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: F.code, fontSize: 13, fontWeight: 600 }}>{b.box_code}</div>
                        <div style={{ fontSize: 11, color: '#a09e96', marginTop: 1 }}>
                          {new Date(b.scanned_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </div>
                      <button
                        onClick={() => removeBox(b)}
                        style={{
                          width: 24, height: 24, borderRadius: 4,
                          border: '1px solid rgba(0,0,0,0.1)',
                          background: 'transparent', cursor: 'pointer',
                          color: '#a09e96', fontSize: 13, lineHeight: 1,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 14, display: 'flex', gap: 10 }}>
                  <button
                    onClick={donePallet}
                    disabled={boxes.length === 0}
                    style={{
                      flex: 1,
                      background: boxes.length === 0 ? '#ccc' : '#1d6a3e',
                      color: '#fff', border: 'none', borderRadius: 8,
                      fontFamily: F.display, fontSize: 15, fontWeight: 700,
                      padding: 14, cursor: boxes.length === 0 ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.03em',
                    }}
                  >
                    DONE — Chốt Pallet ({boxes.length} box)
                  </button>
                  <button
                    onClick={() => { setSelectedPallet(null); setBoxes([]) }}
                    style={{
                      background: 'transparent', color: '#6b6a64',
                      border: '1px solid rgba(0,0,0,0.12)',
                      borderRadius: 8, padding: '0 16px',
                      cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    Huỷ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          background: toast.type === 'ok' ? '#1d6a3e' : '#8f1a1a',
          color: '#fff', borderRadius: 8, padding: '12px 18px',
          fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          fontFamily: F.body,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}