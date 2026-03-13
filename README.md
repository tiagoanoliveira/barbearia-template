# Barbearia Template

Template moderno para websites de barbearia com painel de administração completo.

## Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Estilos**: Tailwind CSS v4
- **Gráficos**: Recharts
- **Calendário**: FullCalendar React
- **Estado/API**: TanStack Query (React Query)
- **Backend**: Cloudflare Pages Functions + D1 + KV

## Estrutura

```
barbearia-template/
├── src/
│   ├── components/        # Componentes reutilizáveis (Sidebar, Card, Modal...)
│   ├── pages/
│   │   ├── admin/         # Dashboard, Reservas, Clientes, Calendário...
│   │   └── public/        # Homepage, Serviços, Contacto
│   ├── config/            # Tema, cores, nome da barbearia
│   ├── api/               # Camada de chamadas ao backend
│   ├── hooks/             # Custom React hooks
│   └── types/             # TypeScript types/interfaces
├── functions/             # Cloudflare Workers (API routes)
├── public/                # Assets estáticos
├── tailwind.config.ts
└── wrangler.toml
```

## Para cada nova barbearia

1. Fazer fork deste repositório
2. Editar `src/config/theme.ts` → nome, cores, logo
3. Configurar `wrangler.toml` → novo D1, KV, domínio
4. Aplicar `database.sql` na nova instância D1
5. Configurar secrets via `wrangler secret put`

## Desenvolvimento local

```bash
npm install
npm run dev
```

## Deploy (Cloudflare Pages)

```bash
npm run build
npx wrangler pages deploy dist
```
