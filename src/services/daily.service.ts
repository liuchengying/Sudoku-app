import { localDate } from './puzzle.service'
export function previousDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return localDate(new Date(y, m - 1, d - 1, 12))
}
export function streaks(dates: string[], today = localDate()) {
  const days = [...new Set(dates)].filter(d => d <= today).sort()
  const set = new Set(days)
  let current = 0, best = 0, run = 0, previous = ''
  for (const day of days) { run = previous === previousDate(day) ? run + 1 : 1; best = Math.max(best, run); previous = day }
  let cursor = set.has(today) ? today : previousDate(today)
  while (set.has(cursor)) { current++; cursor = previousDate(cursor) }
  return { current, best }
}
