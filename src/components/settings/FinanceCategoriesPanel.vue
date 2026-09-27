<script setup>
import { computed, ref } from 'vue'
import { Plus, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, LockKeyhole, WalletCards } from 'lucide-vue-next'
import ModalDialog from '../ModalDialog.vue'
import TransactionCategoryForm from '../forms/TransactionCategoryForm.vue'
import { useQuarryStore } from '../../stores/quarry'

const store = useQuarryStore()
const showEditor = ref(false)
const editing = ref(null)
const direction = ref('out')
const saving = ref(false)

const incomeTypes = computed(() => store.categories.filter((item) => item.direction === 'in'))
const expenseTypes = computed(() => store.categories.filter((item) => item.direction === 'out'))

function openCreate(nextDirection) {
  direction.value = nextDirection
  editing.value = null
  showEditor.value = true
}
function openEdit(category) {
  direction.value = category.direction
  editing.value = { ...category }
  showEditor.value = true
}
async function save(payload) {
  saving.value = true
  try {
    if (editing.value) await store.updateCategory(editing.value.id, payload)
    else await store.createCategory(payload)
    showEditor.value = false
  } catch (error) {
    store.notify(error.message || 'Moliya turini saqlab bo‘lmadi.', 'error')
  } finally {
    saving.value = false
  }
}
async function remove(category) {
  // Tizim turlari uchun confirm kerak emas: store baribir tushunarli xato qaytaradi.
  if (!category.isSystem && !window.confirm(`“${category.label}” turi o‘chirilsinmi?`)) return
  try {
    await store.deleteCategory(category.id)
  } catch (error) {
    store.notify(error.message || 'Moliya turini o‘chirib bo‘lmadi.', 'error')
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="grid gap-5 lg:grid-cols-2">
      <section
        v-for="group in [
          { direction: 'in', title: 'Daromat turlari', subtitle: 'Kassaga va bankga tushadigan pul', items: incomeTypes },
          { direction: 'out', title: 'Xarajat turlari', subtitle: 'Karer xarajatlari va ish haqi to‘lovlari', items: expenseTypes },
        ]"
        :key="group.direction"
        class="card overflow-hidden"
      >
        <div class="flex items-center justify-between border-b border-line px-5 py-4">
          <div class="flex items-start gap-3">
            <div class="grid h-9 w-9 place-items-center rounded-xl" :class="group.direction === 'in' ? 'bg-[#eaf5ee] text-leaf' : 'bg-[#fff4e3] text-amber'">
              <component :is="group.direction === 'in' ? ArrowDownLeft : ArrowUpRight" :size="17" />
            </div>
            <div>
              <h2 class="section-title">{{ group.title }}</h2>
              <p class="mt-1 text-xs text-muted">{{ group.subtitle }} · {{ group.items.length }} ta</p>
            </div>
          </div>
          <button class="btn-secondary !px-3 !py-2 text-[11px]" @click="openCreate(group.direction)"><Plus :size="14" /> Yangi</button>
        </div>

        <div class="divide-y divide-[#f0f2f0]">
          <div v-for="category in group.items" :key="category.id" class="flex items-center gap-3 px-5 py-3.5">
            <div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl" :class="group.direction === 'in' ? 'bg-[#eaf5ee] text-leaf' : 'bg-[#fff4e3] text-amber'">
              <component :is="group.direction === 'in' ? ArrowDownLeft : ArrowUpRight" :size="16" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="truncate text-sm font-bold text-ink">{{ category.label }}</p>
                <span v-if="category.isSystem" class="tag tag-blue"><LockKeyhole :size="10" class="mr-1" />Tizim turi</span>
                <span v-if="category.needsClient" class="tag tag-credit">Mijoz</span>
                <span v-if="category.needsVehicle" class="tag tag-credit">Texnika</span>
                <span v-if="category.needsDriver" class="tag tag-credit">Haydovchi</span>
              </div>
              <p class="mt-0.5 truncate text-[11px] text-muted">{{ category.hint || 'Izoh kiritilmagan.' }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <button class="btn-quiet !p-2" :aria-label="`${category.label} turini tahrirlash`" @click="openEdit(category)"><Pencil :size="14" /></button>
              <button class="btn-quiet !p-2 !text-danger" :aria-label="`${category.label} turini o‘chirish`" @click="remove(category)"><Trash2 :size="14" /></button>
            </div>
          </div>
          <div v-if="!group.items.length" class="px-5 py-10 text-center text-sm text-muted">Hali turi yaratilmagan.</div>
        </div>
      </section>
    </div>

    <div class="flex items-start gap-3 rounded-2xl border border-[#cfe0d3] bg-[#f2f8f3] p-4">
      <div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-leaf"><WalletCards :size="17" /></div>
      <div>
        <p class="text-xs font-bold text-forest">Xavfsizlik qoidasi</p>
        <p class="mt-1 text-[11px] leading-5 text-[#66816e]">Tizim turlari (Naqd savdo, Mijoz to‘lovi, Yoqilg‘i va h.k.) o‘chirilmaydi. Yaratilgan turi esa biror reys yoki to‘lovda ishlatilgan bo‘lsa, bazada bloklanadi va necha marta ishlatilgani sabab sifatida ko‘rsatiladi. Nomni tahrirlash xavfsiz: yozuvlar eski kalitda qoladi.</p>
      </div>
    </div>

    <ModalDialog
      v-model="showEditor"
      :title="editing ? 'Moliya turini tahrirlash' : 'Yangi moliya turi'"
      description="Bu turlar Moliya sahifasidagi kirim va chiqim formlarida paydo bo‘ladi."
      width="max-w-xl"
    >
      <TransactionCategoryForm
        :key="editing?.id || `new-${direction}`"
        :category="editing"
        :default-direction="direction"
        :loading="saving"
        @submit="save"
        @cancel="showEditor = false"
      />
    </ModalDialog>
  </div>
</template>
