import { useMemo } from 'react'
import { useQuarryStore } from './quarry'
import { deriveView, type AppView } from './derive'

export { useQuarryStore }
export type { AppView }

// Barcha holat + hisoblangan qiymatlar (web'dagi `useQuarryStore()` bilan bir xil ko'rinish).
// Holat o'zgargandagina qayta hisoblanadi.
export function useApp(): AppView {
  const state = useQuarryStore()
  return useMemo(() => deriveView(state), [state])
}
