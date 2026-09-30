export type TutorialSection = 'rules' | 'basic' | 'advanced'

export interface TutorialArticle {
  id: string
  section: TutorialSection
  title: string
  summary: string
  paragraphs: string[]
  tips?: string[]
}

export const TUTORIAL_ARTICLES: TutorialArticle[] = [
  {
    id: 'rules', section: 'rules', title: '数独玩法', summary: '经典 9×9 数独的目标与规则',
    paragraphs: [
      '棋盘由 9 行、9 列组成，并被粗线分成 9 个 3×3 宫。目标是在所有空格中填入 1 到 9。',
      '每一行必须恰好包含 1 到 9，每一列也必须恰好包含 1 到 9；每个 3×3 宫同样必须包含 1 到 9。因此同一行、同一列或同一宫不能重复数字。',
      '标准数独只依赖逻辑，不需要算术。应用内所有固定关卡都经过唯一解校验。'
    ],
    tips: ['黑色数字是题目给定数字，不能修改。', '蓝色数字是你的填写；红色数字表示即时错误提示。', '候选数字只是笔记，不会直接计入答案。']
  },
  {
    id: 'controls', section: 'rules', title: '操作说明', summary: '候选、草稿、擦除、提示与暂停',
    paragraphs: [
      '先点选棋盘格，再使用底部数字键。上方蓝色数字行用于直接增删候选；下方数字行用于填写答案。',
      '打开“草稿”后，下方数字行也进入候选输入模式，适合连续记录候选。再次点击草稿可恢复普通填写。',
      '“候选”会为当前空格自动计算合法候选；长按“候选”可为所有空格填充候选。设置中开启自动删除候选后，正确填写数字会同步清理相关格的候选。',
      '“解法”会优先给出逻辑提示。如果当前选中了空格，也可以直接查看该格的答案。使用提示会被记录在成绩中。',
      '切到后台默认自动暂停。错误次数和提示次数不会因为撤销而减少。'
    ]
  },
  {
    id: 'naked-single', section: 'basic', title: '唯一候选', summary: '某格只剩一个合法候选',
    paragraphs: ['观察一个空格所在的行、列和宫，把已经出现的数字全部排除。如果最后只剩一个候选，这个候选就是该格答案。', '唯一候选是最基础、也是大量复杂技巧最终落地时最常出现的步骤。'],
    tips: ['先扫描候选数量最少的格子。', '每填入一个数字后重新检查同行、同列和同宫。']
  },
  {
    id: 'hidden-single', section: 'basic', title: '隐藏唯一', summary: '某数字在一个单位中只剩一个位置',
    paragraphs: ['一个格可能还有多个候选，但某个数字在整行、整列或整个宫中只有这个格可以出现时，该数字仍然可以确定。', '它“隐藏”在多个候选之中，所以叫隐藏唯一。']
  },
  {
    id: 'locked-candidate', section: 'basic', title: '区块排除', summary: '宫与行列之间互相锁定候选',
    paragraphs: ['如果某个数字在一个 3×3 宫里的候选位置全部落在同一行，那么这行在其他宫中的该数字候选都可以删除。列方向完全相同。', '反过来，如果一行中某个数字的所有候选都落在同一个宫，也可以从该宫的其他格删除这个候选。']
  },
  {
    id: 'notes', section: 'basic', title: '候选数记法', summary: '用 3×3 小数字记录可能性',
    paragraphs: ['候选数是尚未被行、列、宫规则排除的数字。困难题中，稳定维护候选是识别数对、数组和鱼形结构的基础。', '本应用支持手动候选、单格自动候选和全盘候选。开启“智能草稿”后，不合法的候选不会被加入。']
  },
  {
    id: 'naked-pair', section: 'advanced', title: '裸对', summary: '两个格锁定两个候选',
    paragraphs: ['同一行、列或宫中，如果两个格恰好都只包含相同的两个候选，那么这两个数字必然分别占据这两个格。', '因此，该单位其他格中的这两个候选都可以删除。']
  },
  {
    id: 'hidden-pair', section: 'advanced', title: '隐藏对', summary: '两个数字只出现在同两个格',
    paragraphs: ['如果两个数字在某一行、列或宫中都只能出现在相同的两个格，即使这两个格还有其他候选，这两个数字也已经被锁定。', '因此可以删除这两个格中的其他候选，只保留这两个数字。']
  },
  {
    id: 'naked-triple', section: 'advanced', title: '裸三数组', summary: '三个格锁定三个候选',
    paragraphs: ['在同一单位中，三个格的候选并集恰好只有三个数字时，这三个数字一定被这三个格占用。', '可以从该单位其他格删除这三个数字。三个格不要求每个都有三个候选，例如 {1,2}、{1,3}、{2,3} 也构成裸三数组。']
  },
  {
    id: 'x-wing', section: 'advanced', title: 'X-Wing', summary: '两行两列形成矩形锁定',
    paragraphs: ['关注某个数字：如果它在两行中都恰好只能出现在相同的两列，那么这四个候选构成一个矩形。', '无论两行分别选择哪一个端点，这两列都已经各自占用该数字，因此可从这两列的其他行删除该候选。列方向也可以反向使用。']
  },
  {
    id: 'swordfish', section: 'advanced', title: 'Swordfish', summary: 'X-Wing 的三行三列扩展',
    paragraphs: ['Swordfish 把 X-Wing 从两行两列扩展到三行三列。某数字在三行中的所有候选位置只覆盖三列时，可以从这三列的其他行删除该数字。', '这种结构较少出现，通常需要完整候选表才能稳定识别。']
  },
  {
    id: 'xy-wing', section: 'advanced', title: 'XY-Wing', summary: '三个双候选格的枢轴排除',
    paragraphs: ['XY-Wing 由三个双候选格组成：枢轴为 XY，两个翼分别为 XZ 与 YZ，并且两个翼都能看到枢轴。', '无论枢轴最终取 X 还是 Y，两个翼中至少有一个必须取 Z，因此同时能看到两个翼的格子可以删除候选 Z。']
  }
]

export const TUTORIAL_SECTIONS: { id: TutorialSection; title: string; subtitle: string }[] = [
  { id: 'rules', title: '玩法', subtitle: '规则与应用操作' },
  { id: 'basic', title: '基础技巧', subtitle: '从唯一候选到区块排除' },
  { id: 'advanced', title: '高级技巧', subtitle: '数对、数组与鱼形结构' }
]

export function getTutorialArticle(id: string): TutorialArticle | undefined {
  return TUTORIAL_ARTICLES.find((article) => article.id === id)
}
