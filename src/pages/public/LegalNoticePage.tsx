import { barberShopConfig } from '@/config/theme'

export default function LegalNoticePage() {
    const c = barberShopConfig
    return (
        <LegalPage title="Aviso Legal" updated={c.lastUpdated}>

            <Section title="1. Identificação do Titular do Website">
                <p>Em cumprimento do <strong>art.º 10.º do Decreto-Lei n.º 7/2004, de 7 de janeiro</strong> (Lei do Comércio Eletrónico), informa-se que o presente website é propriedade e operado por:</p>
                <table className="w-full text-xs border-collapse mt-2">
                    <tbody className="divide-y divide-gray-800">
                    <tr><td className="py-2 pr-4 text-gray-300 font-medium w-40">Denominação social:</td><td className="py-2">{c.legalName}</td></tr>
                    <tr><td className="py-2 pr-4 text-gray-300 font-medium">Forma jurídica:</td><td className="py-2">{c.legalForm}</td></tr>
                    <tr><td className="py-2 pr-4 text-gray-300 font-medium">Sede social:</td><td className="py-2">{c.address}</td></tr>
                    <tr><td className="py-2 pr-4 text-gray-300 font-medium">NIF:</td><td className="py-2">{c.nif}</td></tr>
                    <tr><td className="py-2 pr-4 text-gray-300 font-medium">E-mail:</td><td className="py-2"><a href={`mailto:${c.email}`} className="text-brand-400 hover:underline">{c.email}</a></td></tr>
                    <tr><td className="py-2 pr-4 text-gray-300 font-medium">Telefone:</td><td className="py-2"><a href={`tel:${c.phone}`} className="text-brand-400 hover:underline">{c.phone}</a> (chamada para rede móvel nacional)</td></tr>
                    </tbody>
                </table>
            </Section>

            <Section title="2. Objeto e Atividade">
                <p>O presente website tem por objeto a prestação de serviços de barbearia e a disponibilização de um sistema de reservas online. A atividade exercida está sujeita à fiscalização da <strong>ASAE — Autoridade de Segurança Alimentar e Económica</strong>, nos termos da legislação em vigor.</p>
            </Section>

            <Section title="3. Propriedade Intelectual">
                <p>Nos termos do <strong>Código do Direito de Autor e dos Direitos Conexos (DL n.º 63/85, de 14 de março)</strong> e do <strong>Código da Propriedade Industrial (DL n.º 110/2018, de 10 de dezembro)</strong>, todos os conteúdos presentes neste website — incluindo textos, imagens, logótipos, gráficos, vídeos, bases de dados, código-fonte e design — são propriedade exclusiva de <strong>{c.legalName}</strong> ou de terceiros que autorizaram a sua utilização.</p>
                <p>É expressamente proibida a reprodução, distribuição, transmissão, adaptação ou utilização de qualquer conteúdo sem autorização prévia e escrita do titular, exceto nas situações expressamente permitidas por lei.</p>
            </Section>

            <Section title="4. Hiperligações para Websites de Terceiros">
                <p>Este website pode conter hiperligações para websites de terceiros. A existência dessas hiperligações não implica aprovação, endosso ou responsabilidade por parte de <strong>{c.legalName}</strong> relativamente aos respetivos conteúdos, nos termos do <strong>art.º 14.º do DL n.º 7/2004, de 7 de janeiro</strong>.</p>
            </Section>

            <Section title="5. Limitação de Responsabilidade">
                <p><strong>{c.legalName}</strong> não se responsabiliza por danos resultantes de:</p>
                <ul>
                    <li>Interrupções temporárias ou falhas técnicas do website por causas alheias ao seu controlo, incluindo falhas de infraestrutura (Cloudflare, Cloudinary);</li>
                    <li>Vírus informáticos ou outros elementos nocivos que afetem os sistemas dos utilizadores;</li>
                    <li>Erros ou omissões nos conteúdos, sem prejuízo do dever de os corrigir;</li>
                    <li>Utilização indevida do website pelo utilizador em violação destes termos ou da legislação aplicável.</li>
                </ul>
                <p>A responsabilidade perante consumidores é enquadrada pela <strong>Lei de Defesa do Consumidor (Lei n.º 24/96, de 31 de julho)</strong> e pelo <strong>DL n.º 84/2021, de 18 de outubro</strong>.</p>
            </Section>

            <Section title="6. Proteção de Dados Pessoais">
                <p>O tratamento de dados pessoais é regulado pelo <strong>RGPD</strong> e pela <strong>Lei n.º 58/2019, de 8 de agosto</strong>, e encontra-se descrito na <a href="/privacidade" className="text-brand-400 hover:underline">Política de Privacidade</a>.</p>
            </Section>

            <Section title="7. Cookies">
                <p>Este website utiliza cookies e tecnologias semelhantes, nos termos da <strong>Lei n.º 41/2004, de 18 de agosto</strong> (com as alterações das Leis n.º 46/2012 e n.º 16/2022). Mais informação na <a href="/cookies" className="text-brand-400 hover:underline">Política de Cookies</a>.</p>
            </Section>

            <Section title="8. Lei Aplicável e Foro Competente">
                <p>
                    O presente Aviso Legal rege-se pela legislação portuguesa. Para resolução de litígios, é competente o tribunal da comarca de <strong>{c.comarca}</strong>, com expressa renúncia a qualquer outro, sem prejuízo do direito do consumidor de recorrer a mecanismos de RAL (Lei n.º 144/2015) ou ao tribunal da sua residência (Regulamento (UE) n.º 1215/2012).
                </p>
            </Section>

            <Section title="Referências Legais">
                <ul>
                    <li>DL n.º 7/2004, de 7 de janeiro — Lei do Comércio Eletrónico</li>
                    <li>DL n.º 63/85, de 14 de março — Código do Direito de Autor</li>
                    <li>DL n.º 110/2018, de 10 de dezembro — Código da Propriedade Industrial</li>
                    <li>Lei n.º 24/96, de 31 de julho — Lei de Defesa do Consumidor</li>
                    <li>DL n.º 84/2021, de 18 de outubro — Garantias de Bens de Consumo</li>
                    <li>Regulamento (UE) 2016/679 — RGPD</li>
                    <li>Lei n.º 58/2019, de 8 de agosto — Execução do RGPD em Portugal</li>
                    <li>Lei n.º 41/2004 (alterada pela Lei n.º 46/2012 e Lei n.º 16/2022) — Privacidade nas comunicações eletrónicas</li>
                    <li>Lei n.º 144/2015, de 8 de setembro — Resolução Alternativa de Litígios</li>
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