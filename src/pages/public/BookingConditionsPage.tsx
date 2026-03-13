import { barberShopConfig } from '@/config/theme'

export default function BookingConditionsPage() {
  return (
    <div className="min-h-screen bg-gray-950 pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-black text-white mb-2">Condições de Reserva</h1>
        <p className="text-gray-600 text-sm mb-10">Actualizado em Março de 2026</p>
        <div className="space-y-8 text-gray-400 text-sm leading-relaxed">
          {[
            { t: 'Confirmação', p: 'A tua reserva fica confirmada após o registo na plataforma. Recebers uma confirmação por email ou notificação.' },
            { t: 'Pagamento', p: 'O pagamento é efectuado presencialmente, após a prestação do serviço. Aceitamos dinheiro e MB Way.' },
            { t: 'Pontualidade', p: 'Pedimos que chegues 5 minutos antes da hora marcada. Atrasos superiores a 10 minutos podem resultar no reagendamento da reserva.' },
            { t: 'Cancelamento', p: 'Podes cancelar gratuitamente até 2 horas antes do horário. Cancelamentos tardios ou faltas repetidas podem limitar o acesso ao sistema.' },
            { t: 'Reagendamento', p: 'Para reagendar, cancela a reserva actual e cria uma nova com o horário pretendido, com o mínimo de 2 horas de antecedência.' },
            { t: 'Crianças', p: 'Crianças com menos de 12 anos devem ser acompanhadas por um adulto durante todo o serviço.' },
            { t: 'Contacto', p: `Dúvidas sobre a tua reserva? Liga para ${barberShopConfig.phone} ou envia email para ${barberShopConfig.email}.` },
          ].map(({ t, p }) => (
            <div key={t}>
              <h2 className="text-white font-bold text-base mb-3">{t}</h2>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
