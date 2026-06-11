import type { ActivityData } from '../types'

export const activityData: ActivityData[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (29 - i))
  const ds = date.toISOString().slice(0, 10)

  const base = Math.sin(i * 0.3) * 0.3 + 0.7
  const noise = (Math.random() - 0.5) * 0.2

  return {
    date: ds,
    spend: +(base + noise) * 15 + 5,
    requests: Math.floor((base + noise) * 2000 + 500),
    tokens: Math.floor((base + noise) * 150000 + 30000),
  }
})

export const pieData = [
  { name: 'GPT-4o', value: 35, color: '#10b981' },
  { name: 'Claude Sonnet 4.6', value: 28, color: '#6366f1' },
  { name: 'Gemini 2.5 Pro', value: 18, color: '#3b82f6' },
  { name: 'DeepSeek V3', value: 12, color: '#8b5cf6' },
  { name: '其他', value: 7, color: '#6b7280' },
]
