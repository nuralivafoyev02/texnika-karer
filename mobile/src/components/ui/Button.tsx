import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors, radius } from '@/theme'
import { Icon, type IconName } from './Icon'
import { Text } from './Typography'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'success'
type Props = {
  title: string
  onPress?: () => void
  variant?: Variant
  icon?: IconName
  loading?: boolean
  disabled?: boolean
  small?: boolean
  full?: boolean
  style?: StyleProp<ViewStyle>
}

const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.forest, fg: '#fff', border: colors.forest },
  secondary: { bg: '#fff', fg: colors.forest, border: colors.line },
  quiet: { bg: colors.mint, fg: colors.forest, border: colors.mint },
  danger: { bg: colors.danger, fg: '#fff', border: colors.danger },
  success: { bg: colors.success, fg: '#fff', border: colors.success },
}

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, small, full = true, style }: Props) {
  const p = palette[variant]
  const inactive = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      onPress={() => { void Haptics.selectionAsync().catch(() => {}); onPress?.() }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: p.bg, borderColor: p.border, paddingVertical: small ? 9 : 14, paddingHorizontal: small ? 14 : 18, opacity: inactive ? 0.55 : pressed ? 0.85 : 1 },
        !full && { alignSelf: 'flex-start' },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={p.fg} size="small" /> : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={small ? 16 : 18} color={p.fg} /> : null}
          <Text variant={small ? 'label' : 'subheading'} style={{ color: p.fg }}>{title}</Text>
        </View>
      )}
    </Pressable>
  )
}

export function IconButton({ icon, onPress, color = colors.forest, bg = colors.mint, size = 40, label }: {
  icon: IconName; onPress?: () => void; color?: string; bg?: string; size?: number; label: string
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={color} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
