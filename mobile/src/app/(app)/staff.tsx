import { useMemo, useState } from 'react'
import { Linking, View } from 'react-native'
import { colors, radius } from '@/theme'
import { phoneHref } from '@/lib/phone'
import { useApp } from '@/store'
import type { User } from '@/store/types'
import { useAction } from '@/hooks/useAction'
import { Guard } from '@/components/Guard'
import { StaffSheet } from '@/components/forms/StaffSheet'
import { Avatar, Button, Card, EmptyState, ListScreen, SearchBar, Sheet, Tag, Text, TextField } from '@/components/ui'

export default function StaffScreen() {
  return <Guard permission="staff.view"><Staff /></Guard>
}

function Staff() {
  const app = useApp()
  const action = useAction()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [passwordUser, setPasswordUser] = useState<User | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const staff = useMemo(() => {
    const q = search.trim().toLowerCase()
    return app.users.filter((user) => !q || `${user.fullName} ${user.login} ${user.phone} ${app.roleName(user)}`.toLowerCase().includes(q))
  }, [app.users, app.roles, search]) // eslint-disable-line react-hooks/exhaustive-deps
  const rolesInUse = new Set(app.users.map((user) => user.roleId)).size
  const driverCount = app.users.filter((user) => app.userCan(user, 'driver.self')).length

  const savePassword = () => {
    setPasswordError('')
    if (password.trim().length < 8) return setPasswordError('Parol kamida 8 ta belgidan iborat bo‘lishi kerak.')
    void action.run(async () => {
      try { if (passwordUser) await app.setStaffPassword(passwordUser.id, password) } catch (error: any) { setPasswordError(error?.message || 'Parolni yangilab bo‘lmadi.'); return }
      setPasswordUser(null)
      setPassword('')
    })
  }

  return (
    <>
      <ListScreen
        title="Xodimlar"
        subtitle="Login, parol va lavozimlar"
        back
        right={app.canManageStaff ? <Button title="Xodim" icon="person-add-outline" small full={false} onPress={() => setShowCreate(true)} /> : undefined}
        data={staff}
        keyExtractor={(user) => user.id}
        ListEmptyComponent={<EmptyState icon="people-outline" title="Xodim topilmadi" />}
        renderItem={({ item: user }) => {
          const href = phoneHref(user.phone)
          return (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={user.fullName} size={44} />
                <View style={{ flex: 1 }}>
                  <Text variant="subheading" numberOfLines={1}>{user.fullName}</Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>{app.roleName(user)}{user.title ? ` · ${user.title}` : ''}</Text>
                  <Text variant="caption" tone="muted">@{user.login}</Text>
                </View>
                <View style={{ gap: 4, alignItems: 'flex-end' }}>
                  <Tag label={user.isActive ? 'Faol' : 'Bloklangan'} tone={user.isActive ? 'leaf' : 'danger'} dot />
                  {app.isSuperadmin(user) ? <Tag label="Superadmin" tone="credit" /> : null}
                </View>
              </View>
              {href || app.canManageStaff ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {href ? <Button title={user.phone} icon="call-outline" small variant="secondary" style={{ flex: 1 }} onPress={() => void Linking.openURL(href)} /> : null}
                  {app.canManageStaff ? <Button title="Tahrirlash" icon="create-outline" small variant="quiet" style={{ flex: 1 }} onPress={() => setEditing(user)} /> : null}
                  {app.canManageStaff ? <Button title="Parol" icon="key-outline" small variant="quiet" style={{ flex: 1 }} onPress={() => { setPasswordUser(user); setPassword(''); setPasswordError('') }} /> : null}
                </View>
              ) : null}
            </Card>
          )
        }}
        header={(
          <>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Ism, login, telefon yoki lavozim" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Sum label="Xodimlar" value={String(app.users.length)} />
              <Sum label="Lavozimlar" value={String(rolesInUse)} />
              <Sum label="Haydovchilar" value={String(driverCount)} />
            </View>
          </>
        )}
      />
      <StaffSheet visible={showCreate} onClose={() => setShowCreate(false)} />
      <StaffSheet visible={editing !== null} user={editing} onClose={() => setEditing(null)} />
      <Sheet visible={Boolean(passwordUser)} onClose={() => setPasswordUser(null)} title="Yangi parol" subtitle={passwordUser?.fullName}>
        <TextField label="Yangi parol" value={password} onChangeText={setPassword} secure autoCapitalize="none" autoCorrect={false} placeholder="Kamida 8 ta belgi" error={passwordError} />
        <Button title="Parolni saqlash" icon="key-outline" onPress={savePassword} loading={action.busy} />
      </Sheet>
    </>
  )
}

function Sum({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 12 }}>
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="subheading">{value}</Text>
    </View>
  )
}
