import { ref } from 'vue'
import { defineStore } from 'pinia'
import { historyRepository } from '@/repositories/history.repository'
import { resultsRepository, emptyTotals } from '@/repositories/results.repository'
import type { GameRecord } from '@/types/progress'

export const useHistoryStore = defineStore('history', () => {
  const totals = ref(emptyTotals())
  const dailyDates = ref<string[]>([])
  const records = ref<GameRecord[]>(historyRepository.list())

  function refresh() {
    const state = resultsRepository.load()
    records.value = state.history
    totals.value = state.totals
    dailyDates.value = state.dailyDates
  }

  function add(record: Omit<GameRecord, 'serialNo'> & { serialNo?: number }) {
    const saved = historyRepository.add(record)
    const state = resultsRepository.load()
    records.value = state.history
    totals.value = state.totals
    dailyDates.value = state.dailyDates
    return saved
  }

  function remove(id: string) {
    historyRepository.remove(id)
    const state = resultsRepository.load()
    records.value = state.history
    totals.value = state.totals
    dailyDates.value = state.dailyDates
  }

  function clear() {
    historyRepository.clear()
    refresh()
  }

  function find(id: string): GameRecord | null {
    return records.value.find((record) => record.id === id) ?? historyRepository.findById(id)
  }

  refresh()
  return { totals, dailyDates, records, refresh, add, remove, clear, find }
})
