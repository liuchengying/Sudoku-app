export interface DifficultyConfig {
  id: string
  name: string
  score: number
  order: number
  subtitle: string
}

export const DIFFICULTIES: DifficultyConfig[] = [
  { id: 'master', name: '大师', score: 2000, order: 1, subtitle: '进阶逻辑训练' },
  { id: 'king', name: '王者', score: 4000, order: 2, subtitle: '高级逻辑挑战' },
  { id: 'grandmaster', name: '宗师', score: 10000, order: 3, subtitle: '极限数独挑战' }
]

export function getDifficulty(id: string): DifficultyConfig {
  const difficulty = DIFFICULTIES.find((item) => item.id === id)
  if (!difficulty) throw new Error(`Unknown difficulty: ${id}`)
  return difficulty
}
