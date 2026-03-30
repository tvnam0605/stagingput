'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

const F = {
  display: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
  body:    "var(--font-body, 'Inter', sans-serif)",
  code:    "var(--font-code, 'Fira Code', monospace)",
}

export function AccountsTab() {
  const [users, setUsers] = useState<Profile[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'receiver' | 'mover' | 'admin'>('receiver')
  const [newPwd, setNewPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers((data as Profile[]) ?? [])
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function createUser() {
    if (!newEmail.endsWith('@shopee.com')) { showToast('Chỉ chấp nhận @shopee.com', 'err'); return }
    if (newPwd.length < 8) { showToast('Mật khẩu tối thiểu 8 ký tự', 'err'); return }
    if (!newName.trim()) { showToast('Nhập họ tên!', 'err'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: newEmail,
      password: newPwd,
      options: { data: { full_name: newName.trim(), role: newRole } },
    })
    if (error) { showToast(`Lỗi: ${error.message}`, 'err'); setLoading(false); return }
    setNewEmail(''); setNewName(''); setNewPwd(''); setNewRole('receiver')
    showToast(`✓ Đã tạo account ${newEmail}`)
    setTimeout(fetchUsers, 1500)
    setLoading(false)
  }

  async function toggleActive(user: Profile) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !user.is_active })
      .eq('id', user.id)
    if (error) { showToast('Lỗi cập nhật!', 'err'); return }
    fetchUsers()
  }

  async function changeRole(userId: string, role: 'admin' | 'receiver' | 'mover') {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
    if (error) { showToast('Lỗi đổi role!', 'err'); return }
    fetchUsers()
    showToast('Đã cập nhật role')
  }

  const roleBadge: Record<string, { bg: string; color: string }> = {
    admin:    { bg: '#eeedfe', color: '#3C3489' },
    receiver: { bg: '#e8f0fb', color: '#0d4a8f' },
    mover:    { bg: '#e8f5ee', color: '#1d6a3e' },
  }

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole === 'all' || u.role === filterRole
    return matchSearch && matchRole
  })

  const stats = {
    total:    users.length,
    active:   users.filter(u => u.is_active).length,
    admin:    users.filter(u => u.role === 'admin').length,
    receiver: users.filter(u => u.role === 'receiver').length,
    mover:    users.filter(u => u.role === 'mover').length,
  }

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Tổng',     value: stats.total,    color: '#1a1916' },
          { label: 'Active',   value: stats.active,   color: '#1d6a3e' },
          { label: 'Admin',    value: stats.admin,    color: '#3C3489' },
          { label: 'Receiver', value: stats.receiver, color: '#0d4a8f' },
          { label: 'Mover',    value: stats.mover,    color: '#854F0B' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#a09e96', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── CREATE FORM ── */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700 }}>Tạo tài khoản mới</span>
          </div>
          <div style={{ padding: 20 }}>
            {/* Email */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6a64', marginBottom: 6 }}>Email *</label>
              <input
                type="email" value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="name@shopee.com"
                style={{ width: '100%', background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, color: '#1a1916', fontFamily: F.code, fontSize: 13, padding: '9px 12px', outline: 'none' }}
              />
              {newEmail && !newEmail.endsWith('@shopee.com') && (
                <div style={{ fontSize: 11, color: '#8f1a1a', marginTop: 4 }}>⚠ Phải là email @shopee.com</div>
              )}
            </div>

            {/* Full name */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6a64', marginBottom: 6 }}>Họ tên *</label>
              <input
                type="text" value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nguyễn Văn A"
                style={{ width: '100%', background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, color: '#1a1916', fontFamily: F.body, fontSize: 13, padding: '9px 12px', outline: 'none' }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6a64', marginBottom: 6 }}>Mật khẩu * (tối thiểu 8 ký tự)</label>
              <input
                type="password" value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, color: '#1a1916', fontFamily: F.code, fontSize: 13, padding: '9px 12px', outline: 'none' }}
              />
              {newPwd && newPwd.length < 8 && (
                <div style={{ fontSize: 11, color: '#8f1a1a', marginTop: 4 }}>⚠ Còn thiếu {8 - newPwd.length} ký tự</div>
              )}
            </div>

            {/* Role */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6a64', marginBottom: 8 }}>Role *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { key: 'receiver', label: 'Receiver', desc: 'Nhận hàng' },
                  { key: 'mover',    label: 'Mover',    desc: 'Vận chuyển' },
                  { key: 'admin',    label: 'Admin',    desc: 'Quản trị' },
                ] as const).map(r => (
                  <button key={r.key} onClick={() => setNewRole(r.key)} style={{
                    flex: 1, textAlign: 'center',
                    background: newRole === r.key ? '#1a1916' : '#f0efe9',
                    color: newRole === r.key ? '#fff' : '#6b6a64',
                    border: '1px solid', borderColor: newRole === r.key ? '#1a1916' : 'rgba(0,0,0,0.1)',
                    borderRadius: 8, padding: '8px 6px', cursor: 'pointer', transition: 'all 0.14s',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{r.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.65, marginTop: 2 }}>{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={createUser}
              disabled={loading || !newEmail.endsWith('@shopee.com') || newPwd.length < 8 || !newName.trim()}
              style={{
                width: '100%',
                background: (loading || !newEmail.endsWith('@shopee.com') || newPwd.length < 8 || !newName.trim()) ? '#ccc' : '#1a1916',
                color: '#fff', border: 'none', borderRadius: 8,
                fontFamily: F.display, fontSize: 14, fontWeight: 700,
                padding: 12, cursor: 'pointer', transition: 'background 0.14s',
              }}
            >
              {loading ? 'Đang tạo...' : '+ Tạo tài khoản'}
            </button>
          </div>
        </div>

        {/* ── USER TABLE ── */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700 }}>
              Danh sách tài khoản
            </span>
            <span style={{ fontFamily: F.code, fontSize: 11, color: '#a09e96', background: '#f0efe9', borderRadius: 20, padding: '2px 8px' }}>
              {filtered.length}/{users.length}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm email hoặc tên..."
                style={{ background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, color: '#1a1916', fontFamily: F.body, fontSize: 12, padding: '6px 10px', outline: 'none', width: 180 }}
              />
              <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                style={{ background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, color: '#1a1916', fontSize: 12, padding: '6px 10px', outline: 'none' }}>
                <option value="all">Tất cả role</option>
                <option value="admin">Admin</option>
                <option value="receiver">Receiver</option>
                <option value="mover">Mover</option>
              </select>
              <button onClick={fetchUsers} style={{ background: '#f0efe9', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 12, padding: '6px 12px', cursor: 'pointer', color: '#6b6a64' }}>
                ↻ Làm mới
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f4f0' }}>
                  {['Email', 'Họ tên', 'Role', 'Trạng thái', 'Tạo lúc', 'Hành động'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#a09e96', padding: '10px 16px', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#a09e96', fontSize: 13 }}>
                      {users.length === 0 ? 'Chưa có tài khoản nào' : 'Không tìm thấy tài khoản phù hợp'}
                    </td>
                  </tr>
                ) : filtered.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9f9f7')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                    {/* Email */}
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ fontFamily: F.code, fontSize: 12 }}>{u.email}</div>
                    </td>

                    {/* Name */}
                    <td style={{ padding: '11px 16px', fontSize: 13 }}>
                      {u.full_name ?? <span style={{ color: '#a09e96', fontSize: 12 }}>—</span>}
                    </td>

                    {/* Role dropdown */}
                    <td style={{ padding: '11px 16px' }}>
                      <select
                        value={u.role}
                        onChange={e => changeRole(u.id, e.target.value as 'admin' | 'receiver' | 'mover')}
                        style={{
                          background: roleBadge[u.role]?.bg ?? '#f0efe9',
                          color: roleBadge[u.role]?.color ?? '#1a1916',
                          border: 'none', borderRadius: 6,
                          fontSize: 11, fontWeight: 600,
                          padding: '3px 8px', cursor: 'pointer', outline: 'none',
                        }}
                      >
                        <option value="receiver">receiver</option>
                        <option value="mover">mover</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>

                    {/* Active status */}
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                        background: u.is_active ? '#e8f5ee' : '#fce8e8',
                        color: u.is_active ? '#1d6a3e' : '#8f1a1a',
                        border: `1px solid ${u.is_active ? 'rgba(29,106,62,0.2)' : 'rgba(143,26,26,0.2)'}`,
                      }}>
                        {u.is_active ? '● Active' : '○ Disabled'}
                      </span>
                    </td>

                    {/* Created at */}
                    <td style={{ padding: '11px 16px', fontFamily: F.code, fontSize: 11, color: '#a09e96', whiteSpace: 'nowrap' }}>
                      {new Date(u.created_at).toLocaleDateString('vi-VN')}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '11px 16px' }}>
                      <button
                        onClick={() => toggleActive(u)}
                        style={{
                          background: u.is_active ? '#fce8e8' : '#e8f5ee',
                          color: u.is_active ? '#8f1a1a' : '#1d6a3e',
                          border: 'none', borderRadius: 6,
                          fontSize: 12, fontWeight: 500,
                          padding: '5px 12px', cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {u.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          background: toast.type === 'ok' ? '#1a1916' : '#8f1a1a',
          color: '#fff', borderRadius: 8,
          padding: '12px 18px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}