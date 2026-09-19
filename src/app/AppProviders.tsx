import { createContext, useContext, useState, type PropsWithChildren } from 'react'

interface AppContextValue {
  activeProfileId: string | null
  setActiveProfileId: (profileId: string | null) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProviders({ children }: PropsWithChildren) {
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  return (
    <AppContext.Provider value={{ activeProfileId, setActiveProfileId }}>
      {children}
    </AppContext.Provider>
  )
}

export function useActiveProfile() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useActiveProfile must be used within AppProviders')
  return context
}
