import { labelStyle } from './tokens'

export function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}