import { View } from 'react-native'
import { colors } from '@/theme'

// Web'dagi `brand-mark`: uchta ustun.
export function BrandMark({ size = 44, light = true }: { size?: number; light?: boolean }) {
  const bar = (h: number, o: number) => (
    <View style={{ width: size * 0.17, height: size * h, borderRadius: size * 0.06, backgroundColor: light ? '#fff' : colors.forest, opacity: o }} />
  )
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: light ? colors.leaf : colors.mint, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: size * 0.08, paddingBottom: size * 0.22 }}>
      {bar(0.28, 0.75)}{bar(0.46, 1)}{bar(0.36, 0.85)}
    </View>
  )
}
