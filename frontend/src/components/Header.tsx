import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  BookOpen,
  Building2,
  Tag,
  GitCompare,
  Crown,
  Menu,
  X,
  LogOut,
  ExternalLink,
  ChevronDown,
  Layers,
  Puzzle,
  MessageCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AuthModal from './AuthModal'

const navItems = [
  { to: '/products', icon: Layers, label: '产品' },

  { to: '/integrations', icon: Puzzle, label: '生态集成' },
  { to: '/comparison', icon: GitCompare, label: '竞品对比' },
  { to: '/enterprise', icon: Building2, label: '企业版' },
  { to: '/pricing', icon: Tag, label: '定价' },

  { to: '/docs', icon: BookOpen, label: '技术支持' },
  { to: '/explore', icon: Crown, label: '模型排行榜' },
  { to: '/contact', icon: MessageCircle, label: '联系我们' },
]

export default function Header() {
  const { user, isLoggedIn, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/75 backdrop-blur-xl border-b border-gray-200/70">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="flex items-center h-14 gap-4">
            {/* ---- Logo ---- */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <img src="/logo.png" alt="OneLLM" className="w-7 h-7 rounded-lg shrink-0" />
              <span className="font-semibold text-gray-900 text-base hidden sm:inline tracking-tight">OneLLM</span>
            </Link>

            {/* ---- Desktop nav ---- */}
            <nav className="hidden md:flex items-center gap-0.5 ml-2">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                      isActive
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/70'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" strokeWidth={1.5} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            {/* ---- Spacer ---- */}
            <div className="flex-1" />

            {/* ---- Desktop auth ---- */}
            <div className="hidden md:flex items-center gap-2">
              {isLoggedIn ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xs">
                      {user?.avatar}
                    </div>
                    <span className="text-[13px] text-gray-700 max-w-[100px] truncate font-medium">{user?.name}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
                  </button>

                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white border border-gray-200 shadow-lg shadow-gray-200/50 z-20 py-1 animate-in overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <div className="text-gray-900 text-sm font-semibold">{user?.name}</div>
                          <div className="text-gray-400 text-xs">{user?.email}</div>
                        </div>
                        <a
                          href="http://localhost:3001"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setUserMenuOpen(false)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                          管理控制台
                        </a>
                        <button
                          onClick={() => {
                            logout()
                            setUserMenuOpen(false)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" strokeWidth={1.5} />
                          退出登录
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="px-4 py-1.5 rounded-lg bg-blue-500 text-white text-[13px] font-medium hover:bg-blue-600 transition-colors shadow-sm"
                >
                  登录
                </button>
              )}
            </div>

            {/* ---- Mobile hamburger ---- */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" strokeWidth={1.5} /> : <Menu className="w-5 h-5" strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {/* ---- Mobile menu ---- */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white/95 backdrop-blur-xl">
            <nav className="px-4 py-3 space-y-1">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      isActive
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                  <span>{label}</span>
                </NavLink>
              ))}

              <div className="pt-3 mt-3 border-t border-gray-100 space-y-2">
                {isLoggedIn ? (
                  <>
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                        {user?.avatar}
                      </div>
                      <div>
                        <div className="text-gray-900 text-sm font-medium">{user?.name}</div>
                        <div className="text-gray-400 text-xs">{user?.email}</div>
                      </div>
                    </div>
                    <a
                      href="http://localhost:3001"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium"
                    >
                      <ExternalLink className="w-5 h-5" strokeWidth={1.5} />
                      管理控制台
                    </a>
                    <button
                      onClick={() => {
                        logout()
                        setMobileOpen(false)
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      <LogOut className="w-5 h-5" strokeWidth={1.5} />
                      退出登录
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setAuthModalOpen(true); setMobileOpen(false) }}
                    className="w-full py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm"
                  >
                    登录
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Auth modal */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </>
  )
}
