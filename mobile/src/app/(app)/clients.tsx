import { useMemo, useState } from 'react'
import { Linking, View } from 'react-native'
import { colors, radius } from '@/theme'
import { money } from '@/lib/format'
import { phoneHref } from '@/lib/phone'
import { useApp } from '@/store'
import { Guard } from '@/components/Guard'
import { ClientSheet } from '@/components/forms/ClientSheet'
import { PaymentSheet } from '@/components/forms/PaymentSheet'
import { Avatar, Button, Card, EmptyState, ListScreen, SearchBar, Tag, Text } from '@/components/ui'

export default function ClientsScreen() {
  return <Guard permission="clients.view"><Clients /></Guard>
}

function Clients() {
  const app = useApp()
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [payClientId, setPayClientId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return app.clients.map((client) => ({ ...client, balance: app.clientBalance(client.id) }))
      .filter((client) => !q || `${client.name} ${client.contactName} ${client.phone}`.toLowerCase().includes(q))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
  }, [app.clients, app.remoteClientBalances, search]) // eslint-disable-line react-hooks/exhaustive-deps
  const totalDebt = app.clients.reduce((sum, client) => sum + Math.max(0, app.clientBalance(client.id)), 0)
  const totalAdvance = app.clients.reduce((sum, client) => sum + Math.max(0, -app.clientBalance(client.id)), 0)
  const canPay = app.can('finance.payments.create')

  return (
    <>
      <ListScreen
        title="Mijozlar"
        subtitle="Ro‘yxat, balans va to‘lovlar"
        back
        right={app.can('clients.manage') ? <Button title="Mijoz" icon="add" small full={false} onPress={() => setShowNew(true)} /> : undefined}
        data={rows}
        keyExtractor={(client) => client.id}
        ListEmptyComponent={<EmptyState icon="people-outline" title="Mijozlar topilmadi" text="Yangi mijoz qo‘shing yoki qidiruvni o‘zgartiring." />}
        renderItem={({ item: client }) => {
          const href = phoneHref(client.phone)
          return (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={client.name} size={42} tone={client.balance < 0 ? 'brand' : 'grey'} />
                <View style={{ flex: 1 }}>
                  <Text variant="subheading" numberOfLines={1}>{client.name}</Text>
                  {client.contactName ? <Text variant="caption" tone="muted" numberOfLines={1}>{client.contactName}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="heading" tone={client.balance > 0 ? 'danger' : client.balance < 0 ? 'success' : 'muted'}>{money(Math.abs(client.balance), { short: true })}</Text>
                  <Tag label={client.balance > 0 ? 'Qarzdor' : client.balance < 0 ? 'Avans' : 'Hisob teng'} tone={client.balance > 0 ? 'credit' : client.balance < 0 ? 'leaf' : 'muted'} />
                </View>
              </View>
              {href || canPay ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  {href ? <Button title={client.phone} icon="call-outline" variant="secondary" small onPress={() => void Linking.openURL(href)} style={{ flex: 1 }} /> : null}
                  {canPay ? <Button title="To‘lov" icon="cash-outline" variant="quiet" small onPress={() => setPayClientId(client.id)} style={{ flex: 1 }} /> : null}
                </View>
              ) : null}
            </Card>
          )
        }}
        header={(
          <>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Mijoz, mas’ul shaxs yoki telefon" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Total label="Jami qarz" value={money(totalDebt, { short: true })} tone={colors.danger} />
              <Total label="Jami avans" value={money(totalAdvance, { short: true })} tone={colors.success} />
              <Total label="Mijozlar" value={String(app.clients.length)} tone={colors.ink} />
            </View>
          </>
        )}
      />
      <ClientSheet visible={showNew} onClose={() => setShowNew(false)} />
      <PaymentSheet visible={payClientId !== null} onClose={() => setPayClientId(null)} initialClientId={payClientId ?? ''} />
    </>
  )
}

function Total({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 12 }}>
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="subheading" style={{ color: tone, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  )
}
