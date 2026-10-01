import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { colors } from '@/theme'
import { availableSections, GUIDE_BASICS, permissionGroupsFor } from '@/lib/guide'
import { useApp } from '@/store'
import { Card, Icon, Screen, Text } from '@/components/ui'

// Foydalanish yo'riqnomasi: foydalanuvchining haqiqiy ruxsatlariga qarab filtrlanadi (web'dagi GuideModal).
export default function GuideScreen() {
  const app = useApp()
  const [open, setOpen] = useState<string | null>(null)
  const sections = availableSections(app)
  const groups = permissionGroupsFor(app)

  return (
    <Screen title="Yo‘riqnoma" subtitle="Siz uchun mavjud bo‘limlar va ishlash tartibi" back>
      {sections.map((section) => {
        const expanded = open === section.id
        return (
          <Card key={section.id} padded={false}>
            <Pressable onPress={() => setOpen(expanded ? null : section.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
              <View style={{ flex: 1 }}>
                <Text variant="eyebrow" tone="brand">{section.eyebrow}</Text>
                <Text variant="subheading" style={{ marginTop: 2 }}>{section.title}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{section.short}</Text>
              </View>
              <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
            </Pressable>
            {expanded ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
                <Text>{section.purpose}</Text>
                <List title="Nima qilish mumkin" items={section.actions} />
                <List title="Qadamlar" items={section.steps} numbered />
                <List title="Maslahat" items={section.tips} />
              </View>
            ) : null}
          </Card>
        )
      })}
      {GUIDE_BASICS.map((block) => (
        <Card key={block.title}>
          <Text variant="subheading">{block.title}</Text>
          <View style={{ marginTop: 8, gap: 6 }}>{block.items.map((item) => <Bullet key={item} text={item} />)}</View>
        </Card>
      ))}
      <Card>
        <Text variant="subheading">Sizning ruxsatlaringiz</Text>
        {groups.map((group) => (
          <View key={group.group} style={{ marginTop: 10 }}>
            <Text variant="eyebrow" tone="muted">{group.group}</Text>
            {group.items.map((item) => (
              <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, opacity: item.granted ? 1 : 0.4 }}>
                <Icon name={item.granted ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={item.granted ? colors.success : colors.muted} />
                <Text variant="caption" style={{ flex: 1 }}>{item.label}</Text>
              </View>
            ))}
          </View>
        ))}
      </Card>
    </Screen>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text tone="brand">•</Text>
      <Text variant="caption" style={{ flex: 1, lineHeight: 17 }}>{text}</Text>
    </View>
  )
}
function List({ title, items, numbered }: { title: string; items: string[]; numbered?: boolean }) {
  if (!items?.length) return null
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" tone="muted">{title}</Text>
      {items.map((item, index) => (numbered
        ? <View key={item} style={{ flexDirection: 'row', gap: 8 }}><Text tone="brand" variant="label">{index + 1}.</Text><Text variant="caption" style={{ flex: 1, lineHeight: 17 }}>{item}</Text></View>
        : <Bullet key={item} text={item} />))}
    </View>
  )
}
