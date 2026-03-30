'use client'

const F = { code: "var(--font-code, 'Fira Code', monospace)" }

const AGING_STYLE: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  green:  { bg: '#f0fdf4', border: 'rgba(22,163,74,0.25)',  text: '#15803d', dot: '#16a34a', label: 'Fresh'    },
  yellow: { bg: '#fefce8', border: 'rgba(202,138,4,0.25)',  text: '#a16207', dot: '#ca8a04', label: 'Warning'  },
  orange: { bg: '#fff7ed', border: 'rgba(234,88,12,0.25)',  text: '#c2410c', dot: '#ea580c', label: 'Aging'    },
  red:    { bg: '#fef2f2', border: 'rgba(220,38,38,0.25)',  text: '#b91c1c', dot: '#dc2626', label: 'Critical' },
}

export interface LocationCardRow {
  aging_level:    string | null
  pallet_id:      string
  scanned_boxes:  number
  leadtime_hours: number | null
}

function worstAging(rows: LocationCardRow[]): string | null {
  const order = ['red', 'orange', 'yellow', 'green']
  return rows.reduce<string | null>((worst, r) => {
    if (!r.aging_level) return worst
    if (!worst) return r.aging_level
    return order.indexOf(r.aging_level) < order.indexOf(worst) ? r.aging_level : worst
  }, null)
}

export function LocationCard({
  locationCode,
  rows,
  doneCount,
  onClick,
}: {
  locationCode: string
  rows: LocationCardRow[]
  doneCount?: number
  onClick: () => void
}) {
  const occupied   = rows.length > 0
  const wa         = worstAging(rows)
  const ag         = wa ? AGING_STYLE[wa] : null
  const totalBoxes = rows.reduce((s, r) => s + (r.scanned_boxes ?? 0), 0)
  const uniquePallets = [...new Set(rows.map(r => r.pallet_id))].length

  return (
    <button
      onClick={() => occupied && onClick()}
      style={{
        position: 'relative',
        background: occupied ? (ag?.bg ?? '#f0fdf4') : '#f9f8f5',
        border: `1.5px solid ${occupied ? (ag?.border ?? 'rgba(0,0,0,0.08)') : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 10, padding: '10px 12px',
        cursor: occupied ? 'pointer' : 'default',
        textAlign: 'left', transition: 'all 0.12s', width: '100%',
      }}
    >
      {/* Done badge */}
      {doneCount != null && doneCount > 0 && (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          background: '#e8f5ee', color: '#1d6a3e',
          border: '1px solid rgba(29,106,62,0.25)',
          borderRadius: 100, padding: '1px 6px',
          fontSize: 9, fontWeight: 700, fontFamily: F.code,
        }}>
          {doneCount} done
        </span>
      )}

      {/* Location code */}
      <div style={{
        fontFamily: F.code, fontSize: 12, fontWeight: 700,
        color: occupied ? '#1a1916' : '#c8c7c0', marginBottom: 5,
        paddingRight: doneCount && doneCount > 0 ? 36 : 0,
      }}>
        {locationCode}
      </div>

      {occupied ? (
        <>
          <div style={{ fontSize: 11, color: '#6b6a64', marginBottom: 3 }}>
            {uniquePallets}p · {totalBoxes}b
          </div>
          {ag && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: ag.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: ag.text, fontWeight: 600 }}>
                {ag.label}
                {rows[0]?.leadtime_hours != null && (
                  ` · ${rows[0].leadtime_hours >= 24
                    ? `${(rows[0].leadtime_hours / 24).toFixed(1)}d`
                    : `${rows[0].leadtime_hours}h`}`
                )}
              </span>
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 10, color: doneCount && doneCount > 0 ? '#1d6a3e' : '#d1cfc8' }}>
          {doneCount && doneCount > 0 ? 'cleared' : 'empty'}
        </div>
      )}
    </button>
  )
}