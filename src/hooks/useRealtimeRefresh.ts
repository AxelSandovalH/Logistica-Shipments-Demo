'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Subscribes to Supabase Realtime for a given table and calls `onRefresh`
 * whenever any row is inserted, updated, or deleted.
 *
 * The callback is debounced 800ms to batch rapid consecutive changes.
 */
export function useRealtimeRefresh(
  table: string,
  onRefresh: () => void,
  options?: { debounceMs?: number },
) {
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stableCallback = useRef(onRefresh)
  stableCallback.current = onRefresh

  useEffect(() => {
    const supabase = createClient()
    const debounceMs = options?.debounceMs ?? 800

    const channel = supabase
      .channel(`rt:${table}:${Math.random()}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        () => {
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => stableCallback.current(), debounceMs)
        },
      )
      .subscribe()

    return () => {
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [table])
}
