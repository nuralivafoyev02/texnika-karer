import { useEffect, useState } from 'react'
import { useQuarryStore } from '@/store'

// Profil rasmi signed URL orqali beriladi (1 soat amal qiladi) — kerak bo'lganda yangilanadi.
export function useAvatar(userId?: string): string {
  const user = useQuarryStore((s) => s.users.find((item) => item.id === userId))
  const ensure = useQuarryStore((s) => s.ensureAvatarUrl)
  const [url, setUrl] = useState(user?.avatarUrl ?? '')
  const path = user?.avatarPath
  useEffect(() => {
    let alive = true
    if (!user || !path) { setUrl(''); return }
    ensure(user).then((next) => { if (alive) setUrl(next) }).catch(() => { if (alive) setUrl('') })
    return () => { alive = false }
  }, [user?.id, path]) // eslint-disable-line react-hooks/exhaustive-deps
  return url
}
