import { C, F } from './tokens'

export function Badge({
  label,
  color,
}: {
  label: string
  color: { bg: string; text: string; border?: string }
}) {
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      padding: '3px 9px',
      borderRadius: 20,
      background: color.bg,
      color: color.text,
      border: `1px solid ${color.border ?? 'transparent'}`,
    }}>
      {label}
    </span>
  )
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      label={active ? 'Active' : 'Inactive'}
      color={active ? C.green : C.red}
    />
  )
}

/** Hiển thị Block › Zone dạng breadcrumb */
export function PathBadge({ parts }: { parts: (string | undefined | null)[] }) {
  const valid = parts.filter(Boolean) as string[]
  if (!valid.length) return <span style={{ color: C.textFaint, fontSize: 12 }}>—</span>
  return (
    <span style={{ fontFamily: F.code, fontSize: 11, color: C.textMuted }}>
      {valid.join(' › ')}
    </span>
  )
}

/** Pill nhỏ dùng cho mã code (zone, block...) */
export function CodePill({ code }: { code: string | null | undefined }) {
  if (!code) return <span style={{ color: C.textFaint, fontSize: 12 }}>—</span>
  return (
    <span style={{
      background: C.bgMuted,
      border: `1px solid ${C.borderMid}`,
      borderRadius: 6,
      fontFamily: F.code,
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 8px',
      color: C.text,
    }}>
      {code}
    </span>
  )
}