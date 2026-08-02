// functions/api/admin/invoicing/emit.js
// Emissão de faturas-recibo via Moloni ON (GraphQL API, autenticação por API Key)

const MOLONI_ENDPOINT = 'https://api.molonion.pt/v1'
const INVOICE_RECEIPT_TYPE_ID = 27 // Invoice Receipt (FR)

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
        throw new Error(`Erro GraphQL Moloni: ${JSON.stringify(json.errors)}`)
    }

    return json.data
}

// ── Resolver paymentMethodId a partir do nome escolhido no Checkout ────────
async function getPaymentMethodId(env, companyId, paymentMethodName) {
    const data = await moloniRequest(env, `
        query GetPaymentMethods($companyId: Int!) {
            paymentMethods(companyId: $companyId, options: { pagination: { page: 1, qty: 50 } }) {
                errors { field msg }
                data { paymentMethodId name isDefault }
            }
        }
    `, { companyId })

    const errors = data?.paymentMethods?.errors
    if (errors && errors.length > 0) {
        throw new Error(`Erro ao obter métodos de pagamento: ${JSON.stringify(errors)}`)
    }

    const methods = data?.paymentMethods?.data ?? []
    if (methods.length === 0) {
        throw new Error('Não existe nenhum método de pagamento configurado na Moloni.')
    }

    // Mapeamento entre os valores usados no Checkout e nomes prováveis na Moloni
    const aliasMap = {
        'multibanco': ['multibanco', 'mb', 'cartão'],
        'dinheiro':   ['dinheiro', 'numerário', 'numerario', 'cash'],
        'outro':      ['outro', 'transferência', 'transferencia', 'outros'],
    }

    if (paymentMethodName) {
        const key = paymentMethodName.trim().toLowerCase()
        const aliases = aliasMap[key] ?? [key]

        const matched = methods.find(m =>
            aliases.some(alias => m.name.toLowerCase().includes(alias))
        )
        if (matched) return matched.paymentMethodId
    }

    // Fallback: usar o metodo marcado como isDefault, ou o primeiro da lista
    const fallback = methods.find(m => m.isDefault) ?? methods[0]
    return fallback.paymentMethodId
}

// ── Obter automaticamente o documentSetId da série "Faturas-Recibo" ────────
async function getDocumentSetId(env, companyId) {
    if (env.MOLONI_DOCUMENT_SET_ID) {
        return Number(env.MOLONI_DOCUMENT_SET_ID)
    }

    const result = await moloniRequest(env, `
        query GetDocumentSets($companyId: Int!, $documentTypeId: Int!) {
            documentSetsForDocument(companyId: $companyId, documentTypeId: $documentTypeId) {
                errors { field msg }
                data {
                    documentSetId
                    name
                    isDefault
                }
            }
        }
    `, { companyId, documentTypeId: INVOICE_RECEIPT_TYPE_ID })

    const errors = result?.documentSetsForDocument?.errors
    if (errors && errors.length > 0) {
        throw new Error(`Erro ao obter séries de documentos: ${JSON.stringify(errors)}`)
    }

    const sets = result?.documentSetsForDocument?.data ?? []
    if (sets.length === 0) {
        throw new Error('Não existe nenhuma série de "Faturas-Recibo" configurada na Moloni.')
    }

    const defaultSet = sets.find(s => s.isDefault) ?? sets[0]
    return defaultSet.documentSetId
}

// ── Obter o ID da taxa normal (23%) da empresa ──────────────────────────────
async function getStandardTaxId(env, companyId) {
    const data = await moloniRequest(env, `
        query GetTaxes($companyId: Int!) {
            taxes(companyId: $companyId, options: { pagination: { page: 1, qty: 50 } }) {
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

// ── Obter categoria de produto por omissão (cria uma se não existir) ───────
async function getDefaultCategoryId(env, companyId) {
    const data = await moloniRequest(env, `
        query GetCategories($companyId: Int!) {
            productCategories(companyId: $companyId, options: { pagination: { page: 1, qty: 10 } }) {
                errors { field msg }
                data { productCategoryId name }
            }
        }
    `, { companyId })

    const categories = data?.productCategories?.data ?? []
    if (categories.length > 0) return categories[0].productCategoryId

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

// ── Obter unidade de medida por omissão (cria uma se não existir) ──────────
async function getDefaultMeasurementUnitId(env, companyId) {
    const data = await moloniRequest(env, `
        query GetUnits($companyId: Int!) {
            measurementUnits(companyId: $companyId, options: { pagination: { page: 1, qty: 50 } }) {
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
            products(companyId: $companyId, options: {
                search: { field: ALL, value: $search }
                pagination: { page: 1, qty: 10 }
            }) {
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
                customers(companyId: $companyId, options: {
                    search: { field: ALL, value: $search }
                    pagination: { page: 1, qty: 10 }
                }) {
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
        const { reservation_id, nif, customer_name, customer_email, lines, payment_method } = body

        if (!Array.isArray(lines) || lines.length === 0) {
            return Response.json({ success: false, error: 'Nenhuma linha de fatura foi enviada.' }, { status: 400 })
        }

        const companyId = Number(env.MOLONI_COMPANY_ID)
        if (!companyId) throw new Error('MOLONI_COMPANY_ID não está configurado.')

        // 1. Resolver série de documentos, taxa, categoria e unidade de medida
        const documentSetId = await getDocumentSetId(env, companyId)
        const taxId = await getStandardTaxId(env, companyId)
        const categoryId = await getDefaultCategoryId(env, companyId)
        const measurementUnitId = await getDefaultMeasurementUnitId(env, companyId)
        const paymentMethodId = await getPaymentMethodId(env, companyId, payment_method)

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

        const totalValue = productsPayload.reduce((sum, p) => sum + p.qty * p.price, 0)
        const todayIso = new Date().toISOString()

        // 4. Emitir a fatura-recibo
        const invoiceData = await moloniRequest(env, `
            mutation CreateInvoiceReceipt(
                $companyId: Int!
                $documentSetId: Int!
                $customerId: Int!
                $date: DateTime!
                $expirationDate: Date!
                $ourReference: String
                $products: [DocumentProductInput!]!
                $payments: [DocumentPaymentMethodInput]!
            ) {
                invoiceReceiptCreate(
                    companyId: $companyId
                    data: {
                        documentSetId: $documentSetId
                        customerId: $customerId
                        date: $date
                        expirationDate: $expirationDate
                        status: 1
                        ourReference: $ourReference
                        products: $products
                        payments: $payments
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
            date: todayIso,
            expirationDate: todayIso.split('T')[0],
            ourReference: `RES-${reservation_id}`,
            products: productsPayload,
            payments: [
                {
                    paymentMethodId,
                    date: todayIso,
                    value: totalValue,
                },
            ],
        })

        const errors = invoiceData?.invoiceReceiptCreate?.errors
        if (errors && errors.length > 0) {
            return Response.json({ success: false, error: errors }, { status: 422 })
        }

        return Response.json({ success: true, data: invoiceData.invoiceReceiptCreate.data })

    } catch (e) {
        console.error('[invoicing/emit] erro:', e)
        return Response.json(
            { success: false, error: e?.message ?? 'Erro interno no servidor' },
            { status: 500 }
        )
    }
}