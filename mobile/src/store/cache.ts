import AsyncStorage from '@react-native-async-storage/async-storage'

// Remote ma'lumotlarning tezkor nusxasi: ilova ochilganda to'liq yuklashni kutmasdan,
// keshdan darhol ko'rsatamiz, yangi ma'lumot fonda keladi. Internet bo'lmasa ham
// oxirgi holat ko'rinib turadi.
const PREFIX = 'qazilma-erp-mobile-v1:'
const MAX_AGE = 14 * 24 * 60 * 60 * 1000 // 14 kundan eski nusxa ishlatilmaydi
export const CACHE_FIELDS = ['users', 'roles', 'clients', 'materials', 'vehicles', 'trips', 'transactions', 'maintenanceReports', 'categories'] as const

export type Snapshot = {
  version: 1
  savedAt: number
  remoteClientBalances: Record<string, number>
  remoteFinancialBalances: { cash: number | null; bank: number | null }
  permissionKeys: string[]
} & Record<(typeof CACHE_FIELDS)[number], any[]>

export async function readCache(userId: string): Promise<Snapshot | null> {
  if (!userId) return null
  try {
    const snapshot = JSON.parse((await AsyncStorage.getItem(PREFIX + userId)) || 'null')
    if (snapshot?.version !== 1 || !Array.isArray(snapshot.users) || !Array.isArray(snapshot.roles)) return null
    if (Date.now() - Number(snapshot.savedAt || 0) > MAX_AGE) return null
    return snapshot as Snapshot
  } catch {
    return null
  }
}

export async function writeCache(userId: string, snapshot: Snapshot): Promise<void> {
  if (!userId) return
  try { await AsyncStorage.setItem(PREFIX + userId, JSON.stringify(snapshot)) } catch { /* kesh bo'lmasa ham ishlayveramiz */ }
}

export async function clearCache(userId?: string): Promise<void> {
  if (!userId) return
  try { await AsyncStorage.removeItem(PREFIX + userId) } catch { /* e'tiborsiz */ }
}
