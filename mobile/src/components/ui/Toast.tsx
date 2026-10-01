import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, shadow } from '@/theme'
import { useQuarryStore } from '@/store'
import { Icon } from './Icon'
import { Text } from './Typography'

// Web'dagi toast xabari: yuqorida qisqa vaqt ko'rinadi.
export function ToastHost() {
  const toast = useQuarryStore((s) => s.toast)
  const insets = useSafeAreaInsets()
  const opacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(opacity, { toValue: toast ? 1 : 0, duration: 180, useNativeDriver: true }).start()
  }, [toast, opacity])
  if (!toast) return null
  const error = toast.type === 'error'
  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8, opacity }]}>
      <View style={[styles.toast, { backgroundColor: error ? colors.danger : colors.ink }]}>
        <Icon name={error ? 'alert-circle' : 'checkmark-circle'} size={20} color="#fff" />
        <Text variant="label" style={{ color: '#fff', flex: 1, fontWeight: '600', lineHeight: 17 }}>{toast.message}</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 100 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.lg, ...shadow.float },
})
