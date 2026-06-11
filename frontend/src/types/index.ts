export interface AIModel {
  id: string
  name: string
  provider: string
  description: string
  contextLength: number
  maxOutput: number
  inputPrice: number
  outputPrice: number
  capabilities: string[]
  category: string
  isFree: boolean
  rating: number
  benchmarkScores: Record<string, number>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  timestamp: number
}

export interface ChatRoom {
  id: string
  name: string
  model: string
  messages: ChatMessage[]
  createdAt: number
}

export interface ActivityData {
  date: string
  spend: number
  requests: number
  tokens: number
}

export interface RankingApp {
  rank: number
  name: string
  tokens: number
  change: number
  category: string
}
