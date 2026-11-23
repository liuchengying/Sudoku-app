import { colOf, peerIndexes, rowOf } from './board'
import { digitBit, maskToDigits, popCount } from './candidate'
import type { CandidateElimination, LogicalStep } from './types'

export const CHAIN_TECHNIQUES = ['X_CHAIN', 'XY_CHAIN', 'AIC'] as const
type ChainTechnique = typeof CHAIN_TECHNIQUES[number]
const MAX_LINKS = 11
const CANDIDATE_COUNT = 81 * 9
const PEERS = Array.from({ length: 81 }, (_, index) => peerIndexes(index))
const cellOf = (candidate: number) => Math.floor(candidate / 9)
const digitOf = (candidate: number) => candidate % 9 + 1

export function findXYWing(candidates: number[]): LogicalStep | null {
  const pairs = candidates.map(mask => popCount(mask) === 2 ? mask : 0)
  for (let pivot = 0; pivot < 81; pivot++) {
    if (!pairs[pivot]) continue
    for (const first of PEERS[pivot]) {
      const shared = pairs[pivot] & pairs[first]
      const outside = pairs[first] & ~pairs[pivot]
      if (popCount(shared) !== 1 || !outside) continue
      const secondMask = (pairs[pivot] ^ shared) | outside
      for (const second of PEERS[pivot]) {
        if (second <= first || pairs[second] !== secondMask) continue
        const eliminations = PEERS[first].filter(index => PEERS[second].includes(index) && (candidates[index] & outside))
          .map(index => ({ index, mask: outside }))
        if (eliminations.length) return {
          technique: 'XY_WING',
          kind: 'ELIMINATE',
          eliminations,
          message: `以 R${rowOf(pivot) + 1}C${colOf(pivot) + 1} 为枢轴，可从同时看见两个翼的格删除 ${maskToDigits(outside)[0]}`
        }
      }
    }
  }
  return null
}

interface Links {
  nodes: number[]
  strong: number[][]
  weak: number[][]
}

function buildLinks(candidates: number[], units: number[][]): Links {
  const strong: number[][] = []
  const weak: number[][] = []
  const nodes: number[] = []
  const digits = candidates.map(maskToDigits)
  function connect(a: number, b: number) {
    if (!strong[a].includes(b)) {
      strong[a].push(b)
      strong[b].push(a)
    }
  }
  for (let cell = 0; cell < 81; cell++) {
    for (const digit of digits[cell]) {
      const candidate = cell * 9 + digit - 1
      nodes.push(candidate)
      strong[candidate] = []
      weak[candidate] = digits[cell].filter(other => digit !== other).map(other => cell * 9 + other - 1)
      for (const peer of PEERS[cell]) {
        if (candidates[peer] & digitBit(digit)) weak[candidate].push(peer * 9 + digit - 1)
      }
    }
    if (digits[cell].length === 2) connect(cell * 9 + digits[cell][0] - 1, cell * 9 + digits[cell][1] - 1)
  }
  for (const unit of units) {
    for (let digit = 1; digit <= 9; digit++) {
      const positions = unit.filter(index => candidates[index] & digitBit(digit))
      if (positions.length === 2) connect(positions[0] * 9 + digit - 1, positions[1] * 9 + digit - 1)
    }
  }
  return { nodes, strong, weak }
}

function allowsLink(technique: ChainTechnique, strong: boolean, from: number, to: number): boolean {
  if (technique === 'AIC') return true
  if (technique === 'XY_CHAIN' && strong) return cellOf(from) === cellOf(to)
  return digitOf(from) === digitOf(to)
}

function traceChain(end: number, previous: Int16Array): NonNullable<LogicalStep['chain']> {
  const chain: NonNullable<LogicalStep['chain']> = []
  for (let literal = end; literal >= 0; literal = previous[literal]) {
    const candidate = literal >> 1
    chain.push({ index: cellOf(candidate), digit: digitOf(candidate) })
  }
  return chain.reverse()
}

function chainMove(links: Links, start: number, end: number, previous: Int16Array, technique: ChainTechnique): LogicalStep | null {
  const target = end >> 1
  const eliminations: CandidateElimination[] = []
  for (const candidate of links.weak[start]) {
    if (links.weak[target].includes(candidate)) {
      eliminations.push({ index: cellOf(candidate), mask: digitBit(digitOf(candidate)) })
    }
  }
  if (target !== start && !eliminations.length) return null
  const chain = traceChain(end, previous)
  // The first link is strong. At least one endpoint must be true.
  const notation = chain.map(({ index, digit }, i) =>
    `${i === 0 ? '' : i % 2 ? ' = ' : ' – '}R${rowOf(index) + 1}C${colOf(index) + 1}(${digit})`).join('')
  if (target === start) return {
    technique, kind: 'PLACE', index: cellOf(start), digit: digitOf(start), chain,
    message: `${notation}。同一候选出现在两端，因此该候选成立`
  }
  const removed = eliminations.map(({ index, mask }) => `R${rowOf(index) + 1}C${colOf(index) + 1}(${maskToDigits(mask)[0]})`)
  return {
    technique, kind: 'ELIMINATE', eliminations, chain,
    message: `${notation}。两端至少一个成立，可删除 ${removed.join('、')}`
  }
}

export function* chainMoves(candidates: number[], units: number[][]): Generator<LogicalStep, void> {
  const links = buildLinks(candidates, units)
  const previous = new Int16Array(CANDIDATE_COUNT * 2)
  const depth = new Uint8Array(previous.length)
  const queue = new Int16Array(previous.length)
  for (const technique of CHAIN_TECHNIQUES) {
    for (const start of links.nodes) {
      if (!links.strong[start].length) continue
      // A false candidate implies a true neighbor across a strong link.
      // A true candidate implies a false neighbor across a weak link.
      previous.fill(-2)
      const first = start * 2
      previous[first] = -1
      depth[first] = 0
      queue[0] = first
      let tail = 1
      for (let head = 0; head < tail; head++) {
        const current = queue[head]
        const candidate = current >> 1
        const isTrue = (current & 1) === 1
        const length = depth[current]
        const sameDigit = digitOf(candidate) === digitOf(start)
        if (isTrue && length >= 3 && candidate >= start && (technique !== 'XY_CHAIN' || sameDigit)) {
          const step = chainMove(links, start, current, previous, technique)
          if (step) yield step
        }
        if (length === MAX_LINKS) continue
        const neighbors = isTrue ? links.weak[candidate] : links.strong[candidate]
        for (const other of neighbors) {
          const next = other * 2 + Number(!isTrue)
          if (previous[next] !== -2 || !allowsLink(technique, !isTrue, candidate, other)) continue
          previous[next] = current
          depth[next] = length + 1
          queue[tail++] = next
        }
      }
    }
  }
}
