import { barberShopConfig } from '@/config/theme'

export default function SupportPage() {
  return (
    <iframe
      title="Suporte"
      src={barberShopConfig.supportIframeSrc}
      className="w-full min-h-[calc(100vh-6rem)] border-0"
      loading="lazy"
    />
  )
}
