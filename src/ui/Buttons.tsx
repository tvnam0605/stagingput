import { C, F } from './tokens'

export function PrimaryBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        background: disabled ? '#ccc' : C.ink,
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        fontFamily: F.display,
        fontSize: 14,
        fontWeight: 700,
        padding: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export function ActionBtn({
  onClick,
  color,
  children,
}: {
  onClick: () => void
  color: { bg: string; text: string }
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: color.bg,
        color: color.text,
        border: 'none',
        borderRadius: 6,
        fontSize: 12,
        padding: '5px 10px',
        cursor: 'pointer',
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  )
}

export function RefreshBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#f0efe9',
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: 6,
        fontSize: 12,
        padding: '5px 12px',
        cursor: 'pointer',
        color: '#6b6a64',
      }}
    >
      ↻ Làm mới
    </button>
  )
}