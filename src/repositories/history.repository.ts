import type { GameRecord } from '@/types/progress'
import { resultsRepository } from './results.repository'
export const historyRepository = {
  list: () => resultsRepository.load().history,
  add: (record: Omit<GameRecord, 'serialNo'> & { serialNo?: number }) => resultsRepository.addRecord(record),
  findById: (id: string) => resultsRepository.load().history.find(r => r.id === id) ?? null,
  remove: (id: string) => resultsRepository.removeRecord(id),
  clear: () => resultsRepository.clearHistory()
}
