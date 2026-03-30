'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Block, Zone } from '@/lib/types'
import {
  C, F, inputStyle,
  useToast, Toast,
  Card, FieldRow, PrimaryBtn, ActionBtn,
  TableHead, EmptyRow, HoverRow,
  StatusBadge, CodePill,
} from '@/ui'

export function ZonesTab() {
  const [zones, setZones] = useState<Zone[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newBlockId, setNewBlockId] = useState('')
  const [filterBlockId, setFilterBlockId] = useState('all')
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editBlockId, setEditBlockId] = useState('')
  const { toast, show } = useToast()

  const fetchBlocks = useCallback(async () => {
    const { data } = await supabase.from('blocks').select('*').eq('is_active', true).order('code')
    setBlocks((data as Block[]) ?? [])
  }, [])

  const fetchZones = useCallback(async () => {
    const { data } = await supabase.from('zones').select('*, block:blocks(*)').order('code')
    setZones((data as Zone[]) ?? [])
  }, [])

  useEffect(() => { fetchBlocks(); fetchZones() }, [fetchBlocks, fetchZones])

  const selectStyle: React.CSSProperties = { ...inputStyle, fontFamily: undefined, cursor: 'pointer' }
  const smallInput = { ...inputStyle, padding: '6px 8px', fontSize: 12 }

  async function create() {
    if (!newCode.trim()) { show('Nhập mã zone!', 'err'); return }
    if (!newBlockId) { show('Chọn block!', 'err'); return }
    setLoading(true)
    const { error } = await supabase.from('zones').insert({
      code: newCode.trim().toUpperCase(),
      name: newName.trim() || null,
      description: newDesc.trim() || null,
      block_id: newBlockId,
      is_active: true,
    })
    if (error) {
      show(error.code === '23505' ? `Mã ${newCode.toUpperCase()} đã tồn tại!` : `Lỗi: ${error.message}`, 'err')
      setLoading(false); return
    }
    setNewCode(''); setNewName(''); setNewDesc('')
    show(`Đã thêm zone ${newCode.toUpperCase()}`)
    await fetchZones()
    setLoading(false)
  }

  async function saveEdit() {
    if (!editId || !editCode.trim() || !editBlockId) return
    const { error } = await supabase.from('zones').update({
      code: editCode.trim().toUpperCase(),
      name: editName.trim() || null,
      description: editDesc.trim() || null,
      block_id: editBlockId,
    }).eq('id', editId)
    if (error) { show(`Lỗi: ${error.message}`, 'err'); return }
    show('Đã cập nhật')
    setEditId(null)
    await fetchZones()
  }

  async function toggleActive(z: Zone) {
    await supabase.from('zones').update({ is_active: !z.is_active }).eq('id', z.id)
    fetchZones()
  }

  async function deleteZone(z: Zone) {
    if (!confirm(`Xóa zone ${z.code}?`)) return
    const { error } = await supabase.from('zones').delete().eq('id', z.id)
    if (error) { show(`Lỗi: ${error.message}`, 'err'); return }
    show(`Đã xóa ${z.code}`)
    fetchZones()
  }

  function startEdit(z: Zone) {
    setEditId(z.id)
    setEditCode(z.code)
    setEditName(z.name ?? '')
    setEditDesc(z.description ?? '')
    setEditBlockId(z.block_id)
  }

  const filtered = filterBlockId === 'all' ? zones : zones.filter(z => z.block_id === filterBlockId)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Create form */}
      <Card title="Thêm Zone mới">
        <div style={{ padding: 20 }}>
          <FieldRow label="Thuộc Block *">
            <select value={newBlockId} onChange={e => setNewBlockId(e.target.value)} style={selectStyle}>
              <option value="">— Chọn block —</option>
              {blocks.map(b => (
                <option key={b.id} value={b.id}>{b.code}{b.name ? ` — ${b.name}` : ''}</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Mã Zone *">
            <input value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())}
              placeholder="VD: ZONE-A1"
              onKeyDown={e => e.key === 'Enter' && create()}
              style={inputStyle} />
          </FieldRow>
          <FieldRow label="Tên Zone">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="VD: Khu hàng lạnh" style={inputStyle} />
          </FieldRow>
          <FieldRow label="Mô tả">
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="Ghi chú..." style={inputStyle} />
          </FieldRow>
          <PrimaryBtn onClick={create} disabled={loading || !newCode.trim() || !newBlockId}>
            {loading ? 'Đang thêm...' : '+ Thêm Zone'}
          </PrimaryBtn>
        </div>
      </Card>

      {/* List */}
      <Card
        title={`Danh sách Zone (${filtered.length})`}
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
            <TableHead cols={['Block', 'Mã Zone', 'Tên', 'Mô tả', 'Status', 'Hành động']} />
            <tbody>
              {filtered.length === 0
                ? <EmptyRow cols={6} msg="Chưa có zone nào" />
                : filtered.map(z => (
                  <HoverRow key={z.id}>
                    {editId === z.id ? (
                      <>
                        <td style={{ padding: '8px 16px' }}>
                          <select value={editBlockId} onChange={e => setEditBlockId(e.target.value)}
                            style={{ ...smallInput, width: 120 }}>
                            {blocks.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px 16px' }}>
                          <input value={editCode} onChange={e => setEditCode(e.target.value.toUpperCase())} style={{ ...smallInput, width: 100 }} />
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
                        <td style={{ padding: '11px 16px' }}><CodePill code={z.block?.code} /></td>
                        <td style={{ padding: '11px 16px', fontFamily: F.code, fontSize: 12, fontWeight: 600 }}>{z.code}</td>
                        <td style={{ padding: '11px 16px', fontSize: 13 }}>{z.name ?? '—'}</td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: C.textMuted }}>{z.description ?? '—'}</td>
                        <td style={{ padding: '11px 16px' }}><StatusBadge active={z.is_active} /></td>
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <ActionBtn onClick={() => startEdit(z)} color={C.blue}>Sửa</ActionBtn>
                            <ActionBtn onClick={() => toggleActive(z)} color={z.is_active ? C.amber : C.green}>
                              {z.is_active ? 'Ẩn' : 'Hiện'}
                            </ActionBtn>
                            <ActionBtn onClick={() => deleteZone(z)} color={C.red}>Xóa</ActionBtn>
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