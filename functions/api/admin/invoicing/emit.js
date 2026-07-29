// functions/api/admin/invoicing/emit.js
import { getMoloniToken } from '../../../utils/moloni-auth'

export async function onRequestPost({ request, env }) {
    const body = await request.json()
    const { reservation_id, nif, customer_name, customer_email, lines, total_override } = body

    // 1. Obter token de acesso Moloni On
    const token = await getMoloniToken(env) // usa MOLONI_CLIENT_ID + MOLONI_CLIENT_SECRET

    // 2. Construir payload da fatura
    const invoice = {
        company_id: env.MOLONI_COMPANY_ID,
        date: new Date().toISOString().split('T')[0],
        expiration_date: new Date().toISOString().split('T')[0],
        financial_discount: 0,
        special_discount: 0,
        our_reference: `RES-${reservation_id}`,
        your_reference: '',
        notes: '',
        products: lines.map(l => ({
            product_id: env.MOLONI_DEFAULT_PRODUCT_ID,  // produto genérico de serviço
            name: l.description,
            qty: l.quantity,
            price: l.unit_price,
            discount: 0,
            order: 1,
            taxes: [{ tax_id: env.MOLONI_TAX_ID, value: 23, order: 1, cumulative: 0 }],
        })),
        customer: {
            vat: nif ?? '999999990',  // 999999990 = consumidor final em Portugal
            name: customer_name,
            email: customer_email ?? '',
        },
        // send_email: true,  // descomentar para enviar fatura por email
    }

    // 3. Emitir fatura (invoiceReceipts = fatura-recibo simplificada)
    const res = await fetch('https://api.molonion.pt/invoiceReceipts', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoice),
    })

    if (!res.ok) {
        const err = await res.json()
        return Response.json({ success: false, error: err }, { status: 422 })
    }

    const data = await res.json()
    return Response.json({ success: true, data })
}