import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Switch, TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native'
import { colors, radius } from '@/theme'
import { formatAmountInput } from '@/lib/format'
import { formatNational, PHONE_MAX_LENGTH } from '@/lib/phone'
import { Icon } from './Icon'
import { Sheet } from './Sheet'
import { Text } from './Typography'

type BaseProps = { label?: string; hint?: string; error?: string; optional?: boolean }

function FieldShell({ label, hint, error, optional, children }: BaseProps & { children: React.ReactNode }) {
  return (
    <View style={styles.shell}>
      {label ? (
        <Text variant="label" tone="muted" style={styles.label}>
          {label}{optional ? <Text variant="caption" tone="muted">  (ixtiyoriy)</Text> : null}
        </Text>
      ) : null}
      {children}
      {error ? <Text variant="caption" tone="danger" style={styles.below}>{error}</Text> : hint ? <Text variant="caption" tone="muted" style={styles.below}>{hint}</Text> : null}
    </View>
  )
}

export function TextField({ label, hint, error, optional, secure, style, ...rest }: BaseProps & TextInputProps & { secure?: boolean }) {
  const [hidden, setHidden] = useState(Boolean(secure))
  const [focused, setFocused] = useState(false)
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      <View style={[styles.input, focused && styles.focused, error ? styles.errored : null, rest.multiline && { alignItems: 'flex-start' }]}>
        <TextInput
          placeholderTextColor={colors.placeholder}
          {...rest}
          secureTextEntry={secure ? hidden : rest.secureTextEntry}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e) }}
          style={[styles.text, rest.multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }, style]}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={10} accessibilityLabel={hidden ? 'Parolni ko‘rsatish' : 'Parolni yashirish'}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </FieldShell>
  )
}

// Summa: har 3 xonada bo'shliq (1 500 000). `value` — formatlangan matn, `parseAmountInput` bilan raqamga aylanadi.
export function AmountField({ label, hint, error, value, onChangeText, suffix = 'so‘m', placeholder = '0', optional, allowNegative }: BaseProps & {
  value: string; onChangeText: (value: string) => void; suffix?: string; placeholder?: string; allowNegative?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      <View style={[styles.input, focused && styles.focused, error ? styles.errored : null]}>
        <TextInput
          value={value}
          onChangeText={(text) => {
            const formatted = formatAmountInput(text)
            onChangeText(allowNegative ? formatted : formatted.replace('-', ''))
          }}
          keyboardType={allowNegative ? 'numbers-and-punctuation' : 'number-pad'}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.text}
        />
        {suffix ? <Text variant="label" tone="muted">{suffix}</Text> : null}
      </View>
    </FieldShell>
  )
}

// Og'irlik / soat kabi o'nlik sonlar: vergul yoki nuqta qabul qilinadi.
export function DecimalField({ label, hint, error, value, onChangeText, suffix, optional, placeholder = '0' }: BaseProps & {
  value: string; onChangeText: (value: string) => void; suffix?: string; placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      <View style={[styles.input, focused && styles.focused, error ? styles.errored : null]}>
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(text.replace(',', '.').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
          keyboardType={'decimal-pad' as KeyboardTypeOptions}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.text}
        />
        {suffix ? <Text variant="label" tone="muted">{suffix}</Text> : null}
      </View>
    </FieldShell>
  )
}

// Telefon: +998 maydon chapida doimiy, ichida faqat milliy qism ("90 123 45 67").
export function PhoneField({ label = 'Telefon', hint, error, value, onChangeText, optional = true }: BaseProps & { value: string; onChangeText: (value: string) => void }) {
  const [focused, setFocused] = useState(false)
  return (
    <FieldShell label={label} hint={hint ?? '+998 avtomatik qo‘shiladi.'} error={error} optional={optional}>
      <View style={[styles.input, focused && styles.focused, error ? styles.errored : null]}>
        <Text variant="subheading" tone="muted" style={{ marginRight: 8 }}>+998</Text>
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(formatNational(text))}
          keyboardType="phone-pad"
          maxLength={PHONE_MAX_LENGTH + 4}
          placeholder="90 123 45 67"
          placeholderTextColor={colors.placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.text}
        />
      </View>
    </FieldShell>
  )
}

export type Option = { value: string; label: string; hint?: string }

export function SelectField({ label, hint, error, optional, value, options, onChange, placeholder = 'Tanlang', emptyLabel, searchable, title }: BaseProps & {
  value: string
  options: Option[]
  onChange: (value: string) => void
  placeholder?: string
  emptyLabel?: string // berilsa, ro'yxat boshiga "tanlanmagan" qatori qo'shiladi
  searchable?: boolean
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find((option) => option.value === value)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((option) => `${option.label} ${option.hint ?? ''}`.toLowerCase().includes(q)) : options
  }, [options, query])
  const rows = emptyLabel ? [{ value: '', label: emptyLabel }, ...filtered] : filtered
  const close = () => { setOpen(false); setQuery('') }
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      <Pressable onPress={() => setOpen(true)} style={[styles.input, error ? styles.errored : null]} accessibilityRole="button">
        <Text style={[styles.text, { paddingVertical: 14 }, !selected && { color: colors.placeholder }]} numberOfLines={1}>
          {selected ? selected.label : value === '' && emptyLabel ? emptyLabel : placeholder}
        </Text>
        <Icon name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Sheet visible={open} onClose={close} title={title ?? label ?? 'Tanlang'} scroll={false} tall={options.length > 7}>
        {searchable || options.length > 8 ? (
          <View style={[styles.input, { marginBottom: 10 }]}>
            <Icon name="search" size={18} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Qidirish…" placeholderTextColor={colors.placeholder} style={[styles.text, { marginLeft: 8 }]} autoCorrect={false} />
          </View>
        ) : null}
        <FlatList
          data={rows}
          keyExtractor={(item) => item.value || '__empty'}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 460 }}
          ListEmptyComponent={<Text tone="muted" center style={{ padding: 24 }}>Hech narsa topilmadi.</Text>}
          renderItem={({ item }) => {
            const active = item.value === value
            return (
              <Pressable onPress={() => { onChange(item.value); close() }} style={[styles.option, active && { backgroundColor: colors.mint }]}>
                <View style={{ flex: 1 }}>
                  <Text variant="subheading" tone={active ? 'brand' : 'ink'} numberOfLines={1}>{item.label}</Text>
                  {'hint' in item && item.hint ? <Text variant="caption" tone="muted" numberOfLines={1}>{item.hint}</Text> : null}
                </View>
                {active ? <Icon name="checkmark-circle" size={20} color={colors.forest} /> : null}
              </Pressable>
            )
          }}
        />
      </Sheet>
    </FieldShell>
  )
}

export function Segmented<T extends string>({ label, value, options, onChange, disabled }: {
  label?: string; value: T; options: { value: T; label: string; icon?: React.ComponentProps<typeof Icon>['name'] }[]; onChange: (value: T) => void; disabled?: boolean
}) {
  return (
    <FieldShell label={label}>
      <View style={styles.segment}>
        {options.map((option) => {
          const active = option.value === value
          return (
            <Pressable key={option.value} disabled={disabled} onPress={() => onChange(option.value)}
              style={[styles.segmentItem, active && styles.segmentActive, disabled && { opacity: 0.6 }]} accessibilityRole="button" accessibilityState={{ selected: active }}>
              {option.icon ? <Icon name={option.icon} size={16} color={active ? colors.forest : colors.muted} /> : null}
              <Text variant="label" tone={active ? 'brand' : 'muted'}>{option.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </FieldShell>
  )
}

export function SwitchRow({ title, description, value, onValueChange, disabled, icon }: {
  title: string; description?: string; value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean; icon?: React.ComponentProps<typeof Icon>['name']
}) {
  return (
    <View style={styles.switchRow}>
      {icon ? <View style={styles.switchIcon}><Icon name={icon} size={20} color={colors.forest} /></View> : null}
      <View style={{ flex: 1 }}>
        <Text variant="subheading">{title}</Text>
        {description ? <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{description}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ true: colors.leaf, false: colors.line }} thumbColor="#fff" />
    </View>
  )
}

const styles = StyleSheet.create({
  shell: { marginBottom: 14 },
  label: { marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  below: { marginTop: 5 },
  input: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 50 },
  focused: { borderColor: colors.leaf, backgroundColor: '#FAFCFF' },
  errored: { borderColor: colors.danger },
  text: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 12 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12, borderRadius: radius.md },
  segment: { flexDirection: 'row', backgroundColor: colors.canvas, borderRadius: radius.md, padding: 4, gap: 4 },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.sm },
  segmentActive: { backgroundColor: '#fff', shadowColor: '#102A54', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  switchIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
})
