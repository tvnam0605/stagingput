'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Block } from '@/lib/types'
import {
  C, F, inputStyle,
  useToast, Toast,
  Card, FieldRow, PrimaryBtn, ActionBtn, RefreshBtn,
  TableHead, EmptyRow, HoverRow,
  StatusBadge,
} from '@/ui'

export function BlocksTab() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const { toast, show } = useToast()

  const fetchBlocks = useCallback(async () => {
    const { data } = await supabase.from('blocks').select('*').order('code')
    setBlocks((data as Block[]) ?? [])
  }, [])

  useEffect(() => { fetchBlocks() }, [fetchBlocks])

  async function create() {
    if (!newCode.trim()) { show('Nhập mã block!', 'err'); return }
    setLoading(true)
    const { error } = await supabase.from('blocks').insert({
      code: newCode.trim().toUpperCase(),
      name: newName.trim() || null,
      description: newDesc.trim() || null,
      is_active: true,
    })
    if (error) {
      show(error.code === '23505' ? `Mã ${newCode.toUpperCase()} đã tồn tại!` : `Lỗi: ${error.message}`, 'err')
      setLoading(false); return
    }
    setNewCode(''); setNewName(''); setNewDesc('')
    show(`Đã thêm block ${newCode.toUpperCase()}`)
    await fetchBlocks()
    setLoading(false)
  }

  async function saveEdit() {
    if (!editId || !editCode.trim()) return
    const { error } = await supabase.from('blocks').update({
      code: editCode.trim().toUpperCase(),
      name: editName.trim() || null,
      description: editDesc.trim() || null,
    }).eq('id', editId)
    if (error) { show(`Lỗi: ${error.message}`, 'err'); return }
    show('Đã cập nhật')
    setEditId(null)
    await fetchBlocks()
  }

  async function toggleActive(b: Block) {
    await supabase.from('blocks').update({ is_active: !b.is_active }).eq('id', b.id)
    fetchBlocks()
  }

  async function deleteBlock(b: Block) {
    if (!confirm(`Xóa block ${b.code}? Các zone trong block này cũng sẽ bị ảnh hưởng.`)) return
    const { error } = await supabase.from('blocks').delete().eq('id', b.id)
    if (error) { show(`Lỗi: ${error.message}`, 'err'); return }
    show(`Đã xóa ${b.code}`)
    fetchBlocks()
  }

  function startEdit(b: Block) {
    setEditId(b.id)
    setEditCode(b.code)
    setEditName(b.name ?? '')
    setEditDesc(b.description ?? '')
  }

  const smallInput = { ...inputStyle, padding: '6px 8px', fontSize: 12 }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Create form */}
      <Card title="Thêm Block mới">
        <div style={{ padding: 20 }}>
          <FieldRow label="Mã Block *">
            <input value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())}
              placeholder="VD: BLOCK-A"
              onKeyDown={e => e.key === 'Enter' && create()}
              style={inputStyle} />
          </FieldRow>
          <FieldRow label="Tên Block">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="VD: Khu A - Nhập hàng" style={inputStyle} />
          </FieldRow>
          <FieldRow label="Mô tả">
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="Ghi chú thêm..." style={inputStyle} />
          </FieldRow>
          <PrimaryBtn onClick={create} disabled={loading || !newCode.trim()}>
            {loading ? 'Đang thêm...' : '+ Thêm Block'}
          </PrimaryBtn>
        </div>
      </Card>

      {/* List */}
      <Card
        title={`Danh sách Block (${blocks.length})`}
        action={<RefreshBtn onClick={fetchBlocks} />}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <TableHead cols={['Mã Block', 'Tên', 'Mô tả', 'Status', 'Hành động']} />
            <tbody>
              {blocks.length === 0
                ? <EmptyRow cols={5} msg="Chưa có block nào" />
                : blocks.map(b => (
                  <HoverRow key={b.id}>
                    {editId === b.id ? (
                      <>
                        <td style={{ padding: '8px 16px' }}>
                          <input value={editCode} onChange={e => setEditCode(e.target.value.toUpperCase())} style={{ ...smallInput, width: 120 }} />
                        </td>
                        <td style={{ padding: '8px 16px' }}>
                          <input value={editName} onChange={e => setEditName(e.target.value)} style={smallInput} />
                        </td>
                        <td style={{ padding: '8px 16px' }}>
                          <input value={editDesc} onChange={e => setEditDesc(e.target.value)} style={smallInput} />
                        </td>
                        <td style={{ padding: '8px 16px' }}><span style={{ color: C.textFaint, fontSize: 12 }}>—</span></td>
                        <td style={{ padding: '8px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <ActionBtn onClick={saveEdit} color={C.green}>Lưu</ActionBtn>
                            <ActionBtn onClick={() => setEditId(null)} color={{ bg: C.bgMuted, text: C.textMuted }}>Huỷ</ActionBtn>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '11px 16px', fontFamily: F.code, fontSize: 12, fontWeight: 600 }}>{b.code}</td>
                        <td style={{ padding: '11px 16px', fontSize: 13 }}>{b.name ?? '—'}</td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: C.textMuted }}>{b.description ?? '—'}</td>
                        <td style={{ padding: '11px 16px' }}><StatusBadge active={b.is_active} /></td>
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <ActionBtn onClick={() => startEdit(b)} color={C.blue}>Sửa</ActionBtn>
                            <ActionBtn onClick={() => toggleActive(b)} color={b.is_active ? C.amber : C.green}>
                              {b.is_active ? 'Ẩn' : 'Hiện'}
                            </ActionBtn>
                            <ActionBtn onClick={() => deleteBlock(b)} color={C.red}>Xóa</ActionBtn>
                          </div>
                        </td>
                      </>
                    )}
                  </HoverRow>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Toast toast={toast} />
    </div>
  )
}