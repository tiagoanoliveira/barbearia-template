import { barberShopConfig } from '@/config/theme'

export default function RalPage() {
    const c = barberShopConfig
    return (
        <LegalPage title="Resolução Alternativa de Litígios e Reclamações" updated={c.lastUpdated}>

            <Section title="1. Compromisso com a Satisfação do Cliente">
                <p>
                    A <strong>{c.legalName}</strong> compromete-se a resolver de forma célere e justa qualquer questão,
                    reclamação ou litígio. Encorajamos o contacto direto como primeira abordagem.
                </p>
                <p>Para reclamações ou questões, contacte-nos através de:</p>
                <ul>
                    <li>E-mail: <a href={`mailto:${c.email}`} className="text-brand-400 hover:underline">{c.email}</a></li>
                    <li>Telefone: <a href={`tel:${c.phone}`} className="text-brand-400 hover:underline">{c.phone}</a> (chamada para rede móvel nacional)</li>
                    <li>Morada: {c.address}</li>
                </ul>
                <p>Comprometemo-nos a responder às reclamações no prazo máximo de <strong>15 dias úteis</strong>.</p>
            </Section>

            <Section title="2. Resolução Alternativa de Litígios (RAL)">
                <p>
                    Em conformidade com o <strong>art.º 18.º, n.º 1 da Lei n.º 144/2015, de 8 de setembro</strong> (que transpõe
                    a Diretiva 2013/11/UE), em caso de litígio de consumo pode recorrer a uma Entidade de Resolução Alternativa
                    de Litígios (RAL) — mecanismo extrajudicial geralmente mais rápido e menos dispendioso que os tribunais.
                </p>

                <SubSection title="2.1. Entidade RAL Competente">
                    <p>A entidade de resolução alternativa de litígios competente é:</p>
                    <table className="w-full text-xs border-collapse mt-2">
                        <tbody className="divide-y divide-gray-800">
                        <tr><td className="py-2 pr-4 text-gray-300 font-medium w-32">Nome:</td><td className="py-2">{c.ralName}</td></tr>
                        <tr><td className="py-2 pr-4 text-gray-300 font-medium">Morada:</td><td className="py-2">{c.ralAddress}</td></tr>
                        <tr><td className="py-2 pr-4 text-gray-300 font-medium">Telefone:</td><td className="py-2"><a href={`tel:${c.ralPhone}`} className="text-brand-400 hover:underline">{c.ralPhone}</a></td></tr>
                        <tr><td className="py-2 pr-4 text-gray-300 font-medium">E-mail:</td><td className="py-2"><a href={`mailto:${c.ralEmail}`} className="text-brand-400 hover:underline">{c.ralEmail}</a></td></tr>
                        <tr><td className="py-2 pr-4 text-gray-300 font-medium">Website:</td><td className="py-2"><a href={c.ralWebsite} className="text-brand-400 hover:underline" target="_blank" rel="noopener noreferrer">{c.ralWebsite}</a></td></tr>
                        </tbody>
                    </table>
                </SubSection>

                <SubSection title="2.2. Plataforma Europeia de Resolução de Litígios em Linha (ODR)">
                    <p>
                        Nos termos do <strong>art.º 14.º do Regulamento (UE) n.º 524/2013</strong>, a Comissão Europeia
                        disponibiliza uma plataforma de resolução de litígios em linha:{' '}
                        <a href="https://ec.europa.eu/consumers/odr/" className="text-brand-400 hover:underline" target="_blank" rel="noopener noreferrer">
                            ec.europa.eu/consumers/odr
                        </a>
                    </p>
                    <p>
                        O e-mail de contacto do Prestador para efeitos de submissão de litígio na plataforma ODR é:{' '}
                        <a href={`mailto:${c.email}`} className="text-brand-400 hover:underline">{c.email}</a>
                    </p>
                    <p>A utilização da plataforma ODR ou da entidade RAL é facultativa. O consumidor pode sempre recorrer diretamente aos tribunais judiciais competentes.</p>
                </SubSection>
            </Section>

            <Section title="3. Livro de Reclamações Eletrónico">
                <p>
                    Nos termos do <strong>Decreto-Lei n.º 74/2017, de 21 de junho</strong>, todos os consumidores têm o direito
                    de apresentar reclamação através do Livro de Reclamações Eletrónico:{' '}
                    <a href="https://www.livroreclamacoes.pt" className="text-brand-400 hover:underline" target="_blank" rel="noopener noreferrer">
                        www.livroreclamacoes.pt
                    </a>
                </p>
                <p>As reclamações submetidas são encaminhadas automaticamente para a entidade reguladora competente.</p>
            </Section>

            <Section title="4. Direito de Acesso à Justiça">
                <p>
                    O recurso a mecanismos de RAL é sempre facultativo e não prejudica o direito do consumidor de recorrer aos
                    tribunais judiciais competentes. Pode obter informações sobre os seus direitos junto da{' '}
                    <strong>Direção-Geral do Consumidor (DGC)</strong>:{' '}
                    <a href="https://www.consumidor.gov.pt" className="text-brand-400 hover:underline" target="_blank" rel="noopener noreferrer">
                        www.consumidor.gov.pt
                    </a>
                </p>
            </Section>

            <Section title="Referências Legais">
                <ul>
                    <li>Lei n.º 144/2015, de 8 de setembro — Resolução Alternativa de Litígios de Consumo</li>
                    <li>DL n.º 74/2017, de 21 de junho — Livro de Reclamações Eletrónico</li>
                    <li>Regulamento (UE) n.º 524/2013 — Resolução de Litígios em Linha (ODR)</li>
                    <li>Regulamento (UE) n.º 1215/2012 — Competência Judiciária (Bruxelas I Reformulado)</li>
                    <li>DL n.º 59/2021, de 14 de julho — Custo da chamada telefónica</li>
                    <li>Lei n.º 24/96, de 31 de julho — Lei de Defesa do Consumidor</li>
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