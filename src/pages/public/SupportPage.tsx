import { Mail, Phone, Clock, MessageCircle } from 'lucide-react'
import { barberShopConfig } from '@/config/theme'

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-950 pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-black text-white mb-2">Suporte & Ajuda</h1>
        <p className="text-gray-500 mb-10">Estamos aqui para te ajudar.</p>

        <div className="grid gap-4 mb-10">
          <a href={`tel:${barberShopConfig.phone}`}
             className="flex items-center gap-4 p-5 bg-gray-900/60 border border-white/5
                        rounded-2xl hover:border-brand-500/30 transition-all group">
            <div className="w-12 h-12 bg-brand-500/10 rounded-2xl flex items-center justify-center
                            group-hover:bg-brand-500/20 transition-colors">
              <Phone size={20} className="text-brand-500" />
            </div>
            <div>
              <p className="text-white font-semibold">Telefone</p>
              <p className="text-gray-500 text-sm">{barberShopConfig.phone}</p>
            </div>
          </a>

          <a href={`mailto:${barberShopConfig.email}`}
             className="flex items-center gap-4 p-5 bg-gray-900/60 border border-white/5
                        rounded-2xl hover:border-brand-500/30 transition-all group">
            <div className="w-12 h-12 bg-brand-500/10 rounded-2xl flex items-center justify-center
                            group-hover:bg-brand-500/20 transition-colors">
              <Mail size={20} className="text-brand-500" />
            </div>
            <div>
              <p className="text-white font-semibold">Email</p>
              <p className="text-gray-500 text-sm">{barberShopConfig.email}</p>
            </div>
          </a>

          <a href={barberShopConfig.instagram} target="_blank" rel="noreferrer"
             className="flex items-center gap-4 p-5 bg-gray-900/60 border border-white/5
                        rounded-2xl hover:border-brand-500/30 transition-all group">
            <div className="w-12 h-12 bg-brand-500/10 rounded-2xl flex items-center justify-center
                            group-hover:bg-brand-500/20 transition-colors">
              <MessageCircle size={20} className="text-brand-500" />
            </div>
            <div>
              <p className="text-white font-semibold">Instagram DM</p>
              <p className="text-gray-500 text-sm">Resposta em menos de 24h</p>
            </div>
          </a>
        </div>

        <div className="bg-gray-900/60 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock size={18} className="text-brand-500" />
            <h2 className="text-white font-semibold">Horário de atendimento</h2>
          </div>
          <ul className="space-y-2 text-sm text-gray-500">
            <li className="flex justify-between"><span>Segunda a Sexta</span><span className="text-gray-300">09:00 – 19:00</span></li>
            <li className="flex justify-between"><span>Sábado</span><span className="text-gray-300">09:00 – 18:00</span></li>
            <li className="flex justify-between"><span>Domingo</span><span className="text-red-500">Fechado</span></li>
          </ul>
        </div>

        <p className="text-center text-sm text-gray-600 mt-10">
          Dúvidas gerais?{' '}
          <a href="/faq" className="text-brand-400 hover:underline">Consulta as perguntas frequentes</a>
        </p>
      </div>
    </div>
  )
}
