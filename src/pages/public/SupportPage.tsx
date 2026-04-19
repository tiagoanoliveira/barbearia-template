import { barberShopConfig } from '@/config/theme'

export default function SupportPage() {
  return (
    <iframe
      title="Suporte"
      src={barberShopConfig.supportIframeSrc}
      className="w-full h-dvh border-0"
      loading="lazy"
    />
  )
}
