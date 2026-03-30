'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.endsWith('@shopee.com')) {
      setError('Chỉ chấp nhận email @shopee.com')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (err) {
      setError('Email hoặc mật khẩu không đúng')
      return
    }
    router.push('/')
    router.refresh()
  }

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

        {/* Form */}
        <form onSubmit={handleLogin} style={{
          background: '#1a1a1a',
          border: '1px solid #2e2e2e',
          borderRadius: 16,
          padding: 32,
        }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6, letterSpacing: '0.04em' }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your.name@shopee.com"
              required
              style={{
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
              }}
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
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
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
              }}
              onFocus={e => (e.target.style.borderColor = '#c8ff47')}
              onBlur={e => (e.target.style.borderColor = '#333')}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,71,71,0.1)',
              border: '1px solid rgba(255,71,71,0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#ff7070',
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#555' : '#c8ff47',
              color: '#0f0f0f',
              border: 'none',
              borderRadius: 8,
              fontFamily: 'var(--font-display), sans-serif',
              fontSize: 14,
              fontWeight: 700,
              padding: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.05em',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Đang đăng nhập...' : 'ĐĂNG NHẬP'}
          </button>

          <div style={{ marginTop: 20, fontSize: 12, color: '#555', textAlign: 'center' }}>
            Chỉ dành cho nhân viên Shopee · @shopee.com
          </div>
        </form>
      </div>
    </div>
  )
}