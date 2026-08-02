// functions/api/admin/invoicing/emit.js
import { getMoloniToken } from '../../../utils/moloni-auth'

const MOLONI_API = 'https://api.molonion.pt'

// ── Helper: encontrar produto existente na Moloni pelo nome, ou criar um novo ──
async function getMoloniProductId(token, companyId, name, price) {
    // 1. Procurar produto existente pelo nome
    const searchRes = await fetch(
        `${MOLONI_API}/products?company_id=${companyId}&search=${encodeURIComponent(name)}`,
        { headers: { Authorization: `Bearer ${token}` } }
    )
    if (searchRes.ok) {
        const { data } = await searchRes.json()
        if (Array.isArray(data) && data.length > 0) {
            return data[0].product_id
        }
    }

    // 2. Produto não existe — obter o ID da taxa normal (23%)
    const taxRes = await fetch(
        `${MOLONI_API}/taxes?company_id=${companyId}`,
        { headers: { Authorization: `Bearer ${token}` } }
    )
    let taxId = null
    if (taxRes.ok) {
        const { data: taxes } = await taxRes.json()
        const iva = taxes?.find(t => t.value == 23 || /normal/i.test(t.name))
        taxId = iva?.tax_id ?? null
    }

    // 3. Criar o produto
    const createRes = await fetch(`${MOLONI_API}/products`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            company_id: companyId,
            name,
            price,
            type: 2, // serviço
            taxes: taxId ? [{ tax_id: taxId, value: 23, order: 1, cumulative: 0 }] : [],
        }),
    })

    if (!createRes.ok) {
        const errText = await createRes.text()
        throw new Error(`Falha ao criar produto "${name}" na Moloni: ${errText}`)
    }

    const created = await createRes.json()
    return created?.data?.product_id ?? null
}

export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json()
        const { reservation_id, nif, customer_name, customer_email, lines } = body

        // 1. Obter token de acesso Moloni On
        const token = await getMoloniToken(env) // usa MOLONI_CLIENT_ID + MOLONI_CLIENT_SECRET

        // 2. Resolver (ou criar) produto na Moloni para cada linha
        const products = await Promise.all(
            lines.map(async (l, idx) => {
                const productId = await getMoloniProductId(
                    token,
                    env.MOLONI_COMPANY_ID,
                    l.description,
                    l.unit_price
                )
                return {
                    product_id: productId,
                    name: l.description,
                    qty: l.quantity,
                    price: l.unit_price,
                    discount: 0,
                    order: idx + 1,
                }
            })
        )

        // 3. Construir payload da fatura
        const invoice = {
            company_id: env.MOLONI_COMPANY_ID,
            date: new Date().toISOString().split('T')[0],
            expiration_date: new Date().toISOString().split('T')[0],
            financial_discount: 0,
            special_discount: 0,
            our_reference: `RES-${reservation_id}`,
            your_reference: '',
            notes: '',
            products,
            customer: {
                vat: nif ?? '999999990',  // 999999990 = consumidor final em Portugal
                name: customer_name,
                email: customer_email ?? '',
            },
            // send_email: true,  // descomentar para enviar fatura por email
        }

        // 4. Emitir fatura (invoiceReceipts = fatura-recibo simplificada)
        const res = await fetch(`${MOLONI_API}/invoiceReceipts`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(invoice),
        })

        if (!res.ok) {
            const errText = await res.text()
            let errParsed = errText
            try { errParsed = JSON.parse(errText) } catch {}
            return Response.json({ success: false, error: errParsed }, { status: 422 })
        }

        const data = await res.json()
        return Response.json({ success: true, data })

    } catch (e) {
        console.error('[invoicing/emit] erro:', e)
        return Response.json(
            { success: false, error: e?.message ?? 'Erro interno no servidor' },
            { status: 500 }
        )
    }
}