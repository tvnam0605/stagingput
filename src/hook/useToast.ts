'use client'

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Block, Zone } from '@/lib/types'

export function useBlocksAndZones() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(false)

  const fetchBlocks = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('blocks')
      .select('*')
      .eq('is_active', true)
      .order('code')

    if (error) console.error('Error fetching blocks:', error)
    else setBlocks((data as Block[]) ?? [])

    setLoading(false)
  }, [])

  const fetchZones = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('zones')
      .select('*, block:blocks(*)')
      .eq('is_active', true)
      .order('code')

    if (error) console.error('Error fetching zones:', error)
    else setZones((data as Zone[]) ?? [])

    setLoading(false)
  }, [])

  // Hàm lọc zones theo block_id (dùng trong form)
  const filteredZones = useCallback((blockId: string) => {
    if (blockId === 'all') return zones
    return zones.filter(z => z.block_id === blockId)
  }, [zones])

  // Load dữ liệu khi hook được mount
  useEffect(() => {
    fetchBlocks()
    fetchZones()
  }, [fetchBlocks, fetchZones])

  return {
    blocks,
    zones,
    loading,
    fetchBlocks,
    fetchZones,
    filteredZones,
  }
}