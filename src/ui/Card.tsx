import { C, F } from './tokens'

export function Card({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: `1px solid rgba(0,0,0,0.07)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}