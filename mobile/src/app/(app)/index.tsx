import { Redirect } from 'expo-router'
import { useApp } from '@/store'

export default function Index() {
  const app = useApp()
  return <Redirect href={app.homeRoute() as any} />
}
