// ─── Auth / Profiles ──────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'receiver' | 'mover'

export type Profile = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Location hierarchy ───────────────────────────────────────────────────────
export type Block = {
  id: string
  code: string
  name: string | null
  description: string | null
  is_active: boolean
  created_at: string
}

export type Zone = {
  id: string
  block_id: string
  code: string
  name: string | null
  description: string | null
  is_active: boolean
  created_at: string
  // joined
  block?: Block
}

export type Location = {
  id: string
  zone_id: string
  code: string
  description: string | null
  is_active: boolean
  created_at: string
  // joined
  zone?: Zone & { block?: Block }
}

export type LocationStaging = {
  id: string
  zone_id: string
  code: string
  description: string | null
  is_active: boolean
  created_at: string
  // joined
  zone?: Zone & { block?: Block }
}

// ─── Warehouse entities ───────────────────────────────────────────────────────
export type PalletStatus = 'pending' | 'ongoing' | 'received' | 'done' | 'staged'

export type Pallet = {
  boxes: Box[]
  id: string
  code: string
  prefix: string
  date_str: string
  seq: number
  status: PalletStatus
  note: string | null
  created_by: string
  done_by: string | null
  location_id: string | null
  staging_location_id: string | null
  moved_by: string | null
  created_at: string
  done_at: string | null
  moved_at: string | null
}

export type Box = {
  id: string
  box_code: string
  pallet_id: string
  scanned_by: string
  scanned_at: string
  location_id: string | null
  staging_location_id: string | null
  moved_at: string | null
}

export type ActivityLog = {
  id: string
  event_type: string
  pallet_id: string | null
  pallet_code: string | null
  box_code: string | null
  location_code: string | null
  user_id: string
  user_email: string
  meta: Record<string, unknown>
  created_at: string
}
