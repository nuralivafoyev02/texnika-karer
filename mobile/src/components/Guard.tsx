import { Redirect } from 'expo-router'
import { useApp } from '@/store'

// Ruxsati yo'q foydalanuvchi to'g'ridan-to'g'ri havola orqali ham bo'limga kira olmasin
// (web'dagi router.beforeEach ning o'rni).
export function Guard({ permission, any, children }: { permission?: string; any?: string[]; children: React.ReactNode }) {
  const app = useApp()
  const allowed = permission ? app.can(permission) : any ? any.some((key) => app.can(key)) : true
  if (!allowed) return <Redirect href={app.homeRoute() as any} />
  return <>{children}</>
}
