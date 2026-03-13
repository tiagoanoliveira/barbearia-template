import { barberShopConfig } from '@/config/theme'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-950 pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-black text-white mb-2">Termos e Condições</h1>
        <p className="text-gray-600 text-sm mb-10">Actualizado em Março de 2026</p>
        <div className="space-y-8 text-gray-400 text-sm leading-relaxed">
          {[
            { t: '1. Aceitação dos termos', p: 'Ao utilizar o sistema de reservas online da {name}, aceitas os presentes Termos e Condições. Caso não concorde, deverás abster-te de utilizar o serviço.' },
            { t: '2. Descrição do serviço', p: 'A {name} disponibiliza uma plataforma de reserva online de serviços de barbearia. A reserva é gratuita; o pagamento dos serviços é efectuado presencialmente.' },
            { t: '3. Registo e conta', p: 'Para efectuar uma reserva é necessário criar uma conta com dados verdadeiros e actualizados. É da tua responsabilidade manter a confidencialidade das tuas credenciais.' },
            { t: '4. Reservas e cancelamentos', p: 'Podes cancelar ou alterar uma reserva até 2 horas antes do horário marcado. A {name} reserva o direito de cancelar reservas em caso de indisponibilidade, com aviso prévio.' },
            { t: '5. Comportamento', p: 'O utilizador compromete-se a comportar-se de forma respeitosa com os colaboradores e outros clientes. Reservamos o direito de recusar o serviço em caso de comportamento inadeqüado.' },
            { t: '6. Limitação de responsabilidade', p: 'A {name} não se responsabiliza por danos indirectos decorrentes da utilização do sistema de reservas, incluindo indisponibilidade temporária do serviço.' },
            { t: '7. Alterações', p: 'Estes termos podem ser actualizados. As alterações serão publicadas nesta página e a data de actualização será revista.' },
            { t: '8. Lei aplicável', p: 'Estes Termos regem-se pela lei portuguesa. Qualquer litígio será submetido aos tribunais da comarca de Porto.' },
          ].map(({ t, p }) => (
            <div key={t}>
              <h2 className="text-white font-bold text-base mb-3">{t}</h2>
              <p>{p.replace(/\{name\}/g, barberShopConfig.name)}</p>
            </div>
          ))}
          <p>Contacto: <a href={`mailto:${barberShopConfig.email}`} className="text-brand-400 hover:underline">{barberShopConfig.email}</a></p>
        </div>
      </div>
    </div>
  )
}
