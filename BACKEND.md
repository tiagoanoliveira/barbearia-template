# Backend — Cloudflare Pages Functions + D1

## Arquitectura

```
Cloudflare Pages
├── dist/               ← Vite build (React SPA)
└── functions/
    ├── utils/             ← helpers partilhados
    │   ├── jwt.js           ← sign/verify JWT (Web Crypto)
    │   ├── crypto.js        ← hashPassword / verifyPassword (PBKDF2)
    │   ├── auth.js          ← authenticateClient / authenticateAdmin
    │   ├── response.js      ← ok/created/badRequest/unauthorized/...
    │   ├── validators.js    ← isValidDate / isValidTime / isValidId
    │   └── slots.js         ← computeSlots() — lógica de horários
    └── api/
        ├── auth/
        │   ├── login.js         POST /api/auth/login
        │   └── register.js      POST /api/auth/register
        ├── me.js              GET|PUT  /api/me
        ├── services.js        GET      /api/services
        ├── barbers.js         GET      /api/barbers
        ├── slots.js           GET      /api/slots?date=&barber_id=&service_id=
        ├── reservations.js    POST     /api/reservations
        ├── reservations/
        │   └── [id].js          DELETE   /api/reservations/:id
        ├── my-reservations.js GET      /api/my-reservations
        └── admin/
            ├── login.js         POST     /api/admin/login
            ├── dashboard.js     GET      /api/admin/dashboard
            ├── reservations.js  GET|POST /api/admin/reservations
            ├── reservations/
            │   └── [id].js        GET|PATCH|DELETE /api/admin/reservations/:id
            ├── clients.js       GET      /api/admin/clients
            ├── clients/
            │   └── [id].js        GET      /api/admin/clients/:id
            ├── barbers.js       GET|POST /api/admin/barbers
            ├── barbers/
            │   └── [id].js        PUT|DELETE /api/admin/barbers/:id
            ├── services.js      GET|POST /api/admin/services
            ├── services/
            │   └── [id].js        PUT|DELETE /api/admin/services/:id
            ├── unavailabilities.js     GET|POST /api/admin/unavailabilities
            └── unavailabilities/
                └── [id].js        DELETE /api/admin/unavailabilities/:id
```

## Configuração

### 1. Criar base de dados D1

```bash
npx wrangler d1 create barbearia-template
# Copiar o database_id para wrangler.toml
```

### 2. Aplicar schema

```bash
npx wrangler d1 execute barbearia-template --file=./schema.sql
```

### 3. Configurar secrets

```bash
npx wrangler secret put JWT_SECRET          # chave JWT clientes
npx wrangler secret put JWT_ADMIN_SECRET    # chave JWT admins
npx wrangler secret put RESEND_API_KEY      # emails transacionais
```

### 4. Criar admin inicial

```bash
# Gerar hash da password:
node -e "
import('./functions/utils/crypto.js').then(async ({hashPassword}) => {
  console.log(await hashPassword('SUA_PASSWORD_AQUI'))
})"

# Inserir na BD:
npx wrangler d1 execute barbearia-template --command \
  "INSERT INTO admins (nome,email,password_hash) VALUES ('Admin','admin@email.pt','<hash>')"
```

### 5. Dev local

```bash
npm run dev
# Cloudflare Pages dev com D1 local automático via wrangler
```

### 6. Deploy

```bash
npm run build
npx wrangler pages deploy dist
# ou ligar ao GitHub para deploy automático
```

## Segurança

| Mecanismo | Detalhe |
|---|---|
| Passwords | PBKDF2-SHA256, 100,000 iter., salt 16B aleatório |
| JWT clientes | HS256, expira em 30 dias, via `JWT_SECRET` |
| JWT admins | HS256, expira em 7 dias, via `JWT_ADMIN_SECRET` |
| CORS | `*` por defeito (restringir em produção) |
| Inputs | Sanitização + validações em todos os endpoints |
| Conflitos | Double-booking verificado com queries atómicas |

## Stack

- **Runtime:** Cloudflare Workers (Edge)
- **Database:** Cloudflare D1 (SQLite)
- **Emails:** Resend API
- **Auth:** JWT HS256 (Web Crypto API nativa)
- **Crypto:** PBKDF2 (Web Crypto API nativa — sem dependências)
