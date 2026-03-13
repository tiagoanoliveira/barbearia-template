import { barberShopConfig } from '@/config/theme'

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-gray-950 pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-black text-white mb-2">Política de Cookies</h1>
        <p className="text-gray-600 text-sm mb-10">Actualizado em Março de 2026</p>
        <div className="space-y-8 text-gray-400 text-sm leading-relaxed">
          <div>
            <h2 className="text-white font-bold text-base mb-3">O que são cookies?</h2>
            <p>Cookies são pequenos ficheiros de texto guardados no teu dispositivo quando visitas um sítio web. Servem para melhorar a experiência de navegação e guardar preferências.</p>
          </div>
          <div>
            <h2 className="text-white font-bold text-base mb-3">Cookies que utilizamos</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 text-white font-semibold">Cookie</th>
                    <th className="text-left py-2 pr-4 text-white font-semibold">Finalidade</th>
                    <th className="text-left py-2 text-white font-semibold">Duração</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    ['user_token',       'Sessão autenticada do utilizador',         'Sessão'],
                    ['cookies_accepted', 'Preferência de aceitação de cookies',      '1 ano'],
                    ['admin_token',      'Sessão autenticada do administrador',       'Sessão'],
                  ].map(([name, purpose, duration]) => (
                    <tr key={name}>
                      <td className="py-2 pr-4 font-mono text-brand-400">{name}</td>
                      <td className="py-2 pr-4">{purpose}</td>
                      <td className="py-2">{duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h2 className="text-white font-bold text-base mb-3">Gerir preferências</h2>
            <p>Podes aceitar ou recusar cookies através do banner que aparece na primeira visita. Podes também apagar os cookies nas definições do teu browser a qualquer momento.</p>
          </div>
          <div>
            <h2 className="text-white font-bold text-base mb-3">Contacto</h2>
            <p>Dúvidas sobre cookies? Contacta-nos em <a href={`mailto:${barberShopConfig.email}`} className="text-brand-400 hover:underline">{barberShopConfig.email}</a>.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
