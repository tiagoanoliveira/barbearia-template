import { barberShopConfig } from '@/config/theme'

export default function TermsPage() {
    const c = barberShopConfig
    return (
        <LegalPage title="Termos e Condições de Utilização" updated={c.lastUpdated}>

            <Section title="1. Identificação das Partes e Aceitação">
                <p>
                    Os presentes Termos e Condições regulam o acesso e utilização do website de <strong>{c.legalName}</strong>,
                    com sede em <strong>{c.address}</strong>, NIF <strong>{c.nif}</strong>, e-mail{' '}
                    <a href={`mailto:${c.email}`} className="text-brand-400 hover:underline">{c.email}</a>, telefone{' '}
                    <a href={`tel:${c.phone}`} className="text-brand-400 hover:underline">{c.phone}</a>{' '}
                    (chamada para rede móvel nacional), doravante designado como «Prestador».
                </p>
                <p>
                    A utilização do website implica a aceitação integral destes Termos, nos termos do <strong>art.º 5.º do
                    Decreto-Lei n.º 7/2004, de 7 de janeiro</strong> (Lei do Comércio Eletrónico). O Prestador reserva-se o
                    direito de alterar estes Termos a qualquer momento, com aviso prévio por e-mail ou notificação no website.
                </p>
            </Section>

            <Section title="2. Registo e Conta de Utilizador">
                <p>O acesso a determinadas funcionalidades requer criação de conta, efetuada através do serviço de autenticação <strong>Google OAuth</strong>. Ao criar conta, o utilizador compromete-se a:</p>
                <ul>
                    <li>Ter idade igual ou superior a <strong>16 anos</strong> ou dispor de autorização parental verificável (art.º 8.º do RGPD e art.º 16.º da Lei n.º 58/2019);</li>
                    <li>Fornecer informações verdadeiras, completas e atualizadas;</li>
                    <li>Manter a confidencialidade das suas credenciais;</li>
                    <li>Notificar imediatamente o Prestador em caso de utilização não autorizada da conta.</li>
                </ul>
                <p>O Prestador pode suspender ou eliminar contas que violem estes Termos (art.º 12.º do DL n.º 7/2004).</p>
            </Section>

            <Section title="3. Regras de Utilização">
                <p>O utilizador compromete-se a utilizar o website de forma lícita. São expressamente proibidas:</p>
                <ul>
                    <li>Utilização para fins ilícitos, fraudulentos ou prejudiciais a terceiros;</li>
                    <li>Reprodução ou distribuição de conteúdos sem autorização (DL n.º 63/85, de 14 de março);</li>
                    <li>Tentativa de acesso não autorizado a sistemas informáticos (Lei n.º 109/2009, de 15 de setembro);</li>
                    <li>Introdução de vírus, malware ou outros elementos nocivos;</li>
                    <li>Extração automatizada de dados (scraping) sem autorização expressa;</li>
                    <li>Qualquer ação que prejudique a disponibilidade, segurança ou integridade do website.</li>
                </ul>
            </Section>

            <Section title="4. Sistema de Reservas">
                <p>O website disponibiliza um sistema de reservas online para os serviços de barbearia. As reservas estão sujeitas à disponibilidade e confirmação pelo Prestador. O utilizador receberá confirmação por e-mail após a reserva.</p>
                <p>O Prestador reserva-se o direito de cancelar reservas em caso de indisponibilidade ou força maior, procedendo à notificação com a máxima antecedência possível.</p>
            </Section>

            <Section title="5. Propriedade Intelectual">
                <p>Todos os conteúdos do website — incluindo textos, imagens, logótipos, vídeos, código-fonte e design — são propriedade do Prestador ou de terceiros que autorizaram a sua utilização, protegidos pelo <strong>DL n.º 63/85, de 14 de março</strong> e pelo <strong>Código da Propriedade Industrial (DL n.º 110/2018, de 10 de dezembro)</strong>. É expressamente proibida a reprodução ou utilização para fins comerciais sem autorização prévia e escrita.</p>
            </Section>

            <Section title="6. Privacidade e Proteção de Dados">
                <p>O tratamento de dados pessoais é regulado pela <a href="/privacidade" className="text-brand-400 hover:underline">Política de Privacidade</a>, elaborada em conformidade com o <strong>RGPD</strong> e com a <strong>Lei n.º 58/2019, de 8 de agosto</strong>.</p>
            </Section>

            <Section title="7. Limitação de Responsabilidade">
                <p>O Prestador não se responsabiliza por danos resultantes de interrupções técnicas do website por causas alheias ao seu controlo, vírus informáticos, erros ou omissões nos conteúdos, ou utilização indevida pelo utilizador. A responsabilidade perante consumidores é sempre enquadrada pela <strong>Lei de Defesa do Consumidor (Lei n.º 24/96)</strong> e pelo <strong>DL n.º 84/2021, de 18 de outubro</strong>.</p>
            </Section>

            <Section title="8. Resolução de Litígios">
                <p>Em caso de litígio de consumo, o utilizador pode recorrer a entidades de Resolução Alternativa de Litígios (RAL) nos termos da <strong>Lei n.º 144/2015, de 8 de setembro</strong>. Consulte a página <a href="/ral-e-reclamacoes" className="text-brand-400 hover:underline">RAL e Reclamações</a> para mais informação.</p>
                <p>Pode também aceder à plataforma europeia de resolução de litígios em linha:{' '}
                    <a href="https://ec.europa.eu/consumers/odr/" className="text-brand-400 hover:underline" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>
                </p>
            </Section>

            <Section title="9. Livro de Reclamações Eletrónico">
                <p>Nos termos do <strong>Decreto-Lei n.º 74/2017, de 21 de junho</strong>, pode apresentar reclamação através do Livro de Reclamações Eletrónico:{' '}
                    <a href="https://www.livroreclamacoes.pt" className="text-brand-400 hover:underline" target="_blank" rel="noopener noreferrer">www.livroreclamacoes.pt</a>
                </p>
            </Section>

            <Section title="10. Lei Aplicável e Foro Competente">
                <p>
                    Estes Termos são regidos pela legislação portuguesa. Para resolução de litígios, é competente o tribunal da comarca de <strong>{c.comarca}</strong>, sem prejuízo do direito do consumidor de recorrer a mecanismos de RAL (Lei n.º 144/2015) ou ao tribunal da sua residência (Regulamento (UE) n.º 1215/2012).
                </p>
            </Section>

            <Section title="Referências Legais">
                <ul>
                    <li>DL n.º 7/2004, de 7 de janeiro — Lei do Comércio Eletrónico</li>
                    <li>DL n.º 63/85, de 14 de março — Código do Direito de Autor</li>
                    <li>DL n.º 110/2018, de 10 de dezembro — Código da Propriedade Industrial</li>
                    <li>DL n.º 74/2017, de 21 de junho — Livro de Reclamações Eletrónico</li>
                    <li>Lei n.º 24/96, de 31 de julho — Lei de Defesa do Consumidor</li>
                    <li>Lei n.º 109/2009, de 15 de setembro — Lei do Cibercrime</li>
                    <li>Lei n.º 144/2015, de 8 de setembro — Resolução Alternativa de Litígios</li>
                    <li>Regulamento (UE) 2016/679 — RGPD</li>
                    <li>Regulamento (UE) n.º 524/2013 — Resolução de Litígios em Linha</li>
                    <li>Regulamento (UE) n.º 1215/2012 — Competência Judiciária</li>
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