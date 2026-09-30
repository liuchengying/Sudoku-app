import { ref } from 'vue'
import { defineStore } from 'pinia'
import { historyRepository } from '@/repositories/history.repository'
import type { GameRecord } from '@/types/progress'

export const useHistoryStore = defineStore('history', () => {
  const records = ref<GameRecord[]>(historyRepository.list())

  function refresh() {
    records.value = historyRepository.list()
  }

  function add(record: Omit<GameRecord, 'serialNo'> & { serialNo?: number }) {
    const saved = historyRepository.add(record)
    records.value = historyRepository.list()
    return saved
  }

  function remove(id: string) {
    historyRepository.remove(id)
    records.value = historyRepository.list()
  }

  function clear() {
    historyRepository.clear()
    records.value = []
  }

  function find(id: string): GameRecord | null {
    return records.value.find((record) => record.id === id) ?? historyRepository.findById(id)
  }

  return { records, refresh, add, remove, clear, find }
})
