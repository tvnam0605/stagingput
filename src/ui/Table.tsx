import { C } from './tokens'

export function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ background: C.bgPage }}>
        {cols.map(h => (
          <th
            key={h}
            style={{
              textAlign: 'left',
              fontSize: 11,
              fontWeight: 600,
              color: C.textFaint,
              padding: '10px 16px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  )
}

export function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return (
    <tr>
      <td
        colSpan={cols}
        style={{ textAlign: 'center', padding: 32, color: C.textFaint, fontSize: 13 }}
      >
        {msg}
      </td>
    </tr>
  )
}

export function HoverRow({ children }: { children: React.ReactNode }) {
  return (
    <tr
      style={{ borderBottom: `1px solid ${C.borderLight}` }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f9f9f7')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </tr>
  )
}