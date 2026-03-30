'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Block, LocationStaging } from '@/lib/types'
import {
  C, F, inputStyle,
  useToast, Toast,
  Card, FieldRow, PrimaryBtn, ActionBtn,
  TableHead, EmptyRow, HoverRow,
  StatusBadge,
} from '@/ui'

export function StagingTab() {
  const [stagings, setStagings]     = useState<LocationStaging[]>([])
  const [blocks, setBlocks]         = useState<Block[]>([])
  const [newCode, setNewCode]       = useState('')
  const [newDesc, setNewDesc]       = useState('')
  const [newBlockId, setNewBlockId] = useState('')
  const [filterBlockId, setFilterBlockId] = useState('all')
  const [loading, setLoading]       = useState(false)
  const [editId, setEditId]         = useState<string | null>(null)
  const [editCode, setEditCode]     = useState('')
  const [editDesc, setEditDesc]     = useState('')
  const [editBlockId, setEditBlockId] = useState('')
  const { toast, show } = useToast()

  const fetchBlocks = useCallback(async () => {
    const { data } = await supabase.from('blocks').select('*').order('code')
    setBlocks((data as Block[]) ?? [])
  }, [])

  const fetchStagings = useCallback(async () => {
    const { data } = await supabase
      .from('locations_staging')
      .select('*, block:blocks(*)')
      .order('code')
    setStagings((data as LocationStaging[]) ?? [])
  }, [])

  useEffect(() => {
    fetchBlocks()
    fetchStagings()
  }, [fetchBlocks, fetchStagings])

  const selectStyle: React.CSSProperties = { ...inputStyle, fontFamily: F.body, cursor: 'pointer' }
  const smallInput: React.CSSProperties  = { ...inputStyle, padding: '6px 8px', fontSize: 12 }

  async function create() {
    if (!newCode.trim()) { show('Nhập mã staging!', 'err'); return }
    setLoading(true)
    const { error } = await supabase.from('locations_staging').insert({
      code:        newCode.trim().toUpperCase(),
      description: newDesc.trim() || null,
      block_id:    newBlockId || null,
      is_active:   true,
    })
    if (error) {
      show(error.code === '23505' ? `Mã ${newCode.toUpperCase()} đã tồn tại!` : `Lỗi: ${error.message}`, 'err')
      setLoading(false)
      return
    }
    setNewCode('')
    setNewDesc('')
    show(`Đã thêm staging ${newCode.toUpperCase()}`)
    await fetchStagings()
    setLoading(false)
  }

  async function saveEdit() {
    if (!editId || !editCode.trim()) return
    const { error } = await supabase.from('locations_staging').update({
      code:        editCode.trim().toUpperCase(),
      description: editDesc.trim() || null,
      block_id:    editBlockId || null,
    }).eq('id', editId)
    if (error) { show(`Lỗi: ${error.message}`, 'err'); return }
    show('Đã cập nhật')
    setEditId(null)
    await fetchStagings()
  }

  async function toggleActive(s: LocationStaging) {
    await supabase.from('locations_staging').update({ is_active: !s.is_active }).eq('id', s.id)
    fetchStagings()
  }

  async function deleteStaging(s: LocationStaging) {
    if (!confirm(`Xóa staging location ${s.code}?`)) return
    const { error } = await supabase.from('locations_staging').delete().eq('id', s.id)
    if (error) { show(`Lỗi: ${error.message}`, 'err'); return }
    show(`Đã xóa ${s.code}`)
    fetchStagings()
  }

  function startEdit(s: LocationStaging) {
    setEditId(s.id)
    setEditCode(s.code)
    setEditDesc(s.description ?? '')
    setEditBlockId((s as any).block_id ?? '')
  }

  const filtered = filterBlockId === 'all'
    ? stagings
    : stagings.filter(s => (s as any).block_id === filterBlockId)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Form tạo mới */}
      <Card title="Thêm Staging Location">
        <div style={{ padding: 20 }}>
          <div style={{
            background: C.purple.bg, border: `1px solid rgba(83,74,183,0.2)`,
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          }}>
            <p style={{ fontSize: 12, color: C.purple.text, margin: 0, lineHeight: 1.6 }}>
              Staging dùng để chứa hàng <strong>tạm thời</strong> trong khi chờ xử lý.
            </p>
          </div>

          <FieldRow label="Thuộc Block">
            <select value={newBlockId} onChange={e => setNewBlockId(e.target.value)} style={selectStyle}>
              <option value="">— Không chọn —</option>
              {blocks.map(b => (
                <option key={b.id} value={b.id}>
                  {b.code}{b.name ? ` — ${b.name}` : ''}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Mã Staging *">
            <input
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              placeholder="VD: STG-A1-001"
              onKeyDown={e => e.key === 'Enter' && create()}
              style={inputStyle}
            />
          </FieldRow>

          <FieldRow label="Mô tả">
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="VD: Vị trí chờ khu A"
              style={inputStyle}
            />
          </FieldRow>

          <PrimaryBtn onClick={create} disabled={loading || !newCode.trim()}>
            {loading ? 'Đang thêm...' : '+ Thêm Staging Location'}
          </PrimaryBtn>
        </div>
      </Card>

      {/* Danh sách */}
      <Card
        title={`Staging Locations (${filtered.length})`}
        action={
          <select
            value={filterBlockId}
            onChange={e => setFilterBlockId(e.target.value)}
            style={{ background: C.bgMuted, border: `1px solid ${C.borderMid}`, borderRadius: 6, fontSize: 12, padding: '5px 10px', outline: 'none', color: C.text }}
          >
            <option value="all">Tất cả block</option>
            {blocks.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
          </select>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <TableHead cols={['Block', 'Mã Staging', 'Mô tả', 'Status', 'Hành động']} />
            <tbody>
              {filtered.length === 0 ? (
                <EmptyRow cols={5} msg="Chưa có staging location nào" />
              ) : filtered.map(s => {
                const block = (s as any).block as Block | undefined
                return (
                  <HoverRow key={s.id}>
                    {editId === s.id ? (
                      <>
                        <td style={{ padding: '8px 16px' }}>
                          <select value={editBlockId} onChange={e => setEditBlockId(e.target.value)} style={smallInput}>
                            <option value="">— Không —</option>
                            {blocks.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px 16px' }}>
                          <input value={editCode} onChange={e => setEditCode(e.target.value.toUpperCase())} style={{ ...smallInput, width: 130 }} />
                        </td>
                        <td style={{ padding: '8px 16px' }}>
                          <input value={editDesc} onChange={e => setEditDesc(e.target.value)} style={smallInput} />
                        </td>
                        <td style={{ padding: '8px 16px' }}>
                          <span style={{ color: C.textFaint, fontSize: 12 }}>—</span>
                        </td>
                        <td style={{ padding: '8px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <ActionBtn onClick={saveEdit} color={C.green}>Lưu</ActionBtn>
                            <ActionBtn onClick={() => setEditId(null)} color={{ bg: C.bgMuted, text: C.textMuted }}>Huỷ</ActionBtn>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '11px 16px' }}>
                          {block ? (
                            <span style={{ fontFamily: F.code, fontSize: 12, fontWeight: 600, color: C.textMuted }}>
                              {block.code}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: C.textFaint }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ fontFamily: F.code, fontSize: 12, fontWeight: 600, color: C.purple.text }}>
                            {s.code}
                          </span>
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: C.textMuted }}>
                          {s.description ?? '—'}
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <StatusBadge active={s.is_active} />
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <ActionBtn onClick={() => startEdit(s)} color={C.blue}>Sửa</ActionBtn>
                            <ActionBtn onClick={() => toggleActive(s)} color={s.is_active ? C.amber : C.green}>
                              {s.is_active ? 'Ẩn' : 'Hiện'}
                            </ActionBtn>
                            <ActionBtn onClick={() => deleteStaging(s)} color={C.red}>Xóa</ActionBtn>
                          </div>
                        </td>
                      </>
                    )}
                  </HoverRow>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Toast toast={toast} />
    </div>
  )
}