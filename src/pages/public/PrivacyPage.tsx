import { barberShopConfig } from '@/config/theme'

export default function PrivacyPage() {
    const c = barberShopConfig
    return (
        <LegalPage title="Política de Privacidade" updated={c.lastUpdated}>

            <p>
                <strong>{c.legalName}</strong>, com sede em <strong>{c.address}</strong>, NIF <strong>{c.nif}</strong>,
                doravante designada como «Responsável pelo Tratamento», é responsável pelo tratamento dos dados pessoais
                recolhidos através deste website, nos termos do <strong>Regulamento (UE) 2016/679 — RGPD</strong> e da{' '}
                <strong>Lei n.º 58/2019, de 8 de agosto</strong>.
            </p>
            <p>Para questões relacionadas com proteção de dados, contacte-nos através de{' '}
                <a href={`mailto:${c.privacyEmail}`} className="text-brand-400 hover:underline">{c.privacyEmail}</a>{' '}
                ou por carta para {c.address}.
            </p>

            <Section title="1. Que Dados Recolhemos e Para Que Fins">
                <SubSection title="1.1. Autenticação e Gestão de Conta">
                    <p>Quando cria uma conta ou inicia sessão através do serviço <strong>Google OAuth</strong>, recolhemos: nome e apelido, endereço de e-mail, identificador único Google e fotografia de perfil.</p>
                    <p><strong>Base legal:</strong> Execução de contrato — art.º 6.º, n.º 1, al. b) do RGPD.</p>
                </SubSection>
                <SubSection title="1.2. Gestão de Reservas">
                    <p>Para processar e gerir reservas, recolhemos: nome completo, endereço de e-mail, número de telefone (se solicitado), data, hora e tipo de serviço reservado, preferências ou notas adicionais e histórico de reservas.</p>
                    <p><strong>Base legal:</strong> Execução de contrato — art.º 6.º, n.º 1, al. b) do RGPD.</p>
                </SubSection>
                <SubSection title="1.3. Envio de Comunicações por E-mail">
                    <p>Utilizamos o serviço <strong>Resend</strong> para enviar e-mails transacionais (confirmações de reserva, lembretes e comunicações de serviço). Para newsletters, solicitamos consentimento explícito, nos termos do art.º 6.º, n.º 1, al. a) do RGPD e do art.º 13.º, n.º 2 da Lei n.º 41/2004.</p>
                </SubSection>
                <SubSection title="1.4. Armazenamento de Dados e Ficheiros">
                    <p>Os dados estruturados são armazenados na base de dados <strong>Cloudflare D1</strong>. Imagens e ficheiros enviados pelos utilizadores são armazenados nos serviços <strong>Cloudflare R2</strong> e/ou <strong>Cloudinary</strong>, exclusivamente para a finalidade para que foram fornecidos.</p>
                    <p><strong>Base legal:</strong> Execução de contrato — art.º 6.º, n.º 1, al. b) do RGPD.</p>
                </SubSection>
                <SubSection title="1.5. Análise de Tráfego (Google Analytics)">
                    <p>Utilizamos o <strong>Google Analytics 4</strong> para recolher dados de comportamento dos utilizadores de forma agregada e anónima. Estes dados não permitem identificar individualmente os utilizadores.</p>
                    <p><strong>Base legal:</strong> Consentimento — art.º 6.º, n.º 1, al. a) do RGPD, recolhido através do banner de cookies, nos termos da Lei n.º 41/2004.</p>
                </SubSection>
            </Section>

            <Section title="2. Subcontratantes e Transferências Internacionais">
                <p>Nos termos do art.º 28.º do RGPD, recorremos aos seguintes subcontratantes:</p>
                <table className="w-full text-xs border-collapse mt-2">
                    <thead>
                    <tr className="text-gray-300 border-b border-gray-700">
                        <th className="text-left py-2 pr-4">Subcontratante</th>
                        <th className="text-left py-2 pr-4">Finalidade</th>
                        <th className="text-left py-2 pr-4">País</th>
                        <th className="text-left py-2">Garantia (RGPD)</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                    <tr><td className="py-2 pr-4">Google LLC</td><td className="py-2 pr-4">Autenticação, analytics</td><td className="py-2 pr-4">EUA</td><td className="py-2">Data Privacy Framework UE-EUA (art.º 45.º)</td></tr>
                    <tr><td className="py-2 pr-4">Resend Inc.</td><td className="py-2 pr-4">E-mails transacionais</td><td className="py-2 pr-4">EUA</td><td className="py-2">Cláusulas Contratuais Padrão (art.º 46.º)</td></tr>
                    <tr><td className="py-2 pr-4">Cloudflare Inc.</td><td className="py-2 pr-4">Armazenamento de dados</td><td className="py-2 pr-4">EUA/UE</td><td className="py-2">Data Privacy Framework ou SCCs</td></tr>
                    <tr><td className="py-2 pr-4">Cloudinary Ltd.</td><td className="py-2 pr-4">Armazenamento de imagens</td><td className="py-2 pr-4">Israel/EUA</td><td className="py-2">Cláusulas Contratuais Padrão (art.º 46.º)</td></tr>
                    </tbody>
                </table>
            </Section>

            <Section title="3. Prazos de Conservação dos Dados">
                <table className="w-full text-xs border-collapse mt-2">
                    <thead>
                    <tr className="text-gray-300 border-b border-gray-700">
                        <th className="text-left py-2 pr-4">Categoria de Dados</th>
                        <th className="text-left py-2 pr-4">Prazo</th>
                        <th className="text-left py-2">Base Legal</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                    <tr><td className="py-2 pr-4">Dados de conta (Google OAuth)</td><td className="py-2 pr-4">Enquanto ativa; 30 dias após eliminação</td><td className="py-2">Art.º 17.º RGPD</td></tr>
                    <tr><td className="py-2 pr-4">Dados de reserva</td><td className="py-2 pr-4">10 anos</td><td className="py-2">Art.º 52.º Código do IVA</td></tr>
                    <tr><td className="py-2 pr-4">Analytics (Google Analytics 4)</td><td className="py-2 pr-4">14 meses</td><td className="py-2">Art.º 5.º, n.º 1, al. e) RGPD</td></tr>
                    <tr><td className="py-2 pr-4">E-mails transacionais</td><td className="py-2 pr-4">12 meses após envio</td><td className="py-2">Art.º 5.º, n.º 1, al. e) RGPD</td></tr>
                    <tr><td className="py-2 pr-4">Imagens e ficheiros</td><td className="py-2 pr-4">Enquanto conta ativa; 30 dias após eliminação</td><td className="py-2">Art.º 17.º RGPD</td></tr>
                    </tbody>
                </table>
            </Section>

            <Section title="4. Direitos do Titular dos Dados">
                <p>Nos termos dos arts. 15.º a 22.º do RGPD, tem os seguintes direitos:</p>
                <ul>
                    <li><strong>Acesso (art.º 15.º):</strong> Obter confirmação e cópia dos dados tratados.</li>
                    <li><strong>Retificação (art.º 16.º):</strong> Corrigir dados inexatos ou incompletos.</li>
                    <li><strong>Apagamento (art.º 17.º):</strong> Solicitar a eliminação dos dados, quando legalmente permitido.</li>
                    <li><strong>Limitação (art.º 18.º):</strong> Suspender o tratamento em determinadas circunstâncias.</li>
                    <li><strong>Portabilidade (art.º 20.º):</strong> Receber os dados em formato estruturado e legível por máquina.</li>
                    <li><strong>Oposição (art.º 21.º):</strong> Opor-se ao tratamento com base em interesses legítimos.</li>
                    <li><strong>Retirar consentimento (art.º 7.º, n.º 3):</strong> A qualquer momento, sem prejuízo do tratamento anterior.</li>
                </ul>
                <p>
                    Para exercer estes direitos, contacte-nos através de{' '}
                    <a href={`mailto:${c.privacyEmail}`} className="text-brand-400 hover:underline">{c.privacyEmail}</a>.
                    Respondemos no prazo máximo de <strong>1 mês</strong> (art.º 12.º, n.º 3 do RGPD).
                </p>
                <p>
                    Tem também o direito de reclamar junto da <strong>Comissão Nacional de Proteção de Dados (CNPD)</strong>:{' '}
                    <a href="https://www.cnpd.pt" className="text-brand-400 hover:underline" target="_blank" rel="noopener noreferrer">www.cnpd.pt</a> — geral@cnpd.pt.
                </p>
            </Section>

            <Section title="5. Segurança dos Dados">
                <p>Nos termos do art.º 32.º do RGPD, adotamos medidas técnicas e organizativas adequadas, incluindo: transmissão cifrada via HTTPS/TLS, acesso restrito a pessoal autorizado, dados em repouso com encriptação (Cloudflare D1 e R2), e monitorização de acessos.</p>
                <p>Em caso de violação de dados, a CNPD será notificada no prazo de <strong>72 horas</strong> (art.º 33.º do RGPD), e os titulares afetados serão informados quando o risco for elevado (art.º 34.º do RGPD).</p>
            </Section>

            <Section title="6. Menores">
                <p>Este website não é dirigido a menores de <strong>13 anos</strong>. Não recolhemos dados de menores sem autorização parental verificável (art.º 8.º do RGPD e art.º 16.º da Lei n.º 58/2019). Dados detetados sem autorização serão eliminados sem demora.</p>
            </Section>

            <Section title="7. Cookies">
                <p>Este website utiliza cookies e tecnologias semelhantes. Consulte a nossa <a href="/cookies" className="text-brand-400 hover:underline">Política de Cookies</a>, elaborada nos termos da Lei n.º 41/2004, alterada pela Lei n.º 16/2022, e do RGPD.</p>
            </Section>

            <Section title="8. Alterações a Esta Política">
                <p>Esta Política pode ser atualizada para refletir alterações legislativas ou operacionais. Em caso de alterações significativas, será dado aviso prévio por e-mail ou notificação no website.</p>
            </Section>

            <Section title="Referências Legais">
                <ul>
                    <li>Regulamento (UE) 2016/679 — RGPD</li>
                    <li>Lei n.º 58/2019, de 8 de agosto — Execução do RGPD em Portugal</li>
                    <li>Lei n.º 41/2004, de 18 de agosto (alterada pela Lei n.º 46/2012 e Lei n.º 16/2022) — Privacidade nas comunicações eletrónicas</li>
                    <li>Decreto-Lei n.º 24/2014, de 14 de fevereiro — Contratos à Distância</li>
                    <li>Decreto-Lei n.º 198/2012, de 24 de agosto — Faturação Eletrónica</li>
                </ul>
            </Section>

        </LegalPage>
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