import { barberShopConfig } from '@/config/theme'

export default function CookiesPage() {
  const c = barberShopConfig
  return (
      <LegalPage title="Política de Cookies" updated={c.lastUpdated}>

        <p>
          Nos termos da <strong>Lei n.º 41/2004, de 18 de agosto</strong> (com as alterações das Leis n.º 46/2012 e n.º 16/2022)
          e do <strong>Regulamento (UE) 2016/679 — RGPD</strong>, a <strong>{c.legalName}</strong> informa os utilizadores sobre
          a utilização de cookies e tecnologias semelhantes neste website.
        </p>

        <Section title="1. O Que São Cookies">
          <p>Cookies são pequenos ficheiros de texto que um website armazena no dispositivo do utilizador quando este o visita, permitindo reconhecer o dispositivo em visitas futuras. Tecnologias equivalentes como <em>local storage</em> e <em>session storage</em> estão sujeitas às mesmas regras, por força do <strong>art.º 5.º da Lei n.º 41/2004</strong>.</p>
        </Section>

        <Section title="2. Tipos de Cookies Utilizados">
          <p>Nos termos do <strong>art.º 5.º, n.º 3 da Lei n.º 41/2004</strong>, o armazenamento de informação nos dispositivos só é permitido com consentimento prévio e informado, exceto quando os cookies são estritamente necessários.</p>

          <SubSection title="2.1. Cookies Estritamente Necessários">
            <p>Indispensáveis para o funcionamento do website. Não requerem consentimento (art.º 5.º, n.º 3, segunda parte, da Lei n.º 41/2004).</p>
            <CookieTable rows={[
              ['session', c.name, 'Manutenção da sessão de autenticação (Google OAuth)', 'Sessão'],
              ['__Host-next-auth.csrf-token', c.name, 'Proteção contra ataques CSRF na autenticação', 'Sessão'],
              ['__Secure-next-auth.session-token', c.name, 'Token de sessão seguro para utilizadores autenticados', '30 dias'],
              ['cookieconsent', c.name, 'Memorização das preferências de cookies do utilizador', '1 ano'],
            ]} />
          </SubSection>

          <SubSection title="2.2. Cookies Funcionais / de Preferências">
            <p>Permitem memorizar escolhas do utilizador para uma experiência mais personalizada. Requerem consentimento.</p>
            <CookieTable rows={[
              ['lang', c.name, 'Memorização da preferência de idioma', '1 ano'],
              ['timezone', c.name, 'Memorização do fuso horário para apresentação correta de datas e horários de reserva', '1 ano'],
            ]} />
          </SubSection>

          <SubSection title="2.3. Cookies Analíticos / de Desempenho">
            <p>Permitem analisar o comportamento dos utilizadores de forma agregada e anónima. Requerem consentimento (art.º 5.º, n.º 3 da Lei n.º 41/2004 e art.º 6.º, n.º 1, al. a) do RGPD).</p>
            <p className="text-gray-500 text-xs italic">Estes cookies implicam transferência de dados para servidores nos EUA operados pela Google LLC, efetuada com base no <strong>Data Privacy Framework UE-EUA</strong> (Decisão de Adequação da Comissão Europeia de 10/07/2023, art.º 45.º RGPD).</p>
            <CookieTable rows={[
              ['_ga', 'Google Analytics', 'Distinção de utilizadores únicos', '2 anos'],
              ['_gid', 'Google Analytics', 'Distinção de utilizadores (sessão atual)', '24 horas'],
              ['_ga_[ID]', 'Google Analytics', 'Manutenção do estado de sessão do Google Analytics 4', '2 anos'],
            ]} />
          </SubSection>
        </Section>

        <Section title="3. Cookies de Terceiros">
          <p>Este website recorre a serviços de terceiros que podem instalar os seus próprios cookies:</p>
          <ul>
            <li><strong>Google LLC</strong> — Google OAuth (autenticação) e Google Analytics (análise de tráfego). Política: <a href="https://policies.google.com/privacy" className="text-brand-400 hover:underline" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a></li>
            <li><strong>Cloudflare Inc.</strong> — Infraestrutura de rede e armazenamento. Política: <a href="https://www.cloudflare.com/privacypolicy/" className="text-brand-400 hover:underline" target="_blank" rel="noopener noreferrer">cloudflare.com/privacypolicy</a></li>
          </ul>
        </Section>

        <Section title="4. Gestão do Consentimento">
          <p>Nos termos do <strong>art.º 5.º, n.º 3 da Lei n.º 41/2004</strong> e do <strong>art.º 7.º do RGPD</strong>, o consentimento para cookies não estritamente necessários deve ser livre, específico, informado e inequívoco.</p>
          <p>Na primeira visita, é apresentado um banner de cookies que permite aceitar ou recusar cada categoria de forma independente. A opção de recusar é tão acessível quanto a de aceitar.</p>
          <p>Pode alterar as suas preferências a qualquer momento clicando em <strong>«Gerir Cookies»</strong> no rodapé do website. A recusa de cookies não estritamente necessários não impede o acesso ao website nem às funcionalidades essenciais.</p>
        </Section>

        <Section title="5. Como Gerir Cookies no Browser">
          <p>Independentemente das opções disponíveis neste website, pode configurar o seu browser para recusar ou eliminar cookies:</p>
          <ul>
            <li><strong>Google Chrome:</strong> <a href="https://support.google.com/chrome/answer/95647" className="text-brand-400 hover:underline" target="_blank" rel="noopener noreferrer">support.google.com/chrome/answer/95647</a></li>
            <li><strong>Mozilla Firefox:</strong> <a href="https://support.mozilla.org/pt-PT/kb/cookies-informacao-que-os-sites-guardam-no-seu-com" className="text-brand-400 hover:underline" target="_blank" rel="noopener noreferrer">support.mozilla.org</a></li>
            <li><strong>Safari:</strong> <a href="https://support.apple.com/pt-pt/guide/safari/sfri11471" className="text-brand-400 hover:underline" target="_blank" rel="noopener noreferrer">support.apple.com</a></li>
            <li><strong>Microsoft Edge:</strong> <a href="https://support.microsoft.com/pt-pt/microsoft-edge/eliminar-cookies-no-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" className="text-brand-400 hover:underline" target="_blank" rel="noopener noreferrer">support.microsoft.com</a></li>
          </ul>
          <p className="text-gray-500 text-xs italic">Atenção: A desativação de cookies estritamente necessários pode impedir o correto funcionamento do website, incluindo a autenticação.</p>
        </Section>

        <Section title="6. Contacto">
          <p>Para questões relacionadas com cookies, contacte-nos através de:</p>
          <ul>
            <li>E-mail: <a href={`mailto:${c.privacyEmail}`} className="text-brand-400 hover:underline">{c.privacyEmail}</a></li>
            <li>Morada: {c.address}</li>
          </ul>
          <p>
            Tem o direito de reclamar junto da <strong>CNPD</strong>:{' '}
            <a href="https://www.cnpd.pt" className="text-brand-400 hover:underline" target="_blank" rel="noopener noreferrer">www.cnpd.pt</a>
          </p>
        </Section>

      </LegalPage>
  )
}

function CookieTable({ rows }: { rows: [string, string, string, string][] }) {
  return (
      <table className="w-full text-xs border-collapse mt-2">
        <thead>
        <tr className="text-gray-300 border-b border-gray-700">
          <th className="text-left py-2 pr-3">Cookie</th>
          <th className="text-left py-2 pr-3">Origem</th>
          <th className="text-left py-2 pr-3">Finalidade</th>
          <th className="text-left py-2">Duração</th>
        </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
        {rows.map(([name, origin, purpose, duration]) => (
            <tr key={name}>
              <td className="py-2 pr-3 font-mono">{name}</td>
              <td className="py-2 pr-3">{origin}</td>
              <td className="py-2 pr-3">{purpose}</td>
              <td className="py-2">{duration}</td>
            </tr>
        ))}
        </tbody>
      </table>
  )
}

function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
      <div className="min-h-screen bg-gray-950 pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-3xl font-black text-white mb-2">{title}</h1>
          <p className="text-gray-600 text-sm mb-10">Última atualização: {updated}</p>
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

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
      <div className="mt-3">
        <h3 className="text-gray-300 font-semibold text-sm mb-2">{title}</h3>
        <div className="space-y-1">{children}</div>
      </div>
  )
}