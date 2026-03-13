import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { barberShopConfig } from '@/config/theme'

const faqs = [
  {
    q: 'Como posso fazer uma reserva?',
    a: 'Clica em “Reservar” no menu principal ou no botão na página inicial. Escolhe o serviço, o barbeiro e o horário disponível. É necessário ter uma conta para confirmar a reserva.',
  },
  {
    q: 'Posso cancelar ou alterar a minha reserva?',
    a: 'Sim, podes cancelar ou alterar a tua reserva até com 2 horas de antecedência. Acede ao teu perfil, vão a “As minhas reservas” e selecciona a opção desejada.',
  },
  {
    q: 'A reserva é gratuita?',
    a: 'Sim, a reserva online é totalmente gratuita. O pagamento do serviço é efectuado presencialmente na barbearia após o corte.',
  },
  {
    q: 'Qual é o tempo de cada serviço?',
    a: 'A duração varia consoante o serviço. Corte básico: 30 min. Corte + barba: 45–60 min. Tratamentos especiais podem demorar mais. O tempo está indicado em cada serviço ao reservar.',
  },
  {
    q: 'Posso escolher o meu barbeiro preferido?',
    a: 'Sim! No passo 2 da reserva podes escolher o barbeiro de preferência. Se preferires qualquer um disponível, também existe essa opção.',
  },
  {
    q: 'O que acontece se não aparecer à reserva?',
    a: 'Em caso de falta sem aviso prévio, a reserva será marcada como “Não compareceu”. Faltas repetidas podem levar à suspensão do acesso ao sistema de reservas.',
  },
  {
    q: 'Aceita walk-ins (sem reserva)?',
    a: 'Sim, sempre que haja disponibilidade. No entanto, recomendamos a reserva online para garantir o teu horário, especialmente ao fim de semana.',
  },
  {
    q: 'Como contacto a barbearia?',
    a: `Podes contactar-nos por telefone (${barberShopConfig.phone}), email (${barberShopConfig.email}) ou pela nossa página de Suporte.`,
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        className="w-full flex items-center justify-between py-5 text-left gap-4"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-white font-medium text-sm">{q}</span>
        <ChevronDown size={18} className={`text-brand-500 flex-shrink-0 transition-transform ${
          open ? 'rotate-180' : ''
        }`} />
      </button>
      {open && (
        <p className="text-gray-400 text-sm pb-5 leading-relaxed">{a}</p>
      )}
    </div>
  )
}

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-gray-950 pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-black text-white mb-2">Perguntas Frequentes</h1>
        <p className="text-gray-500 mb-10">Respostas às dúvidas mais comuns.</p>
        <div className="bg-gray-900/60 rounded-3xl border border-white/5 px-6">
          {faqs.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
        <p className="text-center text-sm text-gray-600 mt-10">
          Não encontras a resposta?{' '}
          <a href="/suporte" className="text-brand-400 hover:underline">Contacta o suporte</a>
        </p>
      </div>
    </div>
  )
}
