import { Ionicons } from '@expo/vector-icons'
import type { ComponentProps } from 'react'
import { colors } from '@/theme'

export type IconName = ComponentProps<typeof Ionicons>['name']
export function Icon({ name, size = 20, color = colors.ink }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />
}
