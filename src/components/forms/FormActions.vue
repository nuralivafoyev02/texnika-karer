<script setup>
defineProps({ loading: { type: Boolean, default: false }, submitLabel: { type: String, default: 'Saqlash' } })
defineEmits(['cancel'])
</script>

<template>
  <div class="mt-6 flex justify-end gap-2 border-t border-line pt-4">
    <button type="button" class="btn-secondary" @click="$emit('cancel')">Bekor qilish</button>
    <button type="submit" class="btn-primary" :disabled="loading">{{ loading ? 'Saqlanmoqda…' : submitLabel }}</button>
  </div>
</template>
