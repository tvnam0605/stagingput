export const F = {
  display: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
  body:    "var(--font-body, 'Inter', sans-serif)",
  code:    "var(--font-code, 'Fira Code', monospace)",
}

export const C = {
  bg:          '#fff',
  bgMuted:     '#f0efe9',
  bgPage:      '#f5f4f0',
  border:      'rgba(0,0,0,0.08)',
  borderLight: 'rgba(0,0,0,0.05)',
  borderMid:   'rgba(0,0,0,0.1)',
  text:        '#1a1916',
  textMuted:   '#6b6a64',
  textFaint:   '#a09e96',
  ink:         '#1a1916',
  green:  { bg: '#e8f5ee', text: '#1d6a3e', border: 'rgba(29,106,62,0.2)' },
  red:    { bg: '#fce8e8', text: '#8f1a1a', border: 'rgba(143,26,26,0.2)' },
  blue:   { bg: '#e8f0fb', text: '#0d4a8f' },
  amber:  { bg: '#fef3d7', text: '#7a4a00' },
  purple: { bg: '#eeedfe', text: '#3C3489' },
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.bgMuted,
  border: `1px solid ${C.borderMid}`,
  borderRadius: 8,
  color: C.text,
  fontFamily: F.code,
  fontSize: 13,
  padding: '9px 12px',
  outline: 'none',
  boxSizing: 'border-box',
}

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: C.textMuted,
  marginBottom: 6,
}