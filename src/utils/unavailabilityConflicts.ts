import type { UnavailabilityConflictReservation } from '@/components/admin/unavailable/unavailability-modals'
import type { ApiResponse } from '@/types'

export function extractUnavailabilityConflicts(response: ApiResponse<unknown>) {
  const byData = (response.data as { conflicts?: UnavailabilityConflictReservation[] } | undefined)?.conflicts
  const byRoot = (response as unknown as { conflicts?: UnavailabilityConflictReservation[] }).conflicts
  return byData ?? byRoot ?? []
}
