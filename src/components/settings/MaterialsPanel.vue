<script setup>
import { computed, reactive, ref } from 'vue'
import { Package, Plus, Trash2, Check } from 'lucide-vue-next'
import { useQuarryStore } from '../../stores/quarry'
import { formatAmountInput, parseAmountInput, captureAmountInput, money } from '../../lib/format'

const store = useQuarryStore()
// materials.create — faqat qo'shish formasi; materials.manage — narx, faollik va o'chirish.
const canManage = computed(() => store.can('materials.manage'))
const addForm = reactive({ name: '', unitPrice: '' })
const priceDraft = reactive({})
const saving = ref(false)

const onPrice = (event, materialId) => captureAmountInput(event, (value) => { priceDraft[materialId] = value })
const onNewPrice = (event) => captureAmountInput(event, (value) => { addForm.unitPrice = value })

function fail(message) { store.notify(message || 'Amalni bajarib bo‘lmadi.', 'error') }

async function addMaterial() {
  saving.value = true
  try {
    await store.createMaterial({ name: addForm.name, unitPrice: parseAmountInput(addForm.unitPrice) })
    addForm.name = ''
    addForm.unitPrice = ''
  } catch (error) { fail(error.message) } finally { saving.value = false }
}
async function savePrice(material) {
  try {
    await store.updateMaterial(material.id, parseAmountInput(priceDraft[material.id]))
    delete priceDraft[material.id]
  } catch (error) { fail(error.message) }
}
async function removeMaterial(material) {
  if (!window.confirm(`“${material.name}” mahsuloti o‘chirilsinmi?`)) return
  try { await store.deleteMaterial(material.id) } catch (error) { fail(error.message) }
}
</script>

<template>
  <div class="grid gap-5 lg:grid-cols-12">
    <section class="card overflow-hidden lg:col-span-8">
      <div class="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 class="section-title">Mahsulotlar va tonna narxlari</h2>
        </div>
        <div class="grid h-9 w-9 place-items-center rounded-xl bg-mint text-leaf"><Package :size="17" /></div>
      </div>

      <div v-if="!canManage" class="flex items-start gap-2 border-b border-line bg-[#fbfcfb] px-5 py-3 text-[10px] leading-4 text-muted">
        <span class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf"></span>
        Sizga faqat mahsulot qo‘shish ruxsati berilgan. Narx o‘zgartirish va o‘chirish uchun
        “Mahsulotlarni boshqarish” ruxsati kerak — uni superadmin Sozlamalar → Lavozimlar orqali beradi.
      </div>

      <div class="divide-y divide-[#f0f2f0]">
        <div v-for="material in store.materials" :key="material.id" class="flex flex-wrap items-center gap-4 px-5 py-4">
          <div class="grid h-10 w-10 place-items-center rounded-xl bg-canvas text-muted"><Package :size="17" /></div>
          <div class="min-w-[140px] flex-1">
            <p class="text-sm font-bold text-ink">{{ material.name }}</p>
            <p class="mt-1 text-[10px] text-muted">{{ material.isActive ? 'Sotuvda' : 'Faol emas' }} · narx bir tonna uchun</p>
          </div>
          <div v-if="canManage" class="flex items-center gap-2">
            <div class="relative">
              <input :value="priceDraft[material.id] ?? ''" :placeholder="formatAmountInput(material.unitPrice)" class="field !w-[170px] !py-2.5 !pr-14 text-right font-semibold" type="text" inputmode="numeric" autocomplete="off" @input="onPrice($event, material.id)" />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted">so‘m / t</span>
            </div>
            <button class="btn-primary !px-3 !py-2.5" :disabled="!(parseAmountInput(priceDraft[material.id]) > 0)" @click="savePrice(material)"><Check :size="15" /> Saqlash</button>
            <button class="btn-quiet !p-2.5 !text-danger" :aria-label="`${material.name} mahsulotini o‘chirish`" @click="removeMaterial(material)"><Trash2 :size="15" /></button>
          </div>
          <div v-else class="text-right">
            <p class="text-sm font-bold text-ink">{{ money(material.unitPrice) }} <span class="text-[10px] font-normal text-muted">/ t</span></p>
          </div>
        </div>
        <div v-if="!store.materials.length" class="px-5 py-10 text-center text-sm text-muted">Hali mahsulot qo‘shilmagan.</div>
      </div>

      <div class="flex items-start gap-2 border-t border-line bg-[#fbfcfb] px-5 py-3 text-[10px] leading-4 text-muted">
        <span class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber"></span>
        Yangi narx kelgusi reyslarga ta’sir qiladi. Oldin tasdiqlangan reyslar summasi o‘zgarmaydi.
      </div>
    </section>

    <aside class="space-y-4 lg:col-span-4">
      <section class="card p-5">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="section-title">Mahsulot qo‘shish</h2>
          </div>
          <div class="grid h-9 w-9 place-items-center rounded-xl bg-mint text-leaf"><Plus :size="17" /></div>
        </div>
        <form class="mt-4 space-y-3" @submit.prevent="addMaterial">
          <label><span class="label">Mahsulot nomi</span><input v-model="addForm.name" class="field" maxlength="60" placeholder="Masalan, Qum 0–5" required /></label>
          <label><span class="label">Tonna narxi</span>
            <div class="relative">
              <input :value="addForm.unitPrice" class="field pr-16" type="text" inputmode="numeric" autocomplete="off" placeholder="0" required @input="onNewPrice" />
              <span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">so‘m / t</span>
            </div>
          </label>
          <button class="btn-primary w-full" :disabled="saving"><Plus :size="16" /> {{ saving ? 'Qo‘shilmoqda…' : 'Mahsulot qo‘shish' }}</button>
        </form>
      </section>
    </aside>
  </div>
</template>
