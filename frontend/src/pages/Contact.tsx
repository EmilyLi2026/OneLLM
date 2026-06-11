import { Mail, MessageSquare, Headphones } from 'lucide-react'
import ContactForm from '../components/ContactForm'
import kefuImg from '../assets/kefu1.png'

export default function Contact() {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">联系我们</h1>
        <p className="text-gray-400">告诉我们你的需求，我们的企业团队将在 24 小时内与你联系，提供定制化的 AI 路由解决方案和报价。</p>
      </div>

      {/* ==================== CONTACT SECTION ==================== */}
      <section className="mb-8">
        <div className="grid grid-cols-5 gap-8">
          {/* left info */}
          <div className="col-span-2 flex flex-col justify-center">
            {/* QR codes row */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm text-center">
                <div className="inline-flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center">
                    <Mail className="w-3.5 h-3.5 text-blue-500" strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">企业销售</span>
                </div>
                <img src={kefuImg} alt="企业销售" className="w-32 h-32 mx-auto rounded-xl border border-gray-100" />
                <div className="text-xs text-gray-400 mt-2">扫码联系销售</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm text-center">
                <div className="inline-flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center">
                    <Headphones className="w-3.5 h-3.5 text-purple-500" strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">技术支持</span>
                </div>
                <img src={kefuImg} alt="技术支持" className="w-32 h-32 mx-auto rounded-xl border border-gray-100" />
                <div className="text-xs text-gray-400 mt-2">扫码添加技术支持</div>
              </div>
            </div>
            {/* phone row */}
            <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm text-center">
              <div className="inline-flex items-center gap-1.5 mb-1">
                <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} />
                </div>
                <span className="text-sm font-semibold text-gray-900">在线咨询</span>
              </div>
              <div className="text-lg font-bold text-gray-900 tracking-tight">186 1076 8620</div>
              <div className="text-xs text-gray-400">工作日 9:00-18:00 (UTC+8)</div>
            </div>
          </div>
          {/* right form */}
          <div className="col-span-3 p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-5">填写信息，开始企业之旅</h3>
            <ContactForm />
          </div>
        </div>
      </section>
    </div>
  )
}
