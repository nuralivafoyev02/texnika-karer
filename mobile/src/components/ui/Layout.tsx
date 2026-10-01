import { useCallback, useState, type ReactNode } from 'react'
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View, type FlatListProps, type StyleProp, type ViewStyle } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, shadow } from '@/theme'
import { initials } from '@/lib/format'
import { useQuarryStore } from '@/store'
import { IconButton } from './Button'
import { Icon, type IconName } from './Icon'
import { Text } from './Typography'

// ── Ekran ramkasi: sarlavha + xavfsiz hudud + pull-to-refresh ───────────────────
type FrameProps = {
  title: string
  subtitle?: string
  back?: boolean
  right?: ReactNode
  // Pastki tab bar bor ekranlarda pastki xavfsiz hudud kerak emas.
  tabbed?: boolean
}

function Header({ title, subtitle, back, right }: FrameProps) {
  const router = useRouter()
  return (
    <View style={styles.header}>
      {back ? <IconButton icon="chevron-back" label="Orqaga" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} bg="#fff" color={colors.ink} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant="title" numberOfLines={1} style={{ fontSize: back ? 22 : 26 }}>{title}</Text>
        {subtitle ? <Text variant="caption" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  )
}

function useRefresh() {
  const refresh = useQuarryStore((s) => s.refresh)
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try { await refresh() } finally { setRefreshing(false) }
  }, [refresh])
  return { refreshing, onRefresh }
}

export function Screen({ children, scroll = true, footer, ...frame }: FrameProps & { children: ReactNode; scroll?: boolean; footer?: ReactNode }) {
  const insets = useSafeAreaInsets()
  const { refreshing, onRefresh } = useRefresh()
  const bottom = frame.tabbed ? 16 : Math.max(insets.bottom, 16)
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header {...frame} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottom + (footer ? 0 : 8), gap: 14 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.forest} />}
        >
          {children}
        </ScrollView>
      ) : <View style={{ flex: 1, paddingHorizontal: 16 }}>{children}</View>}
      {footer ? <View style={[styles.footer, { paddingBottom: bottom }]}>{footer}</View> : null}
    </View>
  )
}

// Uzun ro'yxatlar uchun (reyslar, kvitansiyalar…): FlatList virtualizatsiyasi.
export function ListScreen<T>({ header, ...props }: FrameProps & Omit<FlatListProps<T>, 'ListHeaderComponent'> & { header?: ReactNode }) {
  const insets = useSafeAreaInsets()
  const { refreshing, onRefresh } = useRefresh()
  const { title, subtitle, back, right, tabbed, ...listProps } = props
  const bottom = tabbed ? 16 : Math.max(insets.bottom, 16)
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header title={title} subtitle={subtitle} back={back} right={right} />
      <FlatList
        {...listProps}
        ListHeaderComponent={header ? <View style={{ gap: 12, marginBottom: 12 }}>{header}</View> : null}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottom + 8, gap: 10 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.forest} />}
        initialNumToRender={12}
        windowSize={9}
      />
    </View>
  )
}

// ── Kartalar va bloklar ──────────────────────────────────────────────────────────
export function Card({ children, style, onPress, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean }) {
  const body = [styles.card, padded && { padding: 14 }, style]
  if (onPress) {
    return <Pressable onPress={onPress} style={({ pressed }) => [body, pressed && { opacity: 0.88 }]} accessibilityRole="button">{children}</Pressable>
  }
  return <View style={body}>{children}</View>
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitle}>
      <Text variant="subheading">{title}</Text>
      {action ? <Pressable onPress={onAction} hitSlop={8}><Text variant="label" tone="brand">{action}</Text></Pressable> : null}
    </View>
  )
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>{children}</View>
}

type Tone = 'warn' | 'leaf' | 'cash' | 'credit' | 'blue' | 'danger' | 'muted' | 'service' | 'repair'
const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  warn: { bg: '#FFF2D9', fg: '#96621D' },
  leaf: { bg: '#E4F6EC', fg: '#0F7A4D' },
  cash: { bg: '#E6F1FF', fg: '#1565D8' },
  credit: { bg: '#FFF4DF', fg: '#956320' },
  blue: { bg: '#EDF4FA', fg: '#496F93' },
  danger: { bg: '#FFF0EE', fg: '#C04E48' },
  muted: { bg: '#EFF2F7', fg: '#56667E' },
  service: { bg: '#FFF5E8', fg: '#B67825' },
  repair: { bg: '#FFF0EE', fg: '#C04E48' },
}
export function Tag({ label, tone = 'blue', dot }: { label: string; tone?: Tone; dot?: boolean }) {
  const t = toneStyles[tone]
  return (
    <View style={[styles.tag, { backgroundColor: t.bg, borderRadius: dot ? radius.full : 8 }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: t.fg }]} /> : null}
      <Text variant="caption" style={{ color: t.fg, fontWeight: '700', fontSize: 10.5 }}>{label}</Text>
    </View>
  )
}

export function Avatar({ name, uri, size = 40, tone = 'brand' }: { name: string; uri?: string; size?: number; tone?: 'brand' | 'grey' | 'amber' }) {
  const bg = tone === 'grey' ? '#EFF2F7' : tone === 'amber' ? '#FFF4E3' : colors.mint
  const fg = tone === 'grey' ? '#56667E' : tone === 'amber' ? '#AA7021' : colors.forest
  const [failed, setFailed] = useState(false)
  if (uri && !failed) {
    return <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: bg }} />
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontWeight: '800', fontSize: size * 0.34 }}>{initials(name)}</Text>
    </View>
  )
}

export function IconBadge({ name, tone = 'brand', size = 40 }: { name: IconName; tone?: 'brand' | 'amber' | 'green' | 'violet' | 'danger' | 'grey'; size?: number }) {
  const map = {
    brand: ['#E6F1FF', colors.forest], amber: ['#FFF4E3', '#B77824'], green: ['#E4F6EC', '#0F7A4D'],
    violet: ['#F1ECFF', '#6B4FD6'], danger: ['#FFF0EE', colors.danger], grey: ['#EFF2F7', '#56667E'],
  } as const
  const [bg, fg] = map[tone]
  return (
    <View style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size * 0.5} color={fg} />
    </View>
  )
}

export function MetricCard({ label, value, detail, icon, tone = 'brand' }: { label: string; value: string; detail?: string; icon: IconName; tone?: 'brand' | 'amber' | 'green' | 'violet' }) {
  return (
    <View style={[styles.card, { padding: 14, flex: 1, minWidth: '47%' }]}>
      <IconBadge name={icon} tone={tone} size={34} />
      <Text variant="caption" tone="muted" style={{ marginTop: 10 }} numberOfLines={1}>{label}</Text>
      <Text variant="heading" style={{ marginTop: 2, fontSize: 19 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {detail ? <Text variant="caption" tone="muted" style={{ marginTop: 2 }} numberOfLines={2}>{detail}</Text> : null}
    </View>
  )
}

export function Banner({ icon = 'alert-circle', title, text, tone = 'amber', onPress }: { icon?: IconName; title: string; text?: string; tone?: 'amber' | 'danger' | 'info'; onPress?: () => void }) {
  const palette = tone === 'danger' ? { bg: colors.dangerBg, line: '#F3CFCF', fg: colors.danger, text: '#8A2E2E' }
    : tone === 'info' ? { bg: colors.mint, line: '#CFE4FF', fg: colors.forest, text: colors.forest }
    : { bg: colors.amberBg, line: colors.amberLine, fg: colors.amber, text: colors.amberText }
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.line }]}>
      <Icon name={icon} size={20} color={palette.fg} />
      <View style={{ flex: 1 }}>
        <Text variant="label" style={{ color: palette.text }}>{title}</Text>
        {text ? <Text variant="caption" style={{ color: palette.text, marginTop: 2, opacity: 0.85 }} numberOfLines={2}>{text}</Text> : null}
      </View>
      {onPress ? <Icon name="chevron-forward" size={18} color={palette.fg} /> : null}
    </Pressable>
  )
}

export function EmptyState({ icon = 'file-tray-outline', title, text }: { icon?: IconName; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <IconBadge name={icon} tone="grey" size={52} />
      <Text variant="subheading" style={{ marginTop: 12 }} center>{title}</Text>
      {text ? <Text variant="caption" tone="muted" center style={{ marginTop: 4, maxWidth: 280 }}>{text}</Text> : null}
    </View>
  )
}

export function SearchBar({ value, onChangeText, placeholder = 'Qidirish…' }: { value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return (
    <View style={styles.search}>
      <Icon name="search" size={18} color={colors.muted} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.placeholder} style={styles.searchInput}
        autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
      {value ? <Pressable onPress={() => onChangeText('')} hitSlop={10}><Icon name="close-circle" size={18} color={colors.placeholder} /></Pressable> : null}
    </View>
  )
}

export function FilterChips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (value: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.chip, active && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
            <Text variant="label" style={{ color: active ? '#fff' : colors.muted }}>{option.label}{option.count !== undefined ? `  ${option.count}` : ''}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

// Ma'lumot qatorlari (web'dagi PreviewSection / TripPreviewModal tafsilotlari uchun).
export function DetailRow({ label, value, sub, tag, tagTone }: { label: string; value?: string | null; sub?: string; tag?: string; tagTone?: Tone }) {
  if (!value && !tag) return null
  return (
    <View style={styles.detailRow}>
      <Text variant="caption" tone="muted" style={{ width: 104 }}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {tag ? <Tag label={tag} tone={tagTone} /> : <Text variant="label" style={{ textAlign: 'right' }}>{value}</Text>}
        {sub ? <Text variant="caption" tone="muted" style={{ textAlign: 'right', marginTop: 2 }}>{sub}</Text> : null}
      </View>
    </View>
  )
}

export function Divider() { return <View style={{ height: 1, backgroundColor: colors.line }} /> }

export function ListItem({ icon, title, subtitle, right, onPress, danger, badge }: { icon: IconName; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; danger?: boolean; badge?: number }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listItem, pressed && { backgroundColor: colors.canvas }]} accessibilityRole="button">
      <IconBadge name={icon} tone={danger ? 'danger' : 'brand'} size={38} />
      <View style={{ flex: 1 }}>
        <Text variant="subheading" tone={danger ? 'danger' : 'ink'}>{title}</Text>
        {subtitle ? <Text variant="caption" tone="muted" style={{ marginTop: 1 }} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {badge ? <View style={styles.badge}><Text variant="caption" style={{ color: '#fff', fontWeight: '800' }}>{badge}</Text></View> : null}
      {right ?? (onPress ? <Icon name="chevron-forward" size={18} color={colors.placeholder} /> : null)}
    </Pressable>
  )
}

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height, width, borderRadius: 8, backgroundColor: '#E9EEF5' }, style]} />
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line, gap: 8 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, ...shadow.soft },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12 },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, minHeight: 46 },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  chipActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F2F0' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
})
