import { useState } from 'react'
import { View } from 'react-native'
import { useApp } from '@/store'
import type { Role } from '@/store/types'
import { confirmAction, useAction } from '@/hooks/useAction'
import { Guard } from '@/components/Guard'
import { RoleSheet } from '@/components/forms/RoleSheet'
import { Button, Card, EmptyState, IconBadge, Screen, Tag, Text } from '@/components/ui'

export default function RolesScreen() {
  return <Guard permission="roles.manage"><Roles /></Guard>
}

function Roles() {
  const app = useApp()
  const action = useAction()
  const [editing, setEditing] = useState<Role | null>(null)
  const [showNew, setShowNew] = useState(false)

  const remove = async (role: Role) => {
    if (!(await confirmAction('Lavozimni o‘chirish', `“${role.name}” lavozimini o‘chirishni tasdiqlaysizmi?`, 'O‘chirish', true))) return
    void action.run(() => app.deleteRole(role.id), 'Lavozimni o‘chirib bo‘lmadi.')
  }

  return (
    <Screen title="Lavozimlar" subtitle="Dinamik RBAC: lavozim va ruxsatlar" back right={<Button title="Yangi" icon="add" small full={false} onPress={() => setShowNew(true)} />}>
      {app.roles.length ? app.roles.map((role) => {
        const members = app.users.filter((user) => user.roleId === role.id && user.isActive)
        const full = app.roleHasFullAccess(role.id)
        return (
          <Card key={role.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconBadge name={full ? 'shield-checkmark' : 'shield-outline'} tone={full ? 'amber' : 'brand'} size={42} />
              <View style={{ flex: 1 }}>
                <Text variant="subheading" numberOfLines={1}>{role.name}</Text>
                <Text variant="caption" tone="muted" numberOfLines={2}>{role.description || `${full ? 'Barcha' : role.permissions.length} ta ruxsat`}</Text>
              </View>
              <View style={{ gap: 4, alignItems: 'flex-end' }}>
                {full ? <Tag label="To‘liq huquq" tone="credit" /> : <Tag label={`${role.permissions.length} ruxsat`} tone="blue" />}
                {role.isSystem ? <Tag label="Tizim" tone="muted" /> : null}
              </View>
            </View>
            <Text variant="caption" tone="muted" style={{ marginTop: 10 }}>
              {members.length ? members.map((user) => user.fullName).join(', ') : 'Xodimlar biriktirilmagan'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Button title="Tahrirlash" icon="create-outline" small variant="secondary" onPress={() => setEditing(role)} style={{ flex: 1 }} />
              {!role.isSystem ? <Button title="O‘chirish" icon="trash-outline" small variant="quiet" onPress={() => void remove(role)} disabled={action.busy} style={{ flex: 1 }} /> : null}
            </View>
          </Card>
        )
      }) : <EmptyState icon="shield-outline" title="Lavozimlar topilmadi" />}
      <RoleSheet visible={showNew} onClose={() => setShowNew(false)} />
      <RoleSheet visible={editing !== null} role={editing} onClose={() => setEditing(null)} />
    </Screen>
  )
}
