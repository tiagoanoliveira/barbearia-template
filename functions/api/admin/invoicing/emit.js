// functions/api/admin/invoicing/emit.js
// Emissão de faturas via Moloni ON (GraphQL API, autenticação por API Key)

const MOLONI_ENDPOINT = 'https://api.molonion.pt/v1'

// ── Helper genérico: executar uma query/mutation GraphQL na Moloni ON ──────
async function moloniRequest(env, query, variables = {}) {
    if (!env.MOLONI_API_KEY) {
        throw new Error('MOLONI_API_KEY não está configurada nas variáveis de ambiente.')
    }

    const res = await fetch(MOLONI_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.MOLONI_API_KEY}`,
        },
        body: JSON.stringify({ query, variables }),
    })

    const raw = await res.text()

    let json
    try {
        json = JSON.parse(raw)
    } catch {
        throw new Error(`Moloni devolveu resposta não-JSON (HTTP ${res.status}): ${raw.slice(0, 300)}`)
    }

    if (!res.ok) {
        throw new Error(`Erro HTTP Moloni (${res.status}): ${JSON.stringify(json)}`)
    }

    if (json.errors) {
        // Erros GraphQL de nível superior (sintaxe, autenticação, etc.)
        throw new Error(`Erro GraphQL Moloni: ${JSON.stringify(json.errors)}`)
    }

    return json.data
}

// ── Obter o ID da taxa normal (23%) da empresa ──────────────────────────────
async function getStandardTaxId(env, companyId) {
    const data = await moloniRequest(env, `
        query GetTaxes($companyId: Int!) {
            taxes(companyId: $companyId) {
                errors { field msg }
                data { taxId name value isDefault }
            }
        }
    `, { companyId })

    const taxes = data?.taxes?.data ?? []
    const tax = taxes.find(t => Number(t.value) === 23) ?? taxes.find(t => t.isDefault)

    if (!tax) {
        throw new Error('Não foi possível encontrar a taxa de IVA normal (23%) na Moloni.')
    }
    return tax.taxId
}

// ── Obter categoria de produto e unidade de medida por omissão ─────────────
async function getDefaultCategoryId(env, companyId) {
    const data = await moloniRequest(env, `
        query GetCategories($companyId: Int!) {
            productCategories(companyId: $companyId) {
                errors { field msg }
                data { productCategoryId name }
            }
        }
    `, { companyId })

    const categories = data?.productCategories?.data ?? []
    if (categories.length > 0) return categories[0].productCategoryId

    // Nenhuma categoria existe — criar uma genérica
    const created = await moloniRequest(env, `
        mutation CreateCategory($companyId: Int!) {
            productCategoryCreate(companyId: $companyId, data: { name: "Barbearia" }) {
                errors { field msg }
                data { productCategoryId }
            }
        }
    `, { companyId })

    return created?.productCategoryCreate?.data?.productCategoryId
}

async function getDefaultMeasurementUnitId(env, companyId) {
    const data = await moloniRequest(env, `
        query GetUnits($companyId: Int!) {
            measurementUnits(companyId: $companyId) {
                errors { field msg }
                data { measurementUnitId name abbreviation }
            }
        }
    `, { companyId })

    const units = data?.measurementUnits?.data ?? []
    const unit = units.find(u => /un/i.test(u.abbreviation)) ?? units[0]
    if (unit) return unit.measurementUnitId

    const created = await moloniRequest(env, `
        mutation CreateUnit($companyId: Int!) {
            measurementUnitCreate(companyId: $companyId, data: { name: "Unidade", abbreviation: "un" }) {
                errors { field msg }
                data { measurementUnitId }
            }
        }
    `, { companyId })

    return created?.measurementUnitCreate?.data?.measurementUnitId
}

// ── Encontrar produto/serviço pelo nome, ou criar se não existir ───────────
async function getOrCreateProductId(env, companyId, name, price, taxId, categoryId, measurementUnitId) {
    const searchData = await moloniRequest(env, `
        query FindProduct($companyId: Int!, $search: String!) {
            products(companyId: $companyId, search: $search) {
                errors { field msg }
                data { productId name price }
            }
        }
    `, { companyId, search: name })

    const found = (searchData?.products?.data ?? []).find(
        p => p.name.trim().toLowerCase() === name.trim().toLowerCase()
    )
    if (found) return found.productId

    const createData = await moloniRequest(env, `
        mutation CreateProduct(
            $companyId: Int!
            $productCategoryId: Int!
            $name: String!
            $price: Float!
            $measurementUnitId: Int!
            $taxId: Int!
        ) {
            productCreate(
                companyId: $companyId
                data: {
                    productCategoryId: $productCategoryId
                    type: 2
                    name: $name
                    price: $price
                    measurementUnitId: $measurementUnitId
                    taxes: [{ taxId: $taxId, ordering: 1 }]
                    productAT: { productType: S }
                }
            ) {
                errors { field msg }
                data { productId name }
            }
        }
    `, { companyId, productCategoryId: categoryId, name, price, measurementUnitId, taxId })

    const errors = createData?.productCreate?.errors
    if (errors && errors.length > 0) {
        throw new Error(`Erro ao criar produto "${name}": ${JSON.stringify(errors)}`)
    }

    return createData?.productCreate?.data?.productId
}

// ── Encontrar cliente pelo NIF, ou criar se não existir ─────────────────────
async function getOrCreateCustomerId(env, companyId, vat, name, email) {
    if (vat && vat !== '999999990') {
        const searchData = await moloniRequest(env, `
            query FindCustomer($companyId: Int!, $search: String!) {
                customers(companyId: $companyId, search: $search) {
                    errors { field msg }
                    data { customerId vat name }
                }
            }
        `, { companyId, search: vat })

        const found = (searchData?.customers?.data ?? []).find(c => c.vat === vat)
        if (found) return found.customerId
    }

    const createData = await moloniRequest(env, `
        mutation CreateCustomer(
            $companyId: Int!
            $vat: String
            $name: String!
            $email: String
        ) {
            customerCreate(
                companyId: $companyId
                data: {
                    vat: $vat
                    name: $name
                    email: $email
                    countryId: 1
                    languageId: 1
                }
            ) {
                errors { field msg }
                data { customerId name }
            }
        }
    `, { companyId, vat: vat ?? '999999990', name, email: email || null })

    const errors = createData?.customerCreate?.errors
    if (errors && errors.length > 0) {
        throw new Error(`Erro ao criar cliente "${name}": ${JSON.stringify(errors)}`)
    }

    return createData?.customerCreate?.data?.customerId
}

// ── Handler principal ────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json()
        const { reservation_id, nif, customer_name, customer_email, lines } = body

        if (!Array.isArray(lines) || lines.length === 0) {
            return Response.json({ success: false, error: 'Nenhuma linha de fatura foi enviada.' }, { status: 400 })
        }

        const companyId = Number(env.MOLONI_COMPANY_ID)
        const documentSetId = Number(env.MOLONI_DOCUMENT_SET_ID)

        if (!companyId) throw new Error('MOLONI_COMPANY_ID não está configurado.')
        if (!documentSetId) throw new Error('MOLONI_DOCUMENT_SET_ID não está configurado.')

        // 1. Recolher dados de apoio (taxa, categoria, unidade) em paralelo
        const taxId = await getStandardTaxId(env, companyId)
        const categoryId = await getDefaultCategoryId(env, companyId)
        const measurementUnitId = await getDefaultMeasurementUnitId(env, companyId)

        // 2. Resolver (ou criar) cada produto/serviço da fatura
        const productsPayload = []
        for (const [idx, l] of lines.entries()) {
            const productId = await getOrCreateProductId(
                env, companyId, l.description, l.unit_price, taxId, categoryId, measurementUnitId
            )
            productsPayload.push({
                productId,
                qty: l.quantity,
                price: l.unit_price,
                ordering: idx + 1,
            })
        }

        // 3. Resolver (ou criar) o cliente
        const customerId = await getOrCreateCustomerId(
            env, companyId, nif, customer_name, customer_email
        )

        // 4. Emitir a fatura finalizada
        const invoiceData = await moloniRequest(env, `
            mutation CreateInvoice(
                $companyId: Int!
                $documentSetId: Int!
                $customerId: Int!
                $date: DateTime!
                $ourReference: String
                $products: [InvoiceProductInput!]!
            ) {
                invoiceCreate(
                    companyId: $companyId
                    data: {
                        documentSetId: $documentSetId
                        customerId: $customerId
                        date: $date
                        status: 1
                        ourReference: $ourReference
                        products: $products
                    }
                ) {
                    errors { field msg }
                    data { documentId number totalValue status }
                }
            }
        `, {
            companyId,
            documentSetId,
            customerId,
            date: new Date().toISOString(),
            ourReference: `RES-${reservation_id}`,
            products: productsPayload,
        })

        const errors = invoiceData?.invoiceCreate?.errors
        if (errors && errors.length > 0) {
            return Response.json({ success: false, error: errors }, { status: 422 })
        }

        return Response.json({ success: true, data: invoiceData.invoiceCreate.data })

    } catch (e) {
        console.error('[invoicing/emit] erro:', e)
        return Response.json(
            { success: false, error: e?.message ?? 'Erro interno no servidor' },
            { status: 500 }
        )
    }
}