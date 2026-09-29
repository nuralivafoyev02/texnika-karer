<script setup>
import { computed, ref } from 'vue'
import { ChevronDown, CircleCheck, Circle, CalendarCheck, Zap, Calculator, KeyRound, BookOpen, Compass, ListChecks, Lightbulb, ArrowRight } from 'lucide-vue-next'
import ModalDialog from './ModalDialog.vue'
import { useQuarryStore } from '../stores/quarry'
import { availableSections, permissionGroupsFor, GUIDE_BASICS } from '../lib/guide'
import { permissionLabel } from '../lib/permissions'

const store = useQuarryStore()
const open = defineModel({ type: Boolean, default: false })

// ── Ma'lumot manbalari ───────────────────────────────────────────────────────
// Bo'limlar: guide.js dagi GUIDE_SECTIONS — faqat foydalanuvchining haqiqiy
// ruxsatlariga mos keladiganlari. Ruxsatlar: PERMISSION_CATALOG to'liq
// tushuntirilgan holda, berilmaganlari o'chgan (so'ngra) ko'rinishda.
const basics = GUIDE_BASICS
const basicsIcons = [CalendarCheck, Zap, Calculator, KeyRound]
const sections = computed(() => availableSections(store))
const permissionGroups = computed(() => permissionGroupsFor(store))
const grantedCount = computed(() => permissionGroups.value.reduce((sum, entry) => sum + entry.items.filter((item) => item.granted).length, 0))
const totalCount = computed(() => permissionGroups.value.reduce((sum, entry) => sum + entry.items.length, 0))

// Accordion: bitta vaqtda bitta bo'lim ochiq turadi (ichidagi matn ko'p).
const activeSection = ref('dashboard')
function toggle(id) { activeSection.value = activeSection.value === id ? '' : id }

// Bo'limga kirish uchun kerakli ruxsat(lar) — qaysi kalitga bog'langanini ko'rsatadi.
function sectionPermissions(section) {
  const keys = section.permission ? [section.permission] : (section.permissionAny ?? [])
  return keys.map(permissionLabel)
}
</script>

<template>
  <ModalDialog
    v-model="open"
    title="Foydalanish yo‘riqnasi"
    description="Qaysi bo‘limda qanday funksiyalar bor va ulardan qanday foydalanish — sizning ruxsatlaringiz asosida."
    width="max-w-3xl"
  >
    <div class="space-y-7">
      <!-- ── Umumiy ishlash tartibi ─────────────────────────────────────── -->
      <section>
        <h3 class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400"><Compass :size="13" /> Umumiy ishlash tartibi</h3>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <div v-for="(block, index) in basics" :key="block.title" class="rounded-2xl border border-line bg-canvas/70 p-4">
            <p class="flex items-center gap-2 text-xs font-bold text-ink"><component :is="basicsIcons[index]" :size="14" class="text-leaf" />{{ block.title }}</p>
            <ul class="mt-2.5 space-y-1.5">
              <li v-for="item in block.items" :key="item" class="flex gap-2 text-[11px] leading-[17px] text-muted">
                <span class="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-leaf"></span>
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- ── Bo'limlar: nima uchun kerak, imkoniyatlar, qadamli yo'riq ──── -->
      <section>
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400"><BookOpen :size="13" /> Bo‘limlar va funksiyalar</h3>
          <span class="text-[10px] font-semibold text-slate-400">Sizga ochiq {{ sections.length }} ta bo‘lim</span>
        </div>
        <p v-if="!sections.length" class="mt-3 rounded-2xl border border-dashed border-line px-4 py-6 text-center text-xs text-muted">
          Hozircha hech bir bo‘lim uchun ruxsatingiz yo‘q. Ruxsatlarni to‘liq huquqli xodim sozlaydi.
        </p>
        <div v-else class="mt-3 space-y-2">
          <article v-for="section in sections" :key="section.id" class="overflow-hidden rounded-2xl border border-line bg-white">
            <button class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-canvas" :aria-expanded="activeSection === section.id" @click="toggle(section.id)">
              <span class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-mint text-[11px] font-extrabold text-leaf">{{ section.title.slice(0, 1) }}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{{ section.eyebrow }}</span>
                <span class="block truncate text-xs font-bold text-ink">{{ section.title }}</span>
              </span>
              <span class="hidden max-w-[42%] truncate text-[11px] text-muted sm:block">{{ section.short }}</span>
              <ChevronDown :size="15" class="shrink-0 text-slate-400 transition-transform duration-200" :class="activeSection === section.id ? 'rotate-180' : ''" />
            </button>
            <Transition name="collapse">
              <div v-if="activeSection === section.id" class="collapse-wrap">
                <div class="collapse-body border-t border-line">
                  <div class="space-y-4 bg-white px-4 py-4">
                    <div>
                      <p class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Nima uchun kerak</p>
                      <p class="mt-1 text-[11px] leading-[18px] text-muted">{{ section.purpose }}</p>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400"><ListChecks :size="12" /> Nima qilinadi</p>
                        <ul class="mt-2 space-y-1.5">
                          <li v-for="action in section.actions" :key="action" class="flex gap-2 text-[11px] leading-[17px] text-ink/80">
                            <span class="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-leaf"></span>
                            <span>{{ action }}</span>
                          </li>
                        </ul>
                      </div>
                      <div>
                        <p class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400"><ArrowRight :size="12" /> Qanday foydalanish</p>
                        <ol class="mt-2 space-y-1.5">
                          <li v-for="(step, index) in section.steps" :key="step" class="flex gap-2 text-[11px] leading-[17px] text-ink/80">
                            <span class="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-mint text-[9px] font-bold text-leaf">{{ index + 1 }}</span>
                            <span>{{ step }}</span>
                          </li>
                        </ol>
                      </div>
                    </div>
                    <div class="rounded-xl bg-[#f3f8f4] px-3.5 py-3">
                      <p class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-leaf"><Lightbulb :size="12" /> Maslahatlar</p>
                      <ul class="mt-1.5 space-y-1.5">
                        <li v-for="tip in section.tips" :key="tip" class="flex gap-2 text-[11px] leading-[17px] text-muted">
                          <span class="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-leaf/60"></span>
                          <span>{{ tip }}</span>
                        </li>
                      </ul>
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                      <span class="text-[10px] font-semibold text-slate-400">Kirish uchun ruxsat:</span>
                      <span v-for="label in sectionPermissions(section)" :key="label" class="tag bg-mint text-leaf">{{ label }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </article>
        </div>
      </section>

      <!-- ── Ruxsatlar: katalogdan to'liq tushuntirilgan, dostupga qarab ── -->
      <section>
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400"><KeyRound :size="13" /> Ruxsatlar</h3>
          <span class="text-[10px] font-semibold text-slate-400">Sizda {{ grantedCount }} / {{ totalCount }} ta ruxsat bor</span>
        </div>
        <div class="mt-3 space-y-4">
          <div v-for="entry in permissionGroups" :key="entry.group">
            <p class="text-[11px] font-bold text-ink">{{ entry.group }}</p>
            <ul class="mt-1.5 space-y-1.5">
              <li
                v-for="item in entry.items"
                :key="item.key"
                class="flex items-start gap-2.5 rounded-xl border px-3 py-2"
                :class="item.granted ? 'border-mint bg-mint/60' : 'border-line bg-white'"
                :style="item.granted ? '' : 'opacity: .55'"
              >
                <component :is="item.granted ? CircleCheck : Circle" :size="14" class="mt-0.5 shrink-0" :class="item.granted ? 'text-leaf' : 'text-slate-300'" />
                <span class="min-w-0 flex-1">
                  <span class="block text-[11px] font-bold" :class="item.granted ? 'text-ink' : 'text-slate-400'">{{ item.label }}</span>
                  <span class="block text-[10px] leading-4 text-muted">{{ item.description }}</span>
                </span>
                <span v-if="!item.granted" class="tag mt-0.5 shrink-0 bg-slate-100 text-slate-400">berilmagan</span>
              </li>
            </ul>
          </div>
        </div>
        <p class="mt-3 text-[10px] leading-4 text-slate-400">
          Ruxsatlar lavozimga bog‘lanadi: yangi ruxsat berilganda bu ro‘yxat va tegishli bo‘limlar darhol yangilanadi.
          Oynani <kbd class="rounded border border-line bg-canvas px-1 py-0.5 text-[9px] font-bold text-slate-500">Esc</kbd> yoki tashqariga bosib yopish mumkin.
        </p>
      </section>
    </div>
  </ModalDialog>
</template>
