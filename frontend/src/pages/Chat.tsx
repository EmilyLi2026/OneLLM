import { useState, useRef, useEffect } from 'react'
import type { ChatRoom, ChatMessage } from '../types'
import { models } from '../mock/models'
import { Plus, Trash2, Send, Bot, User, Copy, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

function createRoom(): ChatRoom {
  const id = Math.random().toString(36).slice(2, 10)
  return {
    id,
    name: '新对话',
    model: models[0].id,
    messages: [
      {
        id: 'sys-' + id,
        role: 'system',
        content: `这是一个 Demo 对话演示。选择的模型是 ${models[0].name}。在实际产品中，这里将连接真实 API。`,
        timestamp: Date.now(),
      },
    ],
    createdAt: Date.now(),
  }
}

const demoReplies: Record<string, string> = {
  '你好': '你好！我是 AI 助手。这是一个 Demo 演示页面，展示对话游乐场的 UI 交互。在实际产品中，这里会连接真实的 AI 模型 API。\n\n你可以尝试输入以下内容：\n- "介绍一下你自己"\n- "写一段代码"\n- "翻译一段文字"',
  '介绍一下你自己': '我是基于大语言模型的 AI 助手。本页面是 **OneLLM** 平台的对话游乐场 Demo。\n\n### 主要特性\n- 多模型支持（GPT-4o、Claude、Gemini 等）\n- Markdown 渲染\n- 多房间对话管理\n- 代码高亮\n\n> 这只是一个前端演示，不包含实际 API 调用。',
  '写一段代码': '当然！以下是一个简单的 Python 快速排序实现：\n\n```python\ndef quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quicksort(left) + middle + quicksort(right)\n\n# 测试\nprint(quicksort([3, 6, 8, 10, 1, 2, 1]))\n```\n\n时间复杂度：O(n log n)，空间复杂度：O(n)。',
  '翻译一段文字': '好的，请将以下英文翻译为中文：\n\n**原文:** "Artificial intelligence is transforming every walk of life. With the rise of large language models, we are witnessing a paradigm shift in how humans interact with machines."\n\n**翻译:** "人工智能正在改变各行各业。随着大语言模型的兴起，我们正见证人机交互方式的范式转变。"',
}

const defaultReply =
  '这是一个 Demo 演示页面。输入 "你好"、"介绍一下你自己"、"写一段代码" 或 "翻译一段文字" 来查看预设的回复效果。\n\n在实际产品中，这里会连接 OpenRouter API 进行真实的 AI 对话。'

export default function Chat() {
  const [rooms, setRooms] = useState<ChatRoom[]>([createRoom()])
  const [activeRoomId, setActiveRoomId] = useState(rooms[0].id)
  const [input, setInput] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? rooms[0]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeRoom?.messages])

  const addRoom = () => {
    const room = createRoom()
    setRooms((prev) => [...prev, room])
    setActiveRoomId(room.id)
  }

  const deleteRoom = (id: string) => {
    if (rooms.length <= 1) return
    setRooms((prev) => prev.filter((r) => r.id !== id))
    if (activeRoomId === id) {
      setActiveRoomId(rooms[0].id === id ? rooms[1]?.id ?? '' : rooms[0].id)
    }
  }

  const handleSend = () => {
    if (!input.trim()) return
    const userMsg: ChatMessage = {
      id: 'u-' + Date.now(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    let replyContent = defaultReply
    for (const [key, val] of Object.entries(demoReplies)) {
      if (input.includes(key)) {
        replyContent = val
        break
      }
    }

    const assistantMsg: ChatMessage = {
      id: 'a-' + Date.now(),
      content: replyContent,
      role: 'assistant',
      model: activeRoom.model,
      timestamp: Date.now() + 100,
    }

    setRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoomId
          ? { ...r, messages: [...r.messages, userMsg, assistantMsg], name: input.slice(0, 20) }
          : r
      )
    )
    setInput('')
  }

  const copyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const currentModel = models.find((m) => m.id === activeRoom.model)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-6 gap-0">
      {/* Room List Sidebar */}
      <div className="w-60 shrink-0 border-r border-gray-100 bg-gray-50/50 flex flex-col">
        <div className="p-3">
          <button
            onClick={addRoom}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} /> 新对话
          </button>
        </div>
        <div className="flex-1 overflow-auto px-2 space-y-1">
          {rooms.map((room) => (
            <div
              key={room.id}
              onClick={() => setActiveRoomId(room.id)}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-colors ${
                room.id === activeRoomId
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-100 font-medium'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/70'
              }`}
            >
              <span className="truncate">{room.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteRoom(room.id)
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>

        {/* Model Selector */}
        <div className="p-3 border-t border-gray-100">
          <select
            value={activeRoom.model}
            onChange={(e) =>
              setRooms((prev) =>
                prev.map((r) => (r.id === activeRoomId ? { ...r, model: e.target.value } : r))
              )
            }
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-blue-400 cursor-pointer"
          >
            {models.slice(0, 8).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Header */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 bg-white">
          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-sm font-bold text-gray-700">
            {currentModel?.name[0]}
          </div>
          <div>
            <div className="text-gray-900 font-medium text-sm">{currentModel?.name}</div>
            <div className="text-gray-400 text-xs">{currentModel?.provider}</div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-6 bg-gray-50/30">
          {activeRoom.messages
            .filter((m) => m.role !== 'system')
            .map((msg) => (
              <div key={msg.id} className="flex gap-4 group">
                <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                  ) : (
                    <Bot className="w-4 h-4 text-blue-500" strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {msg.role === 'user' ? '你' : currentModel?.name ?? 'AI'}
                    </span>
                    {msg.model && (
                      <span className="text-xs text-gray-300">via {msg.model}</span>
                    )}
                    <button
                      onClick={() => copyMessage(msg.content, msg.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 transition-all"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} />
                      ) : (
                        <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                      )}
                    </button>
                  </div>
                  <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={`输入消息，Enter 发送...（试试 "你好"、"写一段代码"）`}
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-300 focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-3 rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-200"
            >
              <Send className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
