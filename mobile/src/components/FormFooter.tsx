import { View } from 'react-native'
import { Button, Text } from '@/components/ui'

// Forma tugmalari (web'dagi FormActions): bekor qilish + saqlash.
export function FormFooter({ onCancel, onSubmit, submitLabel, loading, error, disabled }: {
  onCancel?: () => void; onSubmit: () => void; submitLabel: string; loading?: boolean; error?: string; disabled?: boolean
}) {
  return (
    <View style={{ marginTop: 6, gap: 10 }}>
      {error ? <Text variant="label" tone="danger">{error}</Text> : null}
      <Button title={submitLabel} onPress={onSubmit} loading={loading} disabled={disabled} />
      {onCancel ? <Button title="Bekor qilish" variant="secondary" onPress={onCancel} disabled={loading} /> : null}
    </View>
  )
}
