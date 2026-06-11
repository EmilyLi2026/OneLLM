import type { RankingApp } from '../types'

export const dailyRankings: RankingApp[] = [
  { rank: 1, name: 'ChatGPT Next Web', tokens: 12_500_000, change: 0, category: '聊天应用' },
  { rank: 2, name: 'Cursor AI', tokens: 10_200_000, change: 1, category: '编程助手' },
  { rank: 3, name: 'Open WebUI', tokens: 8_900_000, change: -1, category: '聊天应用' },
  { rank: 4, name: 'Copilot Kit', tokens: 7_450_000, change: 2, category: '编程助手' },
  { rank: 5, name: 'LangChain', tokens: 6_800_000, change: -1, category: '框架' },
  { rank: 6, name: '文心一言插件', tokens: 5_200_000, change: 3, category: '聊天应用' },
  { rank: 7, name: 'Dify', tokens: 4_900_000, change: -2, category: '低代码平台' },
  { rank: 8, name: 'Lobe Chat', tokens: 4_100_000, change: -1, category: '聊天应用' },
  { rank: 9, name: 'Jan AI', tokens: 3_600_000, change: 1, category: '本地客户端' },
  { rank: 10, name: 'CodeGPT', tokens: 2_800_000, change: -2, category: '编程助手' },
]

export const weeklyRankings: RankingApp[] = [
  { rank: 1, name: 'Cursor AI', tokens: 78_000_000, change: 1, category: '编程助手' },
  { rank: 2, name: 'ChatGPT Next Web', tokens: 72_500_000, change: -1, category: '聊天应用' },
  { rank: 3, name: 'Open WebUI', tokens: 56_000_000, change: 0, category: '聊天应用' },
  { rank: 4, name: 'LangChain', tokens: 48_300_000, change: 0, category: '框架' },
  { rank: 5, name: 'Dify', tokens: 35_700_000, change: 2, category: '低代码平台' },
  { rank: 6, name: 'Copilot Kit', tokens: 32_100_000, change: -1, category: '编程助手' },
  { rank: 7, name: 'Lobe Chat', tokens: 28_400_000, change: -1, category: '聊天应用' },
  { rank: 8, name: '文心一言插件', tokens: 22_000_000, change: 0, category: '聊天应用' },
  { rank: 9, name: 'Jan AI', tokens: 18_500_000, change: 1, category: '本地客户端' },
  { rank: 10, name: 'FastGPT', tokens: 15_200_000, change: -1, category: '低代码平台' },
]

export const monthlyRankings: RankingApp[] = [
  { rank: 1, name: 'Cursor AI', tokens: 310_000_000, change: 0, category: '编程助手' },
  { rank: 2, name: 'ChatGPT Next Web', tokens: 285_000_000, change: 0, category: '聊天应用' },
  { rank: 3, name: 'Open WebUI', tokens: 220_000_000, change: 1, category: '聊天应用' },
  { rank: 4, name: 'LangChain', tokens: 195_000_000, change: -1, category: '框架' },
  { rank: 5, name: 'Dify', tokens: 140_000_000, change: 0, category: '低代码平台' },
  { rank: 6, name: 'Lobe Chat', tokens: 115_000_000, change: 0, category: '聊天应用' },
  { rank: 7, name: 'Copilot Kit', tokens: 95_000_000, change: 1, category: '编程助手' },
  { rank: 8, name: '文心一言插件', tokens: 82_000_000, change: -1, category: '聊天应用' },
  { rank: 9, name: 'FastGPT', tokens: 65_000_000, change: 0, category: '低代码平台' },
  { rank: 10, name: 'Jan AI', tokens: 50_000_000, change: 0, category: '本地客户端' },
]
