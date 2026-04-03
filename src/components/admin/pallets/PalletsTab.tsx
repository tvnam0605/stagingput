'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Pallet } from '@/lib/types'
import { StatusBadge } from '@/app/page'
import { F, C } from '@/ui'

const DELETABLE_STATUSES = ['pending', 'ongoing']

export function PalletsTab() {
  const [pallets, setPallets] = useState<Pallet[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null) // null = modal đóng
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')

  const fetchPallets = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('pallets')
      .select('*')
      .in('status', DELETABLE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(500)
    if (data) setPallets(data as Pallet[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPallets() }, [fetchPallets])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }
const selectedDeletable = [...selected].filter(id =>
  pallets.find(p => p.id === id && DELETABLE_STATUSES.includes(p.status))
)
  const filtered = pallets.filter(p => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return p.code.toLowerCase().includes(q) || (p.note ?? '').toLowerCase().includes(q)
  })

  const allFilteredIds = filtered.map(p => p.id)
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id))

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelected(prev => new Set([...prev, ...allFilteredIds]))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Mở confirm modal — có thể xóa 1 hoặc nhiều
  function openConfirm(ids: string[]) {
    setConfirmIds(ids)
  }

  async function handleDelete() {
  if (!confirmIds || confirmIds.length === 0) return
  setDeleting(true)

  // Bước 1: Xóa activity_log liên quan trước
  const { error: logError } = await supabase
    .from('activity_log')
    .delete()
    .in('pallet_id', confirmIds)

  if (logError) {
    showToast(`Lỗi khi xóa log: ${logError.message}`)
    setDeleting(false)
    setConfirmIds(null)
    return
  }

  // Bước 2: Mới xóa pallet
  const { error, count } = await supabase
    .from('pallets')
    .delete({ count: 'exact' })
    .in('id', confirmIds)

  if (error) {
    showToast(`Lỗi: ${error.message}`)
  } else if (!count) {
    showToast('Không xóa được — kiểm tra RLS hoặc FK còn sót')
  } else {
    showToast(`Đã xóa ${count} pallet`)
    setSelected(prev => {
      const next = new Set(prev)
      confirmIds.forEach(id => next.delete(id))
      return next
    })
    await fetchPallets()
  }

  setDeleting(false)
  setConfirmIds(null)
}

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16,
        overflow: 'hidden', marginBottom: 16,
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700 }}>
              Pallet có thể xóa
            </span>
            <span style={{
              fontSize: 11, background: '#fef2f2', color: '#b91c1c',
              border: '1px solid rgba(185,28,28,0.2)', borderRadius: 6, padding: '2px 8px', fontWeight: 500,
            }}>
              pending &amp; ongoing
            </span>
            <span style={{ fontSize: 12, color: C.textMuted }}>({pallets.length})</span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo mã, ghi chú..."
              style={{
                background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 8, color: '#1a1916', fontSize: 12, padding: '7px 12px',
                outline: 'none', width: 220,
              }}
            />
            <button onClick={fetchPallets} title="Làm mới" style={{
              background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8,
              width: 32, height: 32, cursor: 'pointer', color: '#6b6a64', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>↻</button>

            {selectedDeletable.length > 0 && (
              <button
                onClick={() => openConfirm(selectedDeletable)}
                style={{
                  background: '#b91c1c', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 12, fontWeight: 600,
                  padding: '7px 14px', cursor: 'pointer',
                }}>
                Xóa {selectedDeletable.length} pallet đã chọn
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: '#f5f4f0' }}>
                <th style={{ padding: '9px 16px', width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    style={{ width: 14, height: 14, accentColor: '#1a1916', cursor: 'pointer' }}
                  />
                </th>
                {['Mã', 'Status', 'Ghi chú', 'Tạo lúc', ''].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#a09e96',
                    padding: '9px 16px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: '#a09e96' }}>
                    Đang tải...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: '#a09e96' }}>
                    {search ? 'Không tìm thấy pallet nào' : 'Không có pallet ở trạng thái pending hoặc ongoing'}
                  </td>
                </tr>
              ) : filtered.map(p => (
                <tr key={p.id} style={{
                  borderBottom: '1px solid rgba(0,0,0,0.05)',
                  background: selected.has(p.id) ? 'rgba(185,28,28,0.04)' : 'transparent',
                }}>
                  <td style={{ padding: '10px 16px' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleOne(p.id)}
                      style={{ width: 14, height: 14, accentColor: '#b91c1c', cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {p.code}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <StatusBadge status={p.status} />
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#6b6a64', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.note ?? <span style={{ color: '#ccc' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: '#a09e96', whiteSpace: 'nowrap' }}>
                    {new Date(p.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => openConfirm([p.id])}
                      style={{
                        background: 'transparent', color: '#b91c1c',
                        border: '1px solid rgba(185,28,28,0.25)',
                        borderRadius: 6, fontSize: 11, padding: '5px 10px', cursor: 'pointer',
                      }}>
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Modal */}
      {confirmIds !== null && (
        <div
          onClick={e => { if (e.target === e.currentTarget && !deleting) setConfirmIds(null) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 16, width: 360,
            boxShadow: '0 16px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1916', marginBottom: 4 }}>
                Xác nhận xóa pallet
              </div>
              <div style={{ fontSize: 13, color: '#6b6a64' }}>
                Hành động này <strong>không thể hoàn tác</strong>.
              </div>
            </div>

            <div style={{ padding: '16px 24px' }}>
              {/* Danh sách pallet sắp xóa */}
              <div style={{
                background: '#fef2f2', border: '1px solid rgba(185,28,28,0.15)',
                borderRadius: 8, padding: 12, marginBottom: 16,
                maxHeight: 160, overflowY: 'auto',
              }}>
                {confirmIds.map(id => {
                  const p = pallets.find(x => x.id === id)
                  return p ? (
                    <div key={id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '4px 0', borderBottom: '1px solid rgba(185,28,28,0.08)',
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#b91c1c' }}>{p.code}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  ) : null
                })}
              </div>

              <div style={{ fontSize: 13, color: '#6b6a64', marginBottom: 20 }}>
                Bạn chắc chắn muốn xóa <strong>{confirmIds.length} pallet</strong> trên?
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirmIds(null)}
                  disabled={deleting}
                  style={{
                    flex: 1, background: '#f0efe9', color: '#6b6a64',
                    border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8,
                    fontSize: 13, fontWeight: 600, padding: 11, cursor: 'pointer',
                  }}>
                  Huỷ
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    flex: 2, background: deleting ? '#ccc' : '#b91c1c', color: '#fff',
                    border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 700, padding: 11,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                  }}>
                  {deleting ? 'Đang xóa...' : `Xóa ${confirmIds.length} pallet`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, background: '#1a1916', color: '#fff',
          borderRadius: 8, padding: '12px 18px', fontSize: 13,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 999,
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}