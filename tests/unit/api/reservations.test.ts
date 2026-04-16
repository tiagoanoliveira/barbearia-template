import { adminApi } from '../../../src/api/client'
import { reservationsApi } from '../../../src/api/reservations'

vi.mock('../../../src/api/client', () => ({
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('reservations api', () => {
  it('list constrói query params corretos', async () => {
    const response = { success: true, data: { items: [], total: 0, page: 2, perPage: 10, totalPages: 0 } }
    vi.mocked(adminApi.get).mockResolvedValueOnce(response)

    const result = await reservationsApi.list({
      page: 2,
      perPage: 10,
      status: 'confirmada',
      barberId: 3,
      search: 'joão',
    })

    expect(adminApi.get).toHaveBeenCalledWith(
      '/api/admin/reservations?offset=10&limit=10&status=confirmada&barber_id=3&search=jo%C3%A3o',
    )
    expect(result).toBe(response)
  })

  it('updateStatus envia payload esperado', async () => {
    vi.mocked(adminApi.patch).mockResolvedValueOnce({ success: true, data: {} })

    await reservationsApi.updateStatus(12, 'cancelada')

    expect(adminApi.patch).toHaveBeenCalledWith('/api/admin/reservations/12', { status: 'cancelada' })
  })
})
