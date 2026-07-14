import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getProfiles, listRequests } from './lib/api'
import type { DecisionRequest, Profile } from './lib/types'

interface Store {
  profiles: Profile[]
  currentUser: Profile | null
  setCurrentUserId: (id: string) => void
  requests: DecisionRequest[]
  loading: boolean
  refresh: () => Promise<void>
}

const StoreCtx = createContext<Store | null>(null)

const CURRENT_USER_KEY = 'ceodesk_current_user'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserIdState] = useState<string | null>(
    () => localStorage.getItem(CURRENT_USER_KEY),
  )
  const [requests, setRequests] = useState<DecisionRequest[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const rows = await listRequests()
    setRequests(rows)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [p, r] = await Promise.all([getProfiles(), listRequests()])
        if (!active) return
        setProfiles(p)
        setRequests(r)
        setCurrentUserIdState((prev) => {
          const valid = prev && p.some((x) => x.id === prev)
          return valid ? prev : p.find((x) => x.role === 'ceo')?.id ?? p[0]?.id ?? null
        })
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const setCurrentUserId = useCallback((id: string) => {
    localStorage.setItem(CURRENT_USER_KEY, id)
    setCurrentUserIdState(id)
  }, [])

  const currentUser = useMemo(
    () => profiles.find((p) => p.id === currentUserId) ?? null,
    [profiles, currentUserId],
  )

  const value: Store = {
    profiles,
    currentUser,
    setCurrentUserId,
    requests,
    loading,
    refresh,
  }

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore fuera de StoreProvider')
  return ctx
}
