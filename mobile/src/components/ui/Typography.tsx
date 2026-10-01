import { Text as RNText, type TextProps, type TextStyle } from 'react-native'
import { colors } from '@/theme'

type Variant = 'title' | 'heading' | 'subheading' | 'body' | 'label' | 'caption' | 'eyebrow'
type Tone = 'ink' | 'muted' | 'brand' | 'danger' | 'success' | 'amber' | 'white'

const variants: Record<Variant, TextStyle> = {
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, lineHeight: 32 },
  heading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  subheading: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  caption: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
}
const tones: Record<Tone, string> = {
  ink: colors.ink, muted: colors.muted, brand: colors.forest, danger: colors.danger,
  success: colors.success, amber: colors.amber, white: '#fff',
}

export type AppTextProps = TextProps & { variant?: Variant; tone?: Tone; bold?: boolean; center?: boolean }

export function Text({ variant = 'body', tone = 'ink', bold, center, style, ...rest }: AppTextProps) {
  return <RNText {...rest} style={[variants[variant], { color: tones[tone] }, bold && { fontWeight: '700' }, center && { textAlign: 'center' }, style]} />
}
