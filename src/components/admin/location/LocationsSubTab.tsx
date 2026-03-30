'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Block, Zone, Location } from '@/lib/types'
// import { useBlocksAndZones } from '../../../../hooks/useBlocksAndZones'
import { useBlocksAndZones } from '@/hook/useBlocksAndZones'
import {
  C, F, inputStyle,
  useToast, Toast,
  Card, FieldRow, PrimaryBtn, ActionBtn,
  TableHead, EmptyRow, HoverRow,
  StatusBadge, PathBadge,
} from '@/ui'

export function LocationsSubTab() {
  const [locations, setLocations] = useState<Location[]>([])
  const { blocks, zones, fetchBlocks, fetchZones, filteredZones } = useBlocksAndZones()

  const [newCode, setNewCode] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newZoneId, setNewZoneId] = useState('')
  const [filterBlockId, setFilterBlockId] = useState('all')
  const [filterZoneId, setFilterZoneId] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editZoneId, setEditZoneId] = useState('')

  const { toast, show } = useToast()

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('*, zone:zones(*, block:blocks(*))')
      .order('code')
    setLocations((data as Location[]) ?? [])
  }

  useEffect(() => {
    fetchBlocks()
    fetchZones()
    fetchLocations()
  }, [fetchBlocks, fetchZones])

  const selectStyle: React.CSSProperties = { 
    ...inputStyle, 
    fontFamily: F.body, 
    cursor: 'pointer' 
  }

  const smallInput: React.CSSProperties = { 
    ...inputStyle, 
    padding: '6px 8px', 
    fontSize: 12 
  }

  // Lấy danh sách zone đã lọc theo block
  const formZones = filteredZones(filterBlockId)

  async function create() {
    if (!newCode.trim()) { show('Nhập mã location!', 'err'); return }
    if (!newZoneId) { show('Chọn zone!', 'err'); return }

    setLoading(true)
    const { error } = await supabase.from('locations').insert({
      code: newCode.trim().toUpperCase(),
      description: newDesc.trim() || null,
      zone_id: newZoneId,
      is_active: true,
    })

    if (error) {
      show(error.code === '23505' ? `Mã ${newCode.toUpperCase()} đã tồn tại!` : `Lỗi: ${error.message}`, 'err')
      setLoading(false)
      return
    }

    setNewCode('')
    setNewDesc('')
    show(`Đã thêm location ${newCode.toUpperCase()}`)
    await fetchLocations()
    setLoading(false)
  }

  async function saveEdit() {
    if (!editId || !editCode.trim() || !editZoneId) return

    const { error } = await supabase.from('locations').update({
      code: editCode.trim().toUpperCase(),
      description: editDesc.trim() || null,
      zone_id: editZoneId,
    }).eq('id', editId)

    if (error) {
      show(`Lỗi: ${error.message}`, 'err')
      return
    }

    show('Đã cập nhật')
    setEditId(null)
    await fetchLocations()
  }

  async function toggleActive(l: Location) {
    await supabase.from('locations').update({ is_active: !l.is_active }).eq('id', l.id)
    fetchLocations()
  }

  async function deleteLocation(l: Location) {
    if (!confirm(`Xóa location ${l.code}?`)) return

    const { error } = await supabase.from('locations').delete().eq('id', l.id)
    if (error) {
      show(`Lỗi: ${error.message}`, 'err')
      return
    }
    show(`Đã xóa ${l.code}`)
    fetchLocations()
  }

  function startEdit(l: Location) {
    setEditId(l.id)
    setEditCode(l.code)
    setEditDesc(l.description ?? '')
    setEditZoneId(l.zone_id)
  }

  // Lọc locations
  const filtered = locations.filter(l => {
    const zone = l.zone as (Zone & { block?: Block }) | undefined
    const matchSearch = !search || l.code.toLowerCase().includes(search.toLowerCase())
    const matchBlock = filterBlockId === 'all' || zone?.block?.id === filterBlockId
    const matchZone = filterZoneId === 'all' || l.zone_id === filterZoneId
    return matchSearch && matchBlock && matchZone
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Create form */}
      <Card title="Thêm Location mới">
        <div style={{ padding: 20 }}>
          <FieldRow label="Thuộc Block (lọc zone)">
            <select
              value={filterBlockId}
              onChange={e => { setFilterBlockId(e.target.value); setNewZoneId('') }}
              style={selectStyle}
            >
              <option value="all">— Tất cả block —</option>
              {blocks.map((b: Block) => (
                <option key={b.id} value={b.id}>
                  {b.code}{b.name ? ` — ${b.name}` : ''}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Thuộc Zone *">
            <select 
              value={newZoneId} 
              onChange={e => setNewZoneId(e.target.value)} 
              style={selectStyle}
            >
              <option value="">— Chọn zone —</option>
              {formZones.map((z: Zone) => (
                <option key={z.id} value={z.id}>
                  {z.code}{z.name ? ` — ${z.name}` : ''}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Mã Location *">
            <input 
              value={newCode} 
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              placeholder="VD: LOC-A1-001"
              onKeyDown={e => e.key === 'Enter' && create()}
              style={inputStyle} 
            />
          </FieldRow>

          <FieldRow label="Mô tả">
            <input 
              value={newDesc} 
              onChange={e => setNewDesc(e.target.value)}
              placeholder="VD: Kệ A, tầng 1" 
              style={inputStyle} 
            />
          </FieldRow>

          <PrimaryBtn 
            onClick={create} 
            disabled={loading || !newCode.trim() || !newZoneId}
          >
            {loading ? 'Đang thêm...' : '+ Thêm Location'}
          </PrimaryBtn>
        </div>
      </Card>

      {/* List */}
      <Card
        title={`Danh sách Location (${filtered.length})`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm mã..."
              style={{ 
                background: C.bgMuted, 
                border: `1px solid ${C.borderMid}`, 
                borderRadius: 6, 
                color: C.text, 
                fontFamily: F.code, 
                fontSize: 12, 
                padding: '5px 10px', 
                outline: 'none', 
                width: 120 
              }} 
            />
            <select 
              value={filterBlockId} 
              onChange={e => { setFilterBlockId(e.target.value); setFilterZoneId('all') }}
              style={{ 
                background: C.bgMuted, 
                border: `1px solid ${C.borderMid}`, 
                borderRadius: 6, 
                fontSize: 12, 
                padding: '5px 10px', 
                outline: 'none', 
                color: C.text 
              }}
            >
              <option value="all">Tất cả block</option>
              {blocks.map((b: Block) => (
                <option key={b.id} value={b.id}>{b.code}</option>
              ))}
            </select>

            <select 
              value={filterZoneId} 
              onChange={e => setFilterZoneId(e.target.value)}
              style={{ 
                background: C.bgMuted, 
                border: `1px solid ${C.borderMid}`, 
                borderRadius: 6, 
                fontSize: 12, 
                padding: '5px 10px', 
                outline: 'none', 
                color: C.text 
              }}
            >
              <option value="all">Tất cả zone</option>
              {filteredZones(filterBlockId).map((z: Zone) => (
                <option key={z.id} value={z.id}>{z.code}</option>
              ))}
            </select>
          </div>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <TableHead cols={['Đường dẫn', 'Mã Location', 'Mô tả', 'Status', 'Hành động']} />
            <tbody>
              {filtered.length === 0 ? (
                <EmptyRow cols={5} msg="Không tìm thấy location" />
              ) : (
                filtered.map((l: Location) => {
                  const zone = l.zone as (Zone & { block?: Block }) | undefined
                  return (
                    <HoverRow key={l.id}>
                      {editId === l.id ? (
                        <>
                          <td style={{ padding: '8px 16px' }}>
                            <select 
                              value={editZoneId} 
                              onChange={e => setEditZoneId(e.target.value)} 
                              style={smallInput}
                            >
                              {zones.map((z: Zone) => (
                                <option key={z.id} value={z.id}>
                                  {z.block?.code} › {z.code}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px 16px' }}>
                            <input 
                              value={editCode} 
                              onChange={e => setEditCode(e.target.value.toUpperCase())} 
                              style={{ ...smallInput, width: 120 }} 
                            />
                          </td>
                          <td style={{ padding: '8px 16px' }}>
                            <input 
                              value={editDesc} 
                              onChange={e => setEditDesc(e.target.value)} 
                              style={smallInput} 
                            />
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
                            <PathBadge parts={[zone?.block?.code, zone?.code]} />
                          </td>
                          <td style={{ padding: '11px 16px', fontFamily: F.code, fontSize: 12, fontWeight: 600 }}>
                            {l.code}
                          </td>
                          <td style={{ padding: '11px 16px', fontSize: 12, color: C.textMuted }}>
                            {l.description ?? '—'}
                          </td>
                          <td style={{ padding: '11px 16px' }}>
                            <StatusBadge active={l.is_active} />
                          </td>
                          <td style={{ padding: '11px 16px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <ActionBtn onClick={() => startEdit(l)} color={C.blue}>Sửa</ActionBtn>
                              <ActionBtn 
                                onClick={() => toggleActive(l)} 
                                color={l.is_active ? C.amber : C.green}
                              >
                                {l.is_active ? 'Ẩn' : 'Hiện'}
                              </ActionBtn>
                              <ActionBtn onClick={() => deleteLocation(l)} color={C.red}>Xóa</ActionBtn>
                            </div>
                          </td>
                        </>
                      )}
                    </HoverRow>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Toast toast={toast} />
    </div>
  )
}