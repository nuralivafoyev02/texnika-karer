<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { Info, KeyRound, RefreshCw, Eye, EyeOff, Copy } from 'lucide-vue-next'
import FormActions from './FormActions.vue'
import { INTERNAL_DOMAIN } from '../../lib/supabase'
import { formatAmountInput, parseAmountInput, captureAmountInput } from '../../lib/format'

const props = defineProps({
  roles: { type: Array, default: () => [] },
  demoMode: Boolean,
  loading: Boolean,
  user: { type: Object, default: null },
  // Masalan FleetView dan "haydovchi qo'shish" ochilganda rolinga avtomatik o'tadi.
  initialRoleId: { type: String, default: '' },
})
const emit = defineEmits(['submit', 'cancel'])
const isEdit = computed(() => Boolean(props.user))
const form = reactive({
  fullName: '', login: '', password: '', phone: '', title: '',
  roleId: '', driverRatePerTrip: formatAmountInput(50000), isActive: true,
})
const error = ref('')
const onRate = (event) => captureAmountInput(event, (value) => { form.driverRatePerTrip = value })
const showPassword = ref(false)
const selectedRole = computed(() => props.roles.find((role) => role.id === form.roleId))
watch(() => props.roles, (roles) => {
  if (isEdit.value || form.roleId || !roles.length) return
  const preferred = roles.find((role) => role.id === props.initialRoleId)
  form.roleId = preferred?.id ?? roles[0].id
}, { immediate: true })
watch(() => props.user, (user) => {
  if (!user) return
  Object.assign(form, {
    fullName: user.fullName ?? '', login: user.login ?? '', password: '',
    phone: user.phone ?? '', title: user.title ?? '',    roleId: user.roleId,
    driverRatePerTrip: formatAmountInput(Number(user.driverRatePerTrip || 0)), isActive: user.isActive !== false,
  })
}, { immediate: true })

const LOGIN_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/
// Parol maydoni doim tahrirlanadigan: foydalanuvchi qo'lda kiritishi yoki "Tayyor parol"
// tugmasi bilan generatsiya qilishi mumkin. Hech qanday holatda maydon bloklanmaydi.
const passwordProblem = computed(() => {
  if (isEdit.value) return ''
  const value = form.password
  if (!value) return 'Parol kiriting yoki «Tayyor parol» tugmasini bosing.'
  if (value.length < 8) return `Parol ${8 - value.length} ta belgiga yetmayapti (minimum 8).`
  if (value.length > 72) return 'Parol juda uzun (maksimum 72 belgi).'
  if (/^[a-z0-9]+$/.test(value)) return 'Parolga katta harf yoki boshqa belgi qo‘shing.'
  return ''
})
const loginProblem = computed(() => {
  if (isEdit.value) return ''
  if (!form.login) return 'Xodim uchun login belgilang.'
  if (!LOGIN_PATTERN.test(form.login.toLowerCase())) return 'Login: kichik harf, raqam, nuqta yoki chiziqcha (3–32 belgi).'
  return ''
})
const loginHint = computed(() => (form.login ? `${form.login.toLowerCase()}@${INTERNAL_DOMAIN}` : `@${INTERNAL_DOMAIN} bilan yakunlanadi`))

function randomPassword() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(11))
  form.password = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
  showPassword.value = true
  error.value = ''
}
function submit() {
  error.value = ''
  if (form.fullName.trim().length < 3) { error.value = 'Xodimning to‘liq ismini kiriting.'; return }
  if (loginProblem.value) { error.value = loginProblem.value; return }
  if (!isEdit.value && !form.roleId) { error.value = 'Lavozimni tanlang.'; return }
  if (passwordProblem.value) { error.value = passwordProblem.value; return }
  emit('submit', {
    ...form,
    login: form.login.toLowerCase(),
    password: form.password,
    generatePassword: false,
    driverRatePerTrip: parseAmountInput(form.driverRatePerTrip),
  })
}
</script>

<template>
  <form @submit.prevent="submit">
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="sm:col-span-2"><span class="label">Xodimning to‘liq ismi</span><input v-model="form.fullName" class="field" placeholder="Ism Familiya" required /></label>
      <label v-if="!isEdit" class="sm:col-span-2"><span class="label">Login (tizimga kirish uchun)</span><input v-model="form.login" class="field" placeholder="masalan: ali" autocomplete="off" autocapitalize="none" spellcheck="false" required /><span class="mt-1 block text-[10px] text-muted">Tizimga kirishda shu login yoziladi ({{ loginHint }}). Xodim o‘z loginini email sifatida kiritmaydi.</span></label>
      <label v-if="!isEdit" class="sm:col-span-2">
        <span class="label">Parol</span>
        <div class="flex gap-2">
          <div class="relative flex-1"><KeyRound :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="form.password" class="field pl-10" :type="showPassword ? 'text' : 'password'" placeholder="Kamida 8 ta belgi" autocomplete="new-password" minlength="8" maxlength="72" required /><button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-leaf" :aria-label="showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'" @click="showPassword = !showPassword"><EyeOff v-if="showPassword" :size="15" /><Eye v-else :size="15" /></button></div>
          <button type="button" class="btn-secondary shrink-0" title="Tayyor parol yaratish" @click="randomPassword"><RefreshCw :size="14" /> Tayyor</button>
        </div>
        <span class="mt-1 block text-[10px] text-muted">Xodim shu parol bilan kiradi — uni o‘ziga yetkazing. Kamida 8 ta belgi, katta/kichik harf va raqamlar aralash bo‘lsin.</span>
      </label>
      <label><span class="label">Telefon</span><input v-model="form.phone" class="field" type="tel" placeholder="+998 90 000 00 00" /></label>
      <label><span class="label">Lavozim bo‘limi</span><input v-model="form.title" class="field" :placeholder="selectedRole?.name || 'Masalan: qurilma bo‘limi boshlig‘i'" /></label>
      <label class="sm:col-span-2"><span class="label">Lavozim (ruxsatlar shundan kelib chiqadi)</span><select v-model="form.roleId" class="field" required :disabled="isEdit && user?.isSuperadmin"><option value="" disabled>Lavozimni tanlang</option><option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option></select></label>
      <label v-if="selectedRole?.permissions?.includes('driver.self') || parseAmountInput(form.driverRatePerTrip) > 0" class="sm:col-span-2"><span class="label">Bir reys uchun haq</span><div class="relative"><input :value="form.driverRatePerTrip" type="text" inputmode="numeric" autocomplete="off" class="field pr-16" @input="onRate"><span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">so‘m / reys</span></div></label>
      <label v-if="isEdit" class="sm:col-span-2"><span class="label">Holati</span><select v-model="form.isActive" class="field" :disabled="user?.isSuperadmin"><option :value="true">Faol — tizimga kirishi mumkin</option><option :value="false">Faol emas — kirish bloklanadi</option></select><span v-if="user?.isSuperadmin" class="mt-1 block text-[10px] text-muted">Superadmin hisobi faol holatda qolishi shart.</span></label>
    </div>
    <div class="mt-4 flex gap-2 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-[11px] leading-4 text-blue-800">
      <Info :size="15" class="mt-0.5 shrink-0" />
      <span v-if="props.demoMode">Demo rejimida xodim faqat shu brauzer ro‘yxatiga qo‘shiladi; haqiqiy login yaratilmaydi.</span>
      <span v-else-if="isEdit">Ma’lumotlar saqlanadi. Parolni alohida “Parol” tugmasi orqali yangilashingiz mumkin.</span>
      <span v-else>Xodim qo‘shilishi bilan login va parol yaratiladi. Parol server tomonda shifrlab saqlanadi, email yoki taklif linki yuborilmaydi. Siz kiritgan parol o‘zgartirilmay saqlanadi.</span>
    </div>
    <p v-if="error" class="mt-3 text-xs font-semibold text-danger">{{ error }}</p>
    <FormActions :loading="loading" :submit-label="isEdit ? 'Saqlash' : 'Xodim qo‘shish'" @cancel="emit('cancel')" />
  </form>
</template>
