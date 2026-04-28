#!/usr/bin/env node
/**
 * migrate-cloudinary-to-r2.mjs
 *
 * Migra as fotos de perfil da Cloudinary para o Cloudflare R2.
 *
 * Instalação:
 *   npm install @aws-sdk/client-s3
 *
 * Execução:
 *   node scripts/migrate-cloudinary-to-r2.mjs
 *
 * Dry-run (lista o que faria, sem alterar nada):
 *   DRY_RUN=true node scripts/migrate-cloudinary-to-r2.mjs
 *
 * Onde encontrar cada valor:
 *   CLOUDINARY_CLOUD_NAME  — Cloudinary Dashboard → Settings → Account
 *   CF_ACCOUNT_ID          — Cloudflare Dashboard → lado direito (Account ID)
 *   R2_ACCESS_KEY_ID       — Cloudflare Dashboard → R2 → Manage R2 API tokens → Create token
 *   R2_SECRET_ACCESS_KEY   — idem (mostrado apenas uma vez ao criar)
 *   R2_BUCKET_NAME         — nome do bucket no Cloudflare R2 (ex: brooklyn-media)
 *   R2_PUBLIC_BASE_URL     — URL pública do bucket (ex: https://media.brooklynbarbearia.pt)
 *   D1_DATABASE_ID         — Cloudflare Dashboard → Workers & Pages → D1 → nome da DB → ID
 *   CF_API_TOKEN           — Cloudflare Dashboard → My Profile → API Tokens → criar token com perm. D1:Edit
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

// ─────────────────────────────────────────────────────────────────
// ❗  PREENCHER ANTES DE CORRER
// ─────────────────────────────────────────────────────────────────
const CONFIG = {
  // Cloudinary (site antigo)
  CLOUDINARY_CLOUD_NAME:  'PREENCHER',   // ex: 'dxyz123abc'

  // Cloudflare
  CF_ACCOUNT_ID:          'PREENCHER',   // ex: 'a1b2c3d4e5f6...'
  CF_API_TOKEN:           'PREENCHER',   // token com permissão D1:Edit

  // R2
  R2_ACCESS_KEY_ID:       'PREENCHER',   // criado em R2 → Manage R2 API tokens
  R2_SECRET_ACCESS_KEY:   'PREENCHER',   // mostrado apenas uma vez
  R2_BUCKET_NAME:         'PREENCHER',   // ex: 'brooklyn-media'
  R2_PUBLIC_BASE_URL:     'PREENCHER',   // ex: 'https://media.brooklynbarbearia.pt'

  // D1
  D1_DATABASE_ID:         'PREENCHER',   // UUID da base de dados D1
}
const DRY_RUN = process.env.DRY_RUN === 'true'
// ─────────────────────────────────────────────────────────────────

// Validar que todos os campos foram preenchidos
const missing = Object.entries(CONFIG).filter(([, v]) => v === 'PREENCHER').map(([k]) => k)
if (missing.length > 0) {
  console.error('\n❌ Preenche os seguintes campos no CONFIG antes de correr o script:')
  missing.forEach(k => console.error(`   - ${k}`))
  process.exit(1)
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${CONFIG.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     CONFIG.R2_ACCESS_KEY_ID,
    secretAccessKey: CONFIG.R2_SECRET_ACCESS_KEY,
  },
})

const PUBLIC_BASE = CONFIG.R2_PUBLIC_BASE_URL.replace(/\/$/, '')

/** Constrói a URL pública da Cloudinary a partir do publicId */
function cloudinaryUrl(publicId) {
  return `https://res.cloudinary.com/${CONFIG.CLOUDINARY_CLOUD_NAME}/image/upload/${publicId}`
}

/** Executa query SQL na D1 via REST API */
async function d1Query(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CF_ACCOUNT_ID}/d1/database/${CONFIG.D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CONFIG.CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  )
  const json = await res.json()
  if (!json.success) throw new Error(`D1 error: ${JSON.stringify(json.errors)}`)
  return json.result[0]
}

/** Verifica se chave já existe no R2 */
async function existsInR2(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: CONFIG.R2_BUCKET_NAME, Key: key }))
    return true
  } catch {
    return false
  }
}

async function main() {
  console.log(`\n🚀 Migração Cloudinary → R2${DRY_RUN ? ' [DRY RUN — sem alterações]' : ''}\n`)
  console.log('─'.repeat(60))

  // Buscar clientes com foto na Cloudinary (publicId, não URL completa)
  const { results: clientes } = await d1Query(
    `SELECT id, nome, email, foto_perfil
     FROM clientes
     WHERE foto_perfil IS NOT NULL
       AND foto_perfil NOT LIKE 'http%'
     ORDER BY id`
  )

  console.log(`📋 ${clientes.length} clientes com foto Cloudinary\n`)

  const stats = { sucesso: 0, jaExistia: 0, erro: 0 }
  const erros = []

  for (const { id, nome, email, foto_perfil } of clientes) {
    // Determinar extensão e chave R2
    const hasExt = /\.(jpg|jpeg|png|webp|gif)$/i.test(foto_perfil)
    const r2Key  = hasExt ? foto_perfil : `${foto_perfil}.jpg`
    const newUrl = `${PUBLIC_BASE}/${r2Key}`

    process.stdout.write(`  [${id}] ${nome}\n       ${foto_perfil}\n       → ${r2Key} ... `)

    try {
      const jaExiste = await existsInR2(r2Key)

      if (jaExiste) {
        process.stdout.write('⏭  já existe no R2\n')
        if (!DRY_RUN) {
          await d1Query(
            'UPDATE clientes SET foto_perfil = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
            [newUrl, id]
          )
        }
        stats.jaExistia++
        continue
      }

      // Download da Cloudinary
      const imgRes = await fetch(cloudinaryUrl(foto_perfil))
      if (!imgRes.ok) throw new Error(`Cloudinary HTTP ${imgRes.status}`)
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
      const buffer = Buffer.from(await imgRes.arrayBuffer())

      if (!DRY_RUN) {
        // Upload para R2
        await r2.send(new PutObjectCommand({
          Bucket:      CONFIG.R2_BUCKET_NAME,
          Key:         r2Key,
          Body:        buffer,
          ContentType: contentType,
        }))

        // Actualizar D1
        await d1Query(
          'UPDATE clientes SET foto_perfil = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
          [newUrl, id]
        )
      }

      process.stdout.write(`✅ ${(buffer.length / 1024).toFixed(1)} KB\n`)
      stats.sucesso++

    } catch (err) {
      process.stdout.write(`❌ ${err.message}\n`)
      stats.erro++
      erros.push({ id, nome, erro: err.message })
    }
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`✅ Migrados:   ${stats.sucesso}`)
  console.log(`⏭  Já existiam: ${stats.jaExistia}`)
  console.log(`❌ Erros:      ${stats.erro}`)

  if (erros.length > 0) {
    console.log('\nClientes com erro:')
    erros.forEach(e => console.log(`  #${e.id} ${e.nome}: ${e.erro}`))
  }

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN — nenhuma alteração efectuada.')
  } else if (stats.sucesso > 0 || stats.jaExistia > 0) {
    console.log('\n🏁 Migração concluída. Podes agora eliminar este script.')
  }
}

main().catch(err => {
  console.error('\n💥 Erro fatal:', err.message)
  process.exit(1)
})
