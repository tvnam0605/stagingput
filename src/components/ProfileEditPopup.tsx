'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

const F = {
  display: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
  body:    "var(--font-body, 'Inter', sans-serif)",
  code:    "var(--font-code, 'Fira Code', monospace)",
}

interface Props {
  profile: Profile
  onClose: () => void
  onUpdated: (updated: Profile) => void
}

export function ProfileEditPopup({ profile, onClose, onUpdated }: Props) {
  const [fullName,    setFullName]    = useState(profile.full_name ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')

  async function handleSave() {
    setError('')
    setSuccess('')

    if (newPassword && newPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }
    if (newPassword && newPassword !== confirmPw) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }

    setLoading(true)

    // Cập nhật full_name trong profiles
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', profile.id)

    if (profileErr) {
      setLoading(false)
      setError('Lỗi cập nhật tên: ' + profileErr.message)
      return
    }

    // Đổi mật khẩu nếu có nhập
    if (newPassword) {
      const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword })
      if (pwErr) {
        setLoading(false)
        setError('Lỗi đổi mật khẩu: ' + pwErr.message)
        return
      }
    }

    setLoading(false)
    setSuccess('Cập nhật thành công!')
    setNewPassword('')
    setConfirmPw('')
    onUpdated({ ...profile, full_name: fullName.trim() || null })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#242424',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#f0f0f0',
    fontFamily: F.code,
    fontSize: 14,
    padding: '10px 12px',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 900, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 901,
        width: 360,
        background: '#1a1a1a',
        border: '1px solid #2e2e2e',
        borderRadius: 16,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #2e2e2e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, color: '#fff' }}>
              Chỉnh sửa hồ sơ
            </div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2, fontFamily: F.code }}>
              {profile.email}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 4 }}
          >×</button>
        </div>

        {/* Role badge (read-only) */}
        <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#555' }}>Quyền:</span>
          <span style={{
            background: 'rgba(200,255,71,0.1)', color: '#c8ff47',
            fontSize: 10, padding: '2px 8px', borderRadius: 10,
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
            fontFamily: F.code,
          }}>
            {profile.role}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px 20px' }}>

          {/* Full name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 6, letterSpacing: '0.06em' }}>
              TÊN HIỂN THỊ
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Nhập tên hiển thị..."
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#c8ff47')}
              onBlur={e => (e.target.style.borderColor = '#333')}
            />
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #2a2a2a', margin: '16px 0' }} />
          <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.06em', marginBottom: 12 }}>
            ĐỔI MẬT KHẨU <span style={{ color: '#3a3a3a', fontSize: 10 }}>(để trống nếu không đổi)</span>
          </div>

          {/* New password */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 6, letterSpacing: '0.06em' }}>
              MẬT KHẨU MỚI
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#c8ff47')}
              onBlur={e => (e.target.style.borderColor = '#333')}
            />
          </div>

          {/* Confirm password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 6, letterSpacing: '0.06em' }}>
              XÁC NHẬN MẬT KHẨU
            </label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              style={{
                ...inputStyle,
                borderColor: confirmPw && confirmPw !== newPassword ? '#ff7070' : '#333',
              }}
              onFocus={e => (e.target.style.borderColor = confirmPw !== newPassword ? '#ff7070' : '#c8ff47')}
              onBlur={e => (e.target.style.borderColor = confirmPw && confirmPw !== newPassword ? '#ff7070' : '#333')}
            />
          </div>

          {/* Error / Success */}
          {error && (
            <div style={{
              background: 'rgba(255,71,71,0.1)', border: '1px solid rgba(255,71,71,0.3)',
              borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#ff7070', marginBottom: 14,
            }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{
              background: 'rgba(200,255,71,0.08)', border: '1px solid rgba(200,255,71,0.25)',
              borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#c8ff47', marginBottom: 14,
            }}>
              {success}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, background: 'transparent', border: '1px solid #333',
                borderRadius: 8, color: '#666', fontSize: 13, fontWeight: 600,
                padding: '10px', cursor: 'pointer', fontFamily: F.body,
              }}
            >
              Huỷ
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              style={{
                flex: 2,
                background: loading ? '#555' : '#c8ff47',
                color: '#0f0f0f', border: 'none', borderRadius: 8,
                fontFamily: F.display, fontSize: 13, fontWeight: 700,
                padding: '10px', cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.04em', transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Đang lưu...' : 'LƯU THAY ĐỔI'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}