'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Tab = 'login' | 'register'
type Role = 'receiver' | 'mover'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('login')

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  // Register state
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [regRole, setRegRole] = useState<Role>('receiver')
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')

    if (!loginEmail.endsWith('@shopee.com')) {
      setLoginError('Chỉ chấp nhận email @shopee.com')
      return
    }

    setLoginLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })
    setLoginLoading(false)

    if (err) {
      setLoginError('Email hoặc mật khẩu không đúng')
      return
    }
    router.push('/')
    router.refresh()
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setRegError('')
    setRegSuccess('')

    if (!regEmail.endsWith('@shopee.com')) {
      setRegError('Chỉ chấp nhận email @shopee.com')
      return
    }

    if (regPassword.length < 6) {
      setRegError('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }

    if (regPassword !== regConfirm) {
      setRegError('Mật khẩu xác nhận không khớp')
      return
    }

    setRegLoading(true)

    const { data, error: err } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
    })

    if (err) {
      setRegLoading(false)
      setRegError(err.message || 'Tạo tài khoản thất bại')
      return
    }

    // Insert vào profiles với role được chọn
    if (data.user) {
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: regEmail,
          role: regRole,
        }, { onConflict: 'id' })

      if (profileErr) {
        setRegLoading(false)
        setRegError('Tạo profile thất bại: ' + profileErr.message)
        return
      }
    }

    setRegLoading(false)

    // Confirm email tắt → có session → redirect luôn
    if (data.session) {
      router.push('/')
      router.refresh()
      return
    }

    // Fallback nếu bật confirm email
    setRegSuccess('Tạo tài khoản thành công! Kiểm tra email để xác nhận.')
    setRegEmail('')
    setRegPassword('')
    setRegConfirm('')
    setRegRole('receiver')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#242424',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#f0f0f0',
    fontFamily: 'var(--font-code), monospace',
    fontSize: 14,
    padding: '10px 12px',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  }

  const roles: { value: Role; label: string; desc: string }[] = [
    { value: 'receiver', label: 'Receiver', desc: 'Tiếp nhận & kiểm hàng' },
    { value: 'mover', label: 'Mover', desc: 'Di chuyển & sắp xếp hàng' },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body), sans-serif',
    }}>
      <div style={{ width: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontFamily: 'var(--font-display), sans-serif',
            fontSize: 28,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '0.06em',
            marginBottom: 6,
          }}>
            WMS<span style={{ color: '#c8ff47' }}>.</span>RCV
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            Receiver Station — Internal Use Only
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #2e2e2e',
          borderRadius: 16,
          overflow: 'hidden',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #2e2e2e' }}>
            {(['login', 'register'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: tab === t ? '2px solid #c8ff47' : '2px solid transparent',
                  color: tab === t ? '#c8ff47' : '#555',
                  fontFamily: 'var(--font-display), sans-serif',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '14px 0',
                  cursor: 'pointer',
                  transition: 'color 0.15s, border-color 0.15s',
                  marginBottom: -1,
                }}
              >
                {t === 'login' ? 'ĐĂNG NHẬP' : 'TẠO TÀI KHOẢN'}
              </button>
            ))}
          </div>

          {/* Login Form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} style={{ padding: 32 }}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6, letterSpacing: '0.04em' }}>
                  EMAIL
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="your.name@shopee.com"
                  required
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#c8ff47')}
                  onBlur={e => (e.target.style.borderColor = '#333')}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6, letterSpacing: '0.04em' }}>
                  MẬT KHẨU
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#c8ff47')}
                  onBlur={e => (e.target.style.borderColor = '#333')}
                />
              </div>

              {loginError && (
                <div style={{
                  background: 'rgba(255,71,71,0.1)',
                  border: '1px solid rgba(255,71,71,0.3)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: '#ff7070',
                  marginBottom: 16,
                }}>
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                style={{
                  width: '100%',
                  background: loginLoading ? '#555' : '#c8ff47',
                  color: '#0f0f0f',
                  border: 'none',
                  borderRadius: 8,
                  fontFamily: 'var(--font-display), sans-serif',
                  fontSize: 14,
                  fontWeight: 700,
                  padding: '12px',
                  cursor: loginLoading ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.05em',
                  transition: 'opacity 0.15s',
                }}
              >
                {loginLoading ? 'Đang đăng nhập...' : 'ĐĂNG NHẬP'}
              </button>

              <div style={{ marginTop: 20, fontSize: 12, color: '#555', textAlign: 'center' }}>
                <p>Liên hệ <a href="mailto:vannam.tran02@shopee.com" style={{ color: 'white' }}>vannam.tran02@shopee.com</a> để được hỗ trợ</p>
              </div>
            </form>
          )}

          {/* Register Form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} style={{ padding: 32 }}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6, letterSpacing: '0.04em' }}>
                  EMAIL
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="your.name@shopee.com"
                  required
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#c8ff47')}
                  onBlur={e => (e.target.style.borderColor = '#333')}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6, letterSpacing: '0.04em' }}>
                  MẬT KHẨU
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  required
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#c8ff47')}
                  onBlur={e => (e.target.style.borderColor = '#333')}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6, letterSpacing: '0.04em' }}>
                  XÁC NHẬN MẬT KHẨU
                </label>
                <input
                  type="password"
                  value={regConfirm}
                  onChange={e => setRegConfirm(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  required
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#c8ff47')}
                  onBlur={e => (e.target.style.borderColor = '#333')}
                />
              </div>

              {/* Role Selector */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 10, letterSpacing: '0.04em' }}>
                  QUYỀN TRUY CẬP
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {roles.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRegRole(r.value)}
                      style={{
                        background: regRole === r.value ? 'rgba(200,255,71,0.08)' : '#242424',
                        border: regRole === r.value ? '1.5px solid #c8ff47' : '1.5px solid #333',
                        borderRadius: 10,
                        padding: '12px 10px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: regRole === r.value ? '#c8ff47' : '#ccc',
                        fontFamily: 'var(--font-display), sans-serif',
                        letterSpacing: '0.04em',
                        marginBottom: 4,
                      }}>
                        {r.label}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: regRole === r.value ? 'rgba(200,255,71,0.6)' : '#555',
                        lineHeight: 1.4,
                      }}>
                        {r.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {regError && (
                <div style={{
                  background: 'rgba(255,71,71,0.1)',
                  border: '1px solid rgba(255,71,71,0.3)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: '#ff7070',
                  marginBottom: 16,
                }}>
                  {regError}
                </div>
              )}

              {regSuccess && (
                <div style={{
                  background: 'rgba(200,255,71,0.08)',
                  border: '1px solid rgba(200,255,71,0.3)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: '#c8ff47',
                  marginBottom: 16,
                }}>
                  {regSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={regLoading}
                style={{
                  width: '100%',
                  background: regLoading ? '#555' : '#c8ff47',
                  color: '#0f0f0f',
                  border: 'none',
                  borderRadius: 8,
                  fontFamily: 'var(--font-display), sans-serif',
                  fontSize: 14,
                  fontWeight: 700,
                  padding: '12px',
                  cursor: regLoading ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.05em',
                  transition: 'opacity 0.15s',
                }}
              >
                {regLoading ? 'Đang tạo tài khoản...' : 'TẠO TÀI KHOẢN'}
              </button>

              <div style={{ marginTop: 20, fontSize: 12, color: '#555', textAlign: 'center' }}>
                <p>Liên hệ <a href="mailto:vannam.tran02@shopee.com" style={{ color: 'white' }}>vannam.tran02@shopee.com</a> để được hỗ trợ</p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}