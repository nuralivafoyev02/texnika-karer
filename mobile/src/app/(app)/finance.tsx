import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { colors, radius } from '@/theme'
import { buildExportRows, buildJournalHtml, isoDay, toCsv } from '@/lib/export'
import { shareHtmlAsPdf, shareTextFile } from '@/lib/files'
import { dateTime, displayId, isSameMonth, money, tripCode } from '@/lib/format'
import { isPendingMonitoring } from '@/lib/monitoring'
import { useApp } from '@/store'
import type { Transaction } from '@/store/types'
import { confirmAction, useAction } from '@/hooks/useAction'
import { Guard } from '@/components/Guard'
import { ExpenseSheet } from '@/components/forms/ExpenseSheet'
import { PaymentSheet } from '@/components/forms/PaymentSheet'
import { TripSheet, Block } from '@/components/trips/TripSheet'
import { Button, Card, DetailRow, EmptyState, FilterChips, Icon, IconBadge, ListScreen, MetricCard, SearchBar, SectionTitle, Sheet, Tag, Text } from '@/components/ui'

export default function FinanceScreen() {
  return <Guard permission="finance.view"><Finance /></Guard>
}

type IconName = React.ComponentProps<typeof Icon>['name']
const categoryIcons: Record<string, IconName> = {
  blasting: 'flame-outline', fuel: 'water-outline', repair: 'build-outline', salary: 'briefcase-outline', payroll: 'hand-left-outline',
  cash_sale: 'cash-outline', customer_payment: 'cash-outline',
}
const iconFor = (category: string): IconName => categoryIcons[category] ?? 'receipt-outline'

function Finance() {
  const app = useApp()
  const action = useAction()
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all')
  const [search, setSearch] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [showExpense, setShowExpense] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tripId, setTripId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [showExport, setShowExport] = useState(false)

  const transactions = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...app.transactions]
      .filter((tx) => filter === 'all' || tx.direction === filter)
      .filter((tx) => !q || `${tx.note} ${app.categoryLabel(tx.category)} ${app.clientName(tx.clientId)} ${app.vehicleName(tx.vehicleId)}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [app.transactions, app.clients, app.vehicles, app.categories, filter, search]) // eslint-disable-line react-hooks/exhaustive-deps

  const categoryTotals = useMemo(() => {
    const rows = app.transactions.filter((tx) => tx.direction === 'out' && isSameMonth(tx.createdAt) && !isPendingMonitoring(tx))
    return app.expenseCategories
      .map((item) => ({ key: item.key, title: item.label, amount: rows.filter((tx) => tx.category === item.key).reduce((sum, tx) => sum + Number(tx.amount), 0) }))
      .filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount)
  }, [app.transactions, app.expenseCategories])

  const selected = selectedId ? app.transactions.find((tx) => tx.id === selectedId) ?? null : null
  const selectedTrip = selected?.tripId ? app.trips.find((trip) => trip.id === selected.tripId) ?? null : null
  const userName = (id?: string | null) => (id ? app.users.find((user) => user.id === id)?.fullName ?? '' : '')

  const startEdit = (tx: Transaction) => { setSelectedId(null); setTimeout(() => setEditing(tx), 350) }
  const remove = async (tx: Transaction) => {
    setSelectedId(null)
    if (!(await confirmAction('Kvitansiyani o‘chirish', `${app.categoryLabel(tx.category)} · ${money(tx.amount)} yozuvi o‘chiriladi. Davom etasizmi?`, 'O‘chirish', true))) return
    void action.run(() => app.deleteTransaction(tx.id), 'Kvitansiyani o‘chirib bo‘lmadi.')
  }

  const exportJournal = (kind: 'csv' | 'pdf') => action.run(async () => {
    const rows = buildExportRows(transactions, app)
    const subtitle = `${filter === 'all' ? 'Barcha yozuvlar' : filter === 'in' ? 'Faqat kirim' : 'Faqat chiqim'} · ${dateTime(new Date())}`
    if (kind === 'csv') await shareTextFile(toCsv(rows), `kirim-chiqim_${isoDay()}.csv`)
    else await shareHtmlAsPdf(buildJournalHtml(rows, { title: 'Kirim-chiqim jurnali', subtitle }), 'Kirim-chiqim jurnali')
    setShowExport(false)
  }, 'Eksport qilib bo‘lmadi.')

  const locked = selected ? app.transactionLocked(selected) : false
  const canEdit = app.canEditTransactions && !locked
  const canDelete = app.canDeleteTransactions && !locked

  return (
    <>
      <ListScreen
        title="Moliya"
        subtitle="Kassa, bank, kirim-chiqim jurnali"
        back
        right={<Button title="Eksport" icon="share-outline" small variant="secondary" full={false} onPress={() => setShowExport(true)} />}
        data={transactions}
        keyExtractor={(tx) => tx.id}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="Yozuvlar topilmadi" />}
        renderItem={({ item: tx }) => {
          const isIn = tx.direction === 'in'
          return (
            <Card onPress={() => setSelectedId(tx.id)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconBadge name={iconFor(tx.category)} tone={isIn ? 'green' : 'amber'} size={40} />
                <View style={{ flex: 1 }}>
                  <Text variant="subheading" numberOfLines={1}>{app.categoryLabel(tx.category)}</Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>{dateTime(tx.createdAt)}</Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>{tx.clientId ? [app.clientName(tx.clientId), tx.note].filter(Boolean).join(' · ') : tx.note || (tx.driverId ? app.driverName(tx.driverId) : '—')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text variant="heading" style={{ color: isIn ? colors.success : '#B36E35' }}>{app.canSeePrices ? `${isIn ? '+' : '−'} ${money(tx.amount, { short: true, currency: false })}` : '—'}</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <Tag label={tx.paymentMethod === 'cash' ? 'Naqd' : 'Bank'} tone={tx.paymentMethod === 'cash' ? 'cash' : 'blue'} />
                    {!isIn && isPendingMonitoring(tx) ? <Tag label="Kutilmoqda" tone="warn" /> : null}
                  </View>
                </View>
              </View>
            </Card>
          )
        }}
        header={(
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {app.can('finance.payments.create') ? <Button title="Kirim" icon="arrow-down" variant="secondary" onPress={() => setShowPayment(true)} style={{ flex: 1 }} /> : null}
              {app.can('finance.expenses.create') ? <Button title="Chiqim" icon="arrow-up" onPress={() => setShowExpense(true)} style={{ flex: 1 }} /> : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <MetricCard label="Naqd kassa" value={app.cashBalance === null ? '—' : money(app.cashBalance, { short: true })} icon="cash-outline" tone="amber" />
              <MetricCard label="Bank hisobi" value={app.bankBalance === null ? '—' : money(app.bankBalance, { short: true })} icon="card-outline" tone="brand" />
              <MetricCard label="Bugungi kirim" value={money(app.todayCashIn, { short: true })} icon="arrow-down-circle-outline" tone="green" />
              <MetricCard label="Oy xarajatlari" value={money(app.monthExpenses, { short: true })} detail={app.pendingExpenses.length ? `${app.pendingExpenses.length} ta kutilmoqda` : undefined} icon="arrow-up-circle-outline" tone="violet" />
            </View>
            {categoryTotals.length ? (
              <Card>
                <SectionTitle title="Joriy oy xarajatlari tarkibi" />
                <View style={{ gap: 10, marginTop: 10 }}>
                  {categoryTotals.map((item) => (
                    <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <IconBadge name={iconFor(item.key)} tone="grey" size={32} />
                      <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>{item.title}</Text>
                      <Text variant="label">{money(item.amount, { short: true })}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}
            <SearchBar value={search} onChangeText={setSearch} placeholder="Izoh, tur, mijoz yoki texnika" />
            <FilterChips value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Barchasi' }, { value: 'in', label: 'Kirim' }, { value: 'out', label: 'Chiqim' }]} />
          </>
        )}
      />

      <PaymentSheet visible={showPayment} onClose={() => setShowPayment(false)} />
      <ExpenseSheet visible={showExpense} onClose={() => setShowExpense(false)} />
      <PaymentSheet visible={Boolean(editing && editing.direction === 'in')} transaction={editing?.direction === 'in' ? editing : null} onClose={() => setEditing(null)} />
      <ExpenseSheet visible={Boolean(editing && editing.direction === 'out')} transaction={editing?.direction === 'out' ? editing : null} onClose={() => setEditing(null)} />
      <TripSheet tripId={tripId} onClose={() => setTripId(null)} />

      <Sheet visible={Boolean(selected)} onClose={() => setSelectedId(null)} title="Kvitansiya" subtitle={selected ? dateTime(selected.createdAt) : ''} tall>
        {selected ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: selected.direction === 'in' ? '#EAF7F0' : '#FDF3E9', borderRadius: radius.lg, padding: 14, marginBottom: 14 }}>
              <IconBadge name={iconFor(selected.category)} tone={selected.direction === 'in' ? 'green' : 'amber'} size={46} />
              <View style={{ flex: 1 }}>
                <Text variant="label" style={{ color: selected.direction === 'in' ? '#0F7A4D' : '#B36E35' }}>{selected.direction === 'in' ? 'Kirim' : 'Chiqim'} · {app.categoryLabel(selected.category)}</Text>
                <Text variant="title" style={{ fontSize: 22 }} numberOfLines={1} adjustsFontSizeToFit>
                  {app.canSeePrices ? `${selected.direction === 'in' ? '+' : '−'} ${money(selected.amount)}` : 'Yashirilgan'}
                </Text>
              </View>
            </View>
            {selectedTrip ? (
              <Card onPress={() => setTripId(selectedTrip.id)} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text variant="subheading">Reys {tripCode(selectedTrip.id)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Tag label={selectedTrip.saleType === 'cash' ? 'To‘langan' : 'To‘lanmagan'} tone={selectedTrip.saleType === 'cash' ? 'leaf' : 'warn'} />
                    <Icon name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                </View>
              </Card>
            ) : null}
            <Block title="Tafsilotlar">
              <DetailRow label="Hisob" value={selected.paymentMethod === 'cash' ? 'Naqd kassa' : 'Bank hisobi'} />
              <DetailRow label="Mijoz" value={selected.clientId ? app.clientName(selected.clientId) : ''} />
              <DetailRow label="Xodim" value={selected.driverId ? app.driverName(selected.driverId) : ''} />
              <DetailRow label="Texnika" value={selected.vehicleId ? app.vehicleName(selected.vehicleId) : ''} />
              <DetailRow label="Kiritildi" value={dateTime(selected.createdAt)} sub={userName(selected.createdBy)} />
            </Block>
            {selected.direction === 'out' ? (
              <Block title="Monitoring">
                <DetailRow label="Holat" tag={isPendingMonitoring(selected) ? 'Kutilmoqda' : 'Tasdiqlangan'} tagTone={isPendingMonitoring(selected) ? 'warn' : 'leaf'} />
                <DetailRow label={isPendingMonitoring(selected) ? 'Bekor qilgan' : 'Tasdiqlagan'} value={selected.monitoredAt ? userName(selected.monitoredBy) || '—' : ''} sub={selected.monitoredAt ? dateTime(selected.monitoredAt) : ''} />
                <DetailRow label="Izoh" value={selected.monitoringNote} />
              </Block>
            ) : null}
            {selected.note ? (
              <View style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.canvas, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.line, marginBottom: 12 }}>
                <Icon name="document-text-outline" size={18} color={colors.muted} />
                <Text style={{ flex: 1 }}>{selected.note}</Text>
              </View>
            ) : null}
            <View style={{ gap: 10 }}>
              {canEdit ? <Button title="Tahrirlash" icon="create-outline" variant="secondary" onPress={() => startEdit(selected)} /> : null}
              {canDelete ? <Button title="O‘chirish" icon="trash-outline" variant="danger" onPress={() => void remove(selected)} /> : null}
              {locked && (app.canEditTransactions || app.canDeleteTransactions) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="lock-closed-outline" size={14} color={colors.muted} /><Text variant="caption" tone="muted">Reys orqali boshqariladi</Text></View>
              ) : null}
              {!canEdit && !canDelete && !locked ? <Text variant="caption" tone="muted">ID: {displayId(selected.id)}</Text> : null}
            </View>
          </>
        ) : null}
      </Sheet>

      <Sheet visible={showExport} onClose={() => setShowExport(false)} title="Jurnalni eksport qilish" subtitle={`${transactions.length} ta yozuv (joriy filtr bo‘yicha)`}>
        <Text tone="muted" style={{ marginBottom: 14 }}>Fayl tayyor bo‘lgach ulashish oynasi ochiladi: Telegram, pochta yoki «Fayllarga saqlash».</Text>
        <Button title="PDF (chop etish uchun)" icon="document-outline" onPress={() => void exportJournal('pdf')} loading={action.busy} />
        <Button title="CSV (Excel uchun)" icon="grid-outline" variant="secondary" onPress={() => void exportJournal('csv')} disabled={action.busy} style={{ marginTop: 10 }} />
      </Sheet>
    </>
  )
}
