'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Pallet, Box } from '@/lib/types'
import { StatusBadge } from '@/app/page'

const F = {
  display: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
  body:    "var(--font-body, 'Inter', sans-serif)",
  code:    "var(--font-code, 'Fira Code', monospace)",
}

type Profile = { full_name: string | null; email: string }

type BoxWithScanner = Box & {
  scanner: Profile | null
}

type PalletWithRelations = Pallet & {
  creator: Profile | null
  boxes: BoxWithScanner[]
}

export function HistoryPanel() {
  const [pallets, setPallets] = useState<PalletWithRelations[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<PalletWithRelations | null>(null)

  const fetchHistory = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from('pallets')
      .select(`
        *,
        creator:profiles!created_by(full_name, email),
        boxes(
          *,
          scanner:profiles!scanned_by(full_name, email)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(200)
    if (filter !== 'all') q = q.eq('status', filter)
    if (search) q = q.ilike('code', `%${search}%`)
    const { data } = await q
    setPallets((data as PalletWithRelations[]) ?? [])
  }, [filter, search])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  function exportCSV() {
    const hdr = 'PalletCode,Prefix,DateStr,Status,BoxCount,CreatedBy,Note,CreatedAt,DoneAt'
    const rows = pallets.map(p =>
      `${p.code},${p.prefix},${p.date_str},${p.status},${(p.boxes ?? []).length},"${p.creator?.full_name ?? p.creator?.email ?? ''}","${p.note ?? ''}","${p.created_at}","${p.done_at ?? ''}"`
    )
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([[hdr, ...rows].join('\n')], { type: 'text/csv' })),
      download: `wms_export_${new Date().toISOString().slice(0, 10)}.csv`,
    })
    a.click()
  }

  function fmt(iso: string) { return new Date(iso).toLocaleString('vi-VN') }
  function fmtT(iso: string) {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  function displayName(profile: Profile | null) {
    if (!profile) return '—'
    return profile.full_name || profile.email
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Lịch sử</h1>
        <p style={{ fontSize: 13, color: '#6b6a64' }}>Toàn bộ pallet đã nhận — tìm kiếm, lọc, xem chi tiết</p>
      </div>

      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700 }}>Tất cả Pallet</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã..."
              style={{ background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, color: '#1a1916', fontFamily: F.code, fontSize: 12, padding: '7px 10px', outline: 'none', width: 160 }} />
            <select value={filter} onChange={e => setFilter(e.target.value)}
              style={{ background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, color: '#1a1916', fontSize: 12, padding: '7px 10px', outline: 'none' }}>
              <option value="all">Tất cả</option>
              <option value="pending">Pending</option>
              <option value="ongoing">Ongoing</option>
              <option value="received">Received</option>
              <option value="done">Done</option>
            </select>
            <button onClick={exportCSV}
              style={{ background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 12, padding: '7px 12px', cursor: 'pointer', color: '#1a1916' }}>
              Xuất CSV
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f4f0' }}>
                {['Mã Pallet', 'Status', 'Box', 'Tạo bởi', 'Ghi chú', 'Tạo lúc', 'Done lúc', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#a09e96', padding: '10px 16px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pallets.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#a09e96', fontSize: 13 }}>Không tìm thấy</td></tr>
              ) : pallets.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9f9f7')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '11px 16px', fontFamily: F.code, fontSize: 12, fontWeight: 500 }}>{p.code}</td>
                  <td style={{ padding: '11px 16px' }}><StatusBadge status={p.status} /></td>
                  <td style={{ padding: '11px 16px', fontFamily: F.code, fontSize: 13 }}>{(p.boxes ?? []).length}</td>
                  <td style={{ padding: '11px 16px', fontSize: 12, color: '#1a1916' }}>
                    {displayName(p.creator)}
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 12, color: '#6b6a64', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.note ?? '—'}</td>
                  <td style={{ padding: '11px 16px', fontFamily: F.code, fontSize: 11, color: '#a09e96', whiteSpace: 'nowrap' }}>{fmtT(p.created_at)}</td>
                  <td style={{ padding: '11px 16px', fontFamily: F.code, fontSize: 11, color: '#a09e96', whiteSpace: 'nowrap' }}>{p.done_at ? fmtT(p.done_at) : '—'}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span onClick={() => setSelected(p)} style={{ color: '#0d4a8f', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Xem →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div onClick={e => e.target === e.currentTarget && setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 520, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <div>
                <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700 }}>Chi tiết Pallet</div>
                <div style={{ fontFamily: F.code, fontSize: 12, color: '#a09e96', marginTop: 2 }}>{selected.code}</div>
              </div>
              <button onClick={() => setSelected(null)}
                style={{ background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
                ✕ Đóng
              </button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { k: 'Trạng thái', v: <StatusBadge status={selected.status} /> },
                  { k: 'Số Box', v: <span style={{ fontFamily: F.code, fontSize: 20, fontWeight: 700 }}>{(selected.boxes ?? []).length}</span> },
                  {
                    k: 'Tạo bởi',
                    v: <span style={{ fontSize: 13, fontWeight: 500 }}>{displayName(selected.creator)}</span>
                  },
                  { k: 'Tạo lúc', v: fmt(selected.created_at) },
                  {
                    k: 'Chốt Receive lúc',
                    v: selected.done_at
                      ? <span style={{ fontWeight: 600, color: '#166534' }}>{fmt(selected.done_at)}</span>
                      : <span style={{ color: '#a09e96' }}>Chưa chốt</span>
                  },
                ].map(item => (
                  <div key={item.k} style={{ background: '#f5f4f0', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: '#a09e96', marginBottom: 6 }}>{item.k}</div>
                    <div style={{ fontSize: 13 }}>{item.v}</div>
                  </div>
                ))}
              </div>

              {selected.note && (
                <div style={{ background: '#fef3d7', border: '1px solid rgba(122,74,0,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#7a4a00', marginBottom: 16 }}>
                  📝 {selected.note}
                </div>
              )}

              <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                Danh sách Box ({(selected.boxes ?? []).length})
              </div>
              {!(selected.boxes ?? []).length ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#a09e96', fontSize: 13 }}>Chưa có box</div>
              ) : (selected.boxes ?? []).map((b: BoxWithScanner, i: number) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f5f4f0', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#a09e96', fontFamily: F.code, minWidth: 24 }}>{i + 1}</span>
                  <span style={{ fontFamily: F.code, fontSize: 13, fontWeight: 500, flex: 1 }}>{b.box_code}</span>
                  {/* Tên người scan */}
                  <span style={{ fontSize: 11, color: '#1a1916', background: '#e8e7e1', borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                    {displayName(b.scanner)}
                  </span>
                  {/* Thời gian scan */}
                  <span style={{ fontSize: 11, color: '#a09e96', fontFamily: F.code, whiteSpace: 'nowrap' }}>
                    {fmt(b.scanned_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}