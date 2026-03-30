'use client'
import { useState } from 'react'
import { C, F } from '@/ui'
import { BlocksTab } from './BlocksTab'
import { ZonesTab } from './ZonesTab'
import { LocationsSubTab } from './LocationsSubTab'
import { StagingTab } from './StagingTab'

type SubTab = 'blocks' | 'zones' | 'locations' | 'staging'

const SUB_TABS: { key: SubTab; label: string; desc: string }[] = [
  { key: 'blocks',    label: 'Blocks',    desc: 'Khu vực lớn nhất' },
  { key: 'zones',     label: 'Zones',     desc: 'Phân vùng trong block' },
  { key: 'locations', label: 'Locations', desc: 'Vị trí cố định' },
  { key: 'staging',   label: 'Staging',   desc: 'Vị trí tạm thời' },
]

export function LocationsTab() {
  const [sub, setSub] = useState<SubTab>('blocks')

  return (
    <div>
      {/* Hierarchy breadcrumb */}
      <div style={{
        background: C.bgMuted, border: `1px solid ${C.borderMid}`,
        borderRadius: 10, padding: '10px 16px', marginBottom: 20,
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}>
        {['Block', 'Zone', 'Location / Staging'].map((label, i, arr) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: F.code, fontSize: 12, fontWeight: 600, color: C.text }}>{label}</span>
            {i < arr.length - 1 && <span style={{ color: C.textFaint, fontSize: 14 }}>›</span>}
          </span>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            style={{
              background: sub === t.key ? C.ink : C.bg,
              color: sub === t.key ? '#fff' : C.textMuted,
              border: `1px solid ${sub === t.key ? C.ink : C.borderMid}`,
              borderRadius: 8, padding: '8px 18px',
              fontFamily: F.body, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.14s',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
            }}
          >
            <span>{t.label}</span>
            <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>{t.desc}</span>
          </button>
        ))}
      </div>

      {sub === 'blocks'    && <BlocksTab />}
      {sub === 'zones'     && <ZonesTab />}
      {sub === 'locations' && <LocationsSubTab />}
      {sub === 'staging'   && <StagingTab />}
    </div>
  )
}