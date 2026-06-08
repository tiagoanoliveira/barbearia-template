import { barberShopConfig } from '@/config/theme'

export default function SupportPage() {
  return (
      <div>
        <h1 className="text-3xl font-black text-black pt-14 pb-4">Suporte</h1>
        <iframe
            title="Suporte"
            src={barberShopConfig.supportIframeSrc}
            className="w-full h-dvh border-0"
            loading="lazy"
        />
      </div>
  )
}
