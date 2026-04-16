import client from '../../../src/api/client'
import * as reservationsApi from '../../../src/api/reservations'

vi.mock('../../../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('reservations api', () => {
  it('listar reservas chama endpoint correcto', async () => {
    ;(client.get as any).mockResolvedValueOnce({ data: [] })

    const result = await reservationsApi.listReservations()

    expect(client.get).toHaveBeenCalled()
    expect(result).toEqual([])
  })
})
