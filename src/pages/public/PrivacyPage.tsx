import { barberShopConfig } from '@/config/theme'

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade">
      <Section title="1. Responsável pelo tratamento">
        <p>{barberShopConfig.name}, com sede em {barberShopConfig.address}, é o responsável pelo tratamento dos dados pessoais recolhidos através deste sítio web.</p>
      </Section>
      <Section title="2. Dados recolhidos">
        <p>Recolhemos os seguintes dados pessoais: nome, endereço de email, número de telefone, e dados das reservas efectuadas. Podemos também recolher dados de navegação através de cookies.</p>
      </Section>
      <Section title="3. Finalidade do tratamento">
        <ul>
          <li>Gestão de reservas e prestação do serviço;</li>
          <li>Envio de confirmações e lembretes de reserva;</li>
          <li>Melhoria do sítio web e da experiência do utilizador;</li>
          <li>Cumprimento de obrigações legais.</li>
        </ul>
      </Section>
      <Section title="4. Base legal">
        <p>O tratamento baseia-se no consentimento do titular (art. 6.º, n.º 1, al. a) do RGPD) e na execução de contrato (al. b)).</p>
      </Section>
      <Section title="5. Conservação dos dados">
        <p>Os dados são conservados pelo período estritamente necessário para as finalidades indicadas, ou pelo período legalmente exigido.</p>
      </Section>
      <Section title="6. Direitos do titular">
        <p>Tens o direito de aceder, rectificar, apagar, limitar ou opor-te ao tratamento dos teus dados, bem como o direito à portabilidade. Para exercer estes direitos, contacta-nos através de {barberShopConfig.email}.</p>
      </Section>
      <Section title="7. Contacto">
        <p>Para questões relacionadas com privacidade: <a href={`mailto:${barberShopConfig.email}`} className="text-brand-400 hover:underline">{barberShopConfig.email}</a></p>
      </Section>
    </LegalPage>
  )
}

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-black text-white mb-2">{title}</h1>
        <p className="text-gray-600 text-sm mb-10">Actualizado em Março de 2026</p>
        <div className="space-y-8 text-gray-400 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-white font-bold text-base mb-3">{title}</h2>
      <div className="space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">{children}</div>
    </div>
  )
}
