'use client'
import { useState } from 'react'
import { F, C } from '@/ui'

import { LocationsTab } from './admin/location/LocationsTab'
import { AccountsTab } from './admin/accounts/AccountTab'
// =======================================================

type AdminTab = 'accounts' | 'locations'

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'accounts',  label: 'Tài khoản' },
  { key: 'locations', label: 'Locations' },
]

export function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>('accounts')

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Admin</h1>
        <p style={{ fontSize: 13, color: C.textMuted }}>Quản lý hệ thống — chỉ admin mới thấy trang này</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: tab === t.key ? C.ink : C.bg,
              color: tab === t.key ? '#fff' : C.textMuted,
              border: `1px solid ${tab === t.key ? C.ink : C.borderMid}`,
              borderRadius: 8, padding: '8px 20px',
              fontFamily: F.body, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.14s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accounts'  && <AccountsTab />}
      {tab === 'locations' && <LocationsTab />}
    </div>
  )
}