<script setup>
// Xodimning o'z profili. Lavozim (role) maydoni ataylab yo'q: uni faqat to'liq
// huquqli (superadmin) xodim boshqaradi — aks holda xodim o'ziga ruxsat kengaytirib,
// o'ziga to'liq huquq berib bo'lardi.
//
// Bo'limlar accordion ko'rinishida: har biri alohida ochiladi, o'ziga xos maydon va
// "Bu o'zgarishni saqlash" tugmasi bilan. Shu tarzda bir vaqtda bir nechta o'zgarishni
// tasdiqlab yuborish yoki xatoni bir-ikki maydonga taqiqlash mumkin.
import { computed, ref, watch } from 'vue'
import { Camera, ChevronDown, KeyRound, Phone, Trash2, UserRound } from 'lucide-vue-next'
import ModalDialog from '../ModalDialog.vue'
import PhoneField from './PhoneField.vue'
import { useQuarryStore } from '../../stores/quarry'
import { initials } from '../../lib/format'
import { formatPhone, phoneProblem } from '../../lib/phone'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
const store = useQuarryStore()

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Ochiladigan bo'lim: 'avatar' | 'name' | 'phone' | 'account'. null = hammasi yopiq.
const section = ref(null)
const error = ref('')
const busy = ref('')

const fullName = ref('')
const phone = ref('')
const login = ref('')
const newPassword = ref('')
const currentPassword = ref('')
const showPassword = ref(false)
const fileInput = ref(null)
const avatarFailed = ref(false)

const user = computed(() => store.currentUser)
const avatarUrl = ref('')

const SECTIONS = [
  { key: 'avatar', label: 'Profil rasmi', icon: Camera, hint: 'JPG, PNG yoki WebP · 2 MB gacha' },
  { key: 'name', label: 'Ism-familiya', icon: UserRound, hint: 'Xodimlar ro‘yxatida ko‘rinadi' },
  { key: 'phone', label: 'Telefon nomer', icon: Phone, hint: 'Ichki aloqa uchun' },
  { key: 'account', label: 'Login va parol', icon: KeyRound, hint: 'Tizimga kirish ma’lumotlari' },
]
const activeSection = computed(() => SECTIONS.find((item) => item.key === section.value))
const canChangeLogin = computed(() => store.remoteMode && Boolean(user.value?.login))

function toggle(key) {
  error.value = ''
  section.value = section.value === key ? null : key
}

// Modal ochilganda maydonlarni joriy qiymat bilan to'ldiramiz. Rasmni yuklash
// alohida so'rov bilan (signed URL), shuning uchun uni watch orqali qilamiz.
watch(open, async (value) => {
  if (!value) return
  section.value = null
  error.value = ''
  busy.value = ''
  newPassword.value = ''
  currentPassword.value = ''
  showPassword.value = false
  avatarFailed.value = false
  fullName.value = user.value?.fullName ?? ''
  // Eski qiymat bo'lishi mumkin (to'liq yoki milliy, bo'shliqli yoki to'g'ri
  // yozilgan) — maydonga har doim bir xil ko'rinishda kelishi uchun
  // formatPhone orqali o'tkazamiz.
  phone.value = formatPhone(user.value?.phone)
  login.value = user.value?.login ?? ''
  avatarUrl.value = user.value?.avatarUrl ?? ''
  if (user.value?.avatarPath) {
    try {
      avatarUrl.value = await store.ensureAvatarUrl(user.value)
    } catch {
      // Rasmni ko'ra olmasak ham profil tahrirlanishi mumkin — jimgina xato ko'rsatamiz.
      avatarFailed.value = true
    }
  }
})

const nameChanged = computed(() => (user.value?.fullName ?? '') !== fullName.value.trim())
// Ikkalasini ham bir xil formatga keltirib solishtiramiz — aks holda foydalanuvchi
// raqamni qayta yozsa ham "o'zgardi" deb xato ko'rinardi.
const phoneChanged = computed(() => formatPhone(user.value?.phone) !== formatPhone(phone.value))
const phoneError = computed(() => phoneProblem(phone.value))
const loginChanged = computed(() => Boolean(login.value.trim().toLowerCase()) && login.value.trim().toLowerCase() !== user.value?.login)

function fail(exception) {
  error.value = exception?.message || 'Xatolik yuz berdi.'
  busy.value = ''
}
async function run(key, task) {
  error.value = ''
  busy.value = key
  try {
    await task()
    section.value = null
  } catch (exception) {
    fail(exception)
  } finally {
    busy.value = ''
  }
}

function saveName() {
  return run('name', () => store.updateMyProfile({ fullName: fullName.value }))
}
function savePhone() {
  // To'liq bo'lmagan raqamni saqlashga yo'l qo'yilmaydi.
  if (phoneError.value) { error.value = phoneError.value; return }
  return run('phone', () => store.updateMyProfile({ phone: formatPhone(phone.value) }))
}
function saveAccount() {
  return run('account', () => store.updateMyAccount({
    login: login.value.trim().toLowerCase(),
    currentPassword: currentPassword.value,
    password: newPassword.value,
  }))
}

function pickFile() {
  fileInput.value?.click()
}
async function onFile(event) {
  const file = event.target.files?.[0]
  // Bir xil faylni qayta tanlash tanlovi ishga tushishi uchun qiymatni tozalaymiz.
  event.target.value = ''
  if (!file) return
  await run('avatar', async () => {
    await store.uploadAvatar(file)
    avatarUrl.value = user.value?.avatarUrl || avatarUrl.value
    avatarFailed.value = false
  })
}
async function removeAvatar() {
  await run('avatar', async () => {
    await store.removeAvatar()
    avatarUrl.value = ''
  })
}
</script>

<template>
  <ModalDialog v-model="open" title="Mening profilim" description="O‘z ma’lumotlaringizni yangilashingiz mumkin." width="max-w-lg">
    <!-- Profil kartasi: kimligi va rasmni bir qarorda ko'rsatadi. -->
    <div class="flex items-center gap-4 rounded-2xl border border-line bg-canvas/60 p-4">
      <div class="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-white text-lg font-bold text-leaf ring-1 ring-line">
        <img v-if="avatarUrl" :src="avatarUrl" :alt="user?.fullName" class="h-full w-full object-cover" @error="avatarFailed = true" />
        <span v-else>{{ initials(user?.fullName) }}</span>
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-bold text-ink">{{ user?.fullName }}</p>
        <p class="mt-1 truncate text-[11px] text-muted">{{ store.currentRole?.name || 'Lavozim belgilanmagan' }}</p>
        <p class="mt-1 truncate text-[11px] text-muted">{{ user?.login }}</p>
        <span v-if="store.isSuperadmin()" class="mt-1.5 inline-block rounded bg-[#fff4e3] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#b77824]">superadmin</span>
      </div>
    </div>

    <p v-if="error" class="mt-4 rounded-xl border border-[#f0cdc4] bg-[#fdf3f1] px-3 py-2.5 text-[11px] font-medium text-[#bd594d]">{{ error }}</p>
    <p v-if="avatarFailed" class="mt-4 rounded-xl border border-[#f0e2c0] bg-[#fdf8ec] px-3 py-2.5 text-[11px] font-medium text-[#b77824]">Rasmni ko‘rsatib bo‘lmadi. Yangi rasm tanlash bilan almashtiring.</p>

    <!-- Bo'limlar: har biri o'ziga xos maydon va saqlash tugmasi bilan.
         Ochilishi/yopilishi haqiqiy balandlik animatsiyasi (0 → 100%) orqali:
         tashqi `.collapse-wrap` grid konteyneri, ichki `.collapse-body` esa
         `min-height: 0` bilan siqiladi. max-height ishlatilmadi — u haqiqiy
         balandlikni taxmin qilib, oxirida sekinlashib "sakrab" chiqadi. -->
    <div class="mt-4 space-y-2">
      <div v-for="item in SECTIONS" :key="item.key" class="overflow-hidden rounded-2xl border border-line">
        <button
          type="button"
          class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-canvas"
          :aria-expanded="section === item.key"
          @click="toggle(item.key)"
        >
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-leaf ring-1 ring-line"><component :is="item.icon" :size="15" /></span>
          <span class="min-w-0 flex-1">
            <span class="block text-xs font-bold text-ink">{{ item.label }}</span>
            <span class="mt-0.5 block text-[10px] text-muted">{{ item.hint }}</span>
          </span>
          <ChevronDown :size="15" class="shrink-0 text-slate-400 transition" :class="section === item.key ? 'rotate-180' : ''" />
        </button>

        <Transition name="collapse">
          <div v-if="section === item.key" class="collapse-wrap">
            <div class="collapse-body border-t border-line bg-canvas/40 px-4 py-4">
          <!-- Rasm -->
          <template v-if="item.key === 'avatar'">
            <div class="flex flex-wrap items-center gap-3">
              <button type="button" class="btn-secondary !py-2" :disabled="busy === 'avatar'" @click="pickFile">
                <Camera :size="14" /> {{ user?.avatarPath ? 'Rasmni almashtirish' : 'Rasm tanlash' }}
              </button>
              <button v-if="user?.avatarPath" type="button" class="btn-quiet !py-2 text-danger" :disabled="busy === 'avatar'" @click="removeAvatar">
                <Trash2 :size="14" /> O‘chirish
              </button>
              <p v-if="busy === 'avatar'" class="text-[11px] text-muted">Yuklanmoqda…</p>
            </div>
            <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onFile" />
          </template>

          <!-- Ism-familiya -->
          <template v-else-if="item.key === 'name'">
            <label><span class="label">Ism-familiya</span><input v-model="fullName" class="field" maxlength="120" autocomplete="name" placeholder="Masalan: Javlon Karimov" /></label>
            <button type="button" class="btn-primary mt-3 !py-2" :disabled="busy === 'name' || !nameChanged" @click="saveName">
              {{ busy === 'name' ? 'Saqlanmoqda…' : 'Ismni saqlash' }}
            </button>
          </template>

          <!-- Telefon -->
          <template v-else-if="item.key === 'phone'">
            <PhoneField v-model="phone" label="Telefon nomer" hint="Ichki aloqa uchun. +998 avtomatik qo‘shiladi." />
            <button type="button" class="btn-primary mt-3 !py-2" :disabled="busy === 'phone' || !phoneChanged || Boolean(phoneError)" @click="savePhone">
              {{ busy === 'phone' ? 'Saqlanmoqda…' : 'Telefonni saqlash' }}
            </button>
          </template>

          <!-- Login va parol -->
          <template v-else>
            <label v-if="canChangeLogin">
              <span class="label">Login</span>
              <input v-model="login" class="field" autocomplete="username" placeholder="masalan: javlon" />
              <span class="mt-1 block text-[10px] text-muted">Kichik harflar, raqamlar, nuqta va chiziqcha (3–32 belgi). Login — tizimga kirish nomiz.</span>
            </label>
            <p v-else-if="!store.remoteMode" class="rounded-xl bg-white px-3 py-2.5 text-[11px] text-muted">Demo rejimida login va parol o‘zgartirilmaydi — bu faqat namoyish uchun.</p>
            <p v-else class="rounded-xl bg-white px-3 py-2.5 text-[11px] text-muted">Bu hisobda login belgilanmagan. Administratorga murojaat qiling.</p>

            <label v-if="store.remoteMode" class="mt-3 block">
              <span class="label">Joriy parol <span class="font-normal text-muted">(parolni o‘zgartirsangiz majburiy)</span></span>
              <input v-model="currentPassword" class="field" type="password" autocomplete="current-password" />
            </label>
            <label v-if="store.remoteMode" class="mt-3 block">
              <span class="label">Yangi parol</span>
              <div class="relative">
                <input v-model="newPassword" class="field pr-20" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="Kamida 8 belgi" />
                <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-bold text-leaf" @click="showPassword = !showPassword">{{ showPassword ? 'Yashirish' : 'Ko‘rsatish' }}</button>
              </div>
              <span class="mt-1 block text-[10px] text-muted">Parolni bo‘sh qoldirmaslik uchun o‘zgartiring. Parol hech qayerda saqlanmaydi.</span>
            </label>

            <button
              v-if="store.remoteMode"
              type="button"
              class="btn-primary mt-3 !py-2"
              :disabled="busy === 'account' || (!loginChanged && !newPassword)"
              @click="saveAccount"
            >
              {{ busy === 'account' ? 'Saqlanmoqda…' : 'Saqlash' }}
            </button>
            <p v-else-if="!canChangeLogin" class="mt-3 text-[10px] text-muted"></p>
          </template>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </ModalDialog>
</template>
