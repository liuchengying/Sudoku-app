const bases = [
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
  '000260701680070090190004500820100040004602900050003028009300074040050036703018000',
  '300000000005009000200504000020000700160000058704310600000890100000067080000005437'
]

function valid(board) {
  for (let i = 0; i < 81; i++) {
    if (!board[i]) continue
    const r = Math.floor(i / 9), c = i % 9, br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3
    for (let j = 0; j < 9; j++) {
      if (r * 9 + j !== i && board[r * 9 + j] === board[i]) return false
      if (j * 9 + c !== i && board[j * 9 + c] === board[i]) return false
    }
    for (let rr = br; rr < br + 3; rr++) for (let cc = bc; cc < bc + 3; cc++) {
      const k = rr * 9 + cc
      if (k !== i && board[k] === board[i]) return false
    }
  }
  return true
}

function candidates(board, i) {
  const used = new Set()
  const r = Math.floor(i / 9), c = i % 9, br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3
  for (let j = 0; j < 9; j++) { used.add(board[r * 9 + j]); used.add(board[j * 9 + c]) }
  for (let rr = br; rr < br + 3; rr++) for (let cc = bc; cc < bc + 3; cc++) used.add(board[rr * 9 + cc])
  return Array.from({length: 9}, (_, k) => k + 1).filter(d => !used.has(d))
}

function countSolutions(input, limit = 2) {
  if (!valid(input)) return 0
  const board = [...input]
  let count = 0
  function search() {
    if (count >= limit) return
    let best = -1, bestCandidates = null
    for (let i = 0; i < 81; i++) if (board[i] === 0) {
      const cs = candidates(board, i)
      if (!cs.length) return
      if (bestCandidates === null || cs.length < bestCandidates.length) { best = i; bestCandidates = cs; if (cs.length === 1) break }
    }
    if (best === -1) { count++; return }
    for (const d of bestCandidates) { board[best] = d; search(); board[best] = 0; if (count >= limit) return }
  }
  search()
  return count
}

for (const [index, text] of bases.entries()) {
  const board = [...text].map(Number)
  const count = countSolutions(board, 2)
  if (count !== 1) throw new Error(`base ${index + 1} solution count = ${count}`)
  console.log(`base ${index + 1}: valid, unique solution`)
}
