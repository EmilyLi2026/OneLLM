import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { X, Smartphone, Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

export default function AuthModal({ open, onClose }: Props) {
  const { loginWithPhone, sendCode } = useAuth()

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timerRef.current)
            return 0
          }
          return c - 1
        })
      }, 1000)
    }
    return () => { clearInterval(timerRef.current) }
  }, [countdown])

  if (!open) return null

  const reset = () => {
    setPhone('')
    setCode('')
    setCountdown(0)
    setError('')
    setSuccess('')
  }

  const handleSendCode = async () => {
    setError('')
    const phoneDigits = phone.replace(/\D/g, '')
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      setError('请输入有效的手机号')
      return
    }
    setSending(true)
    const result = await sendCode(phone)
    setSending(false)
    if (result.ok) {
      setCountdown(60)
      setError('')
    } else {
      setError(result.error ?? '发送失败')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!phone.trim()) {
      setError('请填写手机号')
      return
    }
    if (code.trim().length !== 6) {
      setError('请输入6位验证码')
      return
    }

    setLoading(true)
    const result = await loginWithPhone(phone, code)
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? '登录失败')
    } else {
      setSuccess('登录成功！')
      // Open admin console in new tab with auto-login
      if (result.token && result.user) {
        const params = new URLSearchParams({
          token: result.token,
          name: result.user.name,
          id: result.user.id,
        })
        window.open(`http://localhost:3001/login?${params.toString()}`, '_blank')
      }
      setTimeout(() => {
        onClose()
        reset()
      }, 800)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="relative w-full max-w-md mx-4 rounded-3xl bg-white shadow-xl shadow-gray-200/60 border border-gray-100 animate-in overflow-hidden">
        {/* close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>

        {/* header */}
        <div className="px-6 pt-8 pb-4 text-center">
          <img src="/logo.png" alt="OneLLM" className="w-12 h-12 mx-auto mb-4 rounded-2xl" />
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight">登录</h2>
          <p className="text-sm text-gray-400 mt-1">新用户验证手机号后自动注册，免费体验</p>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} className="px-6 pb-8 space-y-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1.5 font-medium">手机号</label>
            <div className="relative">
              <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" strokeWidth={1.5} />
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError('') }}
                placeholder="输入手机号"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-300 focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1.5 font-medium">验证码</label>
            <div className="flex gap-3">
              <input
                type="text"
                maxLength={6}
                inputMode="numeric"
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                placeholder="6位验证码"
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-300 focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={countdown > 0 || sending}
                className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  countdown > 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-50 text-blue-500 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                ) : countdown > 0 ? (
                  `${countdown}s`
                ) : (
                  '获取验证码'
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-500 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-blue-500 text-white font-medium text-sm hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                登录中...
              </>
            ) : (
              '登录'
            )}
          </button>

          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              💡 首次登录即注册，验证码5分钟内有效
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
