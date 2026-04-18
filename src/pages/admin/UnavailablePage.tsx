import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, CalendarOff, Eye, ChevronDown, ChevronUp, Filter } from 'lucide-react'
import { format, parseISO, isAfter, startOfDay } from 'date-fns'
import { pt } from 'date-fns/locale'

import { barbersApi } from '@/api/barbers'
import { Card } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { Unavailable, UnavailableTipo } from '@/types'
import { useAdminUser } from '@/hooks/useAdminUser'
import { UnavailableEditorForm } from '@/components/admin/unavailable/UnavailableEditorForm'
import { UnavailabilityConflictsModal, type UnavailabilityConflictReservation } from '@/components/admin/unavailable/unavailability-modals'

const TYPE_LABELS: Record<UnavailableTipo, string> = {
  folga:    'Folga',
  almoco:   'Almoço',
  ferias:   'Férias',
  ausencia: 'Ausência',
  outro:    'Outro',
}
const TYPE_ICONS: Record<UnavailableTipo, string> = {
  folga:    '✈️',
  almoco:   '🍴',
  ferias:   '🏖️',
  ausencia: '🚫',
  outro:    '📌',
}
const TYPE_COLORS: Record<UnavailableTipo, string> = {
  folga:    'bg-blue-100 text-blue-700',
  almoco:   'bg-yellow-100 text-yellow-700',
  ferias:   'bg-emerald-100 text-emerald-700',
  ausencia: 'bg-red-100 text-red-700',
  outro:    'bg-gray-100 text-gray-600',
}

type UnavailableFormState = Partial<Unavailable> & { recurrence_end_date?: string }

const EMPTY_FORM: UnavailableFormState = {
  barbeiro_id: 0,
  data_hora_inicio: '',
  data_hora_fim: '',
  tipo: 'folga',
  motivo: '',
  is_all_day: 1,
  recurrence_type: 'none',
}

type GroupDetailState = {
  group_id: string
  items: Unavailable[]
} | null

export default function UnavailablePage() {
  const adminUser = useAdminUser()
  const isBarber = adminUser?.role === 'barbeiro'
  const loggedBarberId = isBarber && adminUser?.barbeiro_id ? adminUser.barbeiro_id : null
  const qc = useQueryClient()
  const [modal, setModal]           = useState(false)
  const [editTarget, setEditTarget] = useState<Unavailable | null>(null)
  const [form, setForm]             = useState<UnavailableFormState>(EMPTY_FORM)
  const [groupDetail, setGroupDetail] = useState<GroupDetailState>(null)
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())
  const [formError, setFormError] = useState<string | null>(null)
  const [submitSaving, setSubmitSaving] = useState(false)
  const [pendingCreatePayload, setPendingCreatePayload] = useState<Partial<Unavailable> | null>(null)
  const [conflictReservations, setConflictReservations] = useState<UnavailabilityConflictReservation[]>([])

  const [filterBarberId, setFilterBarberId] = useState<number | 'all'>(loggedBarberId ?? 'all')
  const [filterFrom, setFilterFrom]         = useState('')
  const [filterTo, setFilterTo]             = useState('')

  const { data: barbersRes } = useQuery({ queryKey: ['barbers'], queryFn: () => barbersApi.list() })
  const { data: unavailRes, isLoading } = useQuery({
    queryKey: ['unavailable', loggedBarberId],
    queryFn:  () => barbersApi.listUnavailable({ barberId: loggedBarberId ?? undefined }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => barbersApi.deleteUnavailable(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unavailable'] }),
  })
  const removeGroup = useMutation({
    mutationFn: (groupId: string) => barbersApi.deleteGroup(groupId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['unavailable'] }); setGroupDetail(null) },
  })

  const barbers    = (barbersRes?.data ?? []).filter(b => b.active)
  const allItems: Unavailable[] = (unavailRes?.data ?? []) as unknown as Unavailable[]

  const now = startOfDay(new Date())
  const onlyFuture = allItems.filter(u => {
    const end = parseISO(u.data_hora_fim)
    return isAfter(end, now)
  })

  const effectiveFilterBarberId = loggedBarberId ?? filterBarberId
  const filteredByBarber = effectiveFilterBarberId === 'all'
    ? onlyFuture
    : onlyFuture.filter(u => u.barbeiro_id === effectiveFilterBarberId)

  const filteredByDate = filteredByBarber.filter(u => {
    const start = parseISO(u.data_hora_inicio)
    const end   = parseISO(u.data_hora_fim)
    if (filterFrom && start < parseISO(filterFrom + 'T00:00:00')) return false
    if (filterTo && end   > parseISO(filterTo + 'T23:59:59'))     return false
    return true
  })

  const singles = filteredByDate.filter(u => !u.recurrence_group_id)
  const groupMap = new Map<string, Unavailable[]>()
  filteredByDate.filter(u => u.recurrence_group_id).forEach(u => {
    const gid = u.recurrence_group_id!
    if (!groupMap.has(gid)) groupMap.set(gid, [])
    groupMap.get(gid)!.push(u)
  })

  const handleSubmit = async () => {
    if (!form.data_hora_inicio) {
      setFormError('Data de início obrigatória.')
      return
    }
    if (!form.data_hora_fim && !form.is_all_day) {
      setFormError('Data de fim obrigatória.')
      return
    }

    const startDate = form.data_hora_inicio.substring(0, 10)
    const endDate = (form.data_hora_fim || form.data_hora_inicio).substring(0, 10)
    const inicio = form.is_all_day ? `${startDate}T09:00:00` : form.data_hora_inicio
    const fim    = form.is_all_day ? `${endDate}T20:00:00` : form.data_hora_fim
    setSubmitSaving(true)
    setFormError(null)
    try {
      if (editTarget) {
        const response = await barbersApi.updateUnavailable(editTarget.id, { ...form, data_hora_inicio: inicio, data_hora_fim: fim })
        if (!response.success) throw new Error(response.error ?? 'Erro ao guardar')
        qc.invalidateQueries({ queryKey: ['unavailable'] })
        setModal(false)
        setEditTarget(null)
      } else {
        const payload = { ...form, data_hora_inicio: inicio, data_hora_fim: fim }
        const response = await barbersApi.createUnavailable(payload)
        if (!response.success) {
          const conflicts = (response.data as { conflicts?: UnavailabilityConflictReservation[] } | undefined)?.conflicts ?? []
          if (conflicts.length) {
            setConflictReservations(conflicts)
            setPendingCreatePayload(payload)
            return
          }
          throw new Error(response.error ?? 'Erro ao guardar')
        }
        qc.invalidateQueries({ queryKey: ['unavailable'] })
        setModal(false)
        setForm(EMPTY_FORM)
      }
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erro ao guardar')
    } finally {
      setSubmitSaving(false)
    }
  }

  const openCreate = () => {
    setEditTarget(null)
    setForm(loggedBarberId ? { ...EMPTY_FORM, barbeiro_id: loggedBarberId } : EMPTY_FORM)
    setFormError(null)
    setModal(true)
  }
  const openEdit   = (u: Unavailable) => {
    setEditTarget(u)
    setForm({
      barbeiro_id:      u.barbeiro_id,
      data_hora_inicio: u.data_hora_inicio,
      data_hora_fim:    u.data_hora_fim,
      tipo:             u.tipo,
      motivo:           u.motivo ?? '',
      is_all_day:       u.is_all_day ?? 1,
      recurrence_type:  'none',
    })
    setFormError(null)
    setModal(true)
  }

  const upd = <K extends keyof UnavailableFormState>(field: K, value: UnavailableFormState[K]) =>
    setForm(f => ({ ...f, [field]: value }))

  const fmtDate = (iso: string) => { try { return format(parseISO(iso), "d 'de' MMM", { locale: pt }) } catch { return iso } }
  const fmtTime = (iso: string) => { try { return format(parseISO(iso), 'HH:mm') } catch { return '' } }

  const toggleExpand = (gid: string) => setExpanded(prev => {
    const n = new Set(prev); n.has(gid) ? n.delete(gid) : n.add(gid); return n
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="label flex items-center gap-1 text-xs">
              <Filter size={12} /> Barbeiro
            </label>
            <select
              className="input text-xs min-w-[160px]"
              value={effectiveFilterBarberId === 'all' ? 'all' : String(effectiveFilterBarberId)}
              onChange={e => setFilterBarberId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              disabled={!!loggedBarberId}
            >
              {!loggedBarberId && <option value="all">Todos os barbeiros</option>}
              {barbers.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <div>
              <label className="label text-xs">A partir de</label>
              <input
                type="date"
                className="input text-xs"
                value={filterFrom}
                onChange={e => setFilterFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Até</label>
              <input
                type="date"
                className="input text-xs"
                value={filterTo}
                onChange={e => setFilterTo(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> Nova indisponibilidade
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : filteredByDate.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarOff}
            title="Sem indisponibilidades futuras"
            description="Não existem folgas, férias ou ausências futuras para os filtros seleccionados."
            action={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> Adicionar</button>}
          />
        </Card>
      ) : (
        <div className="space-y-6">

          {/* GRUPOS */}
          {groupMap.size > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recorrências</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from(groupMap.entries()).map(([gid, items]) => {
                  const first   = items[0]
                  const isOpen  = expanded.has(gid)
                  const sorted  = [...items].sort((a,b) => a.data_hora_inicio.localeCompare(b.data_hora_inicio))
                  return (
                    <Card key={gid} padding="md" className="border-l-4" style={{ borderColor: '#d4a017' }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{TYPE_ICONS[first.tipo]}</span>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{first.barbeiro_nome}</p>
                            <span className={`badge text-xs mt-0.5 ${TYPE_COLORS[first.tipo]}`}>{TYPE_LABELS[first.tipo]}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setGroupDetail({ group_id: gid, items: sorted })}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Ver detalhes"
                          ><Eye size={14} /></button>
                          <button
                            onClick={() => toggleExpand(gid)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          >{isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 font-medium">{items.length} ocorrências</p>
                      {first.motivo && <p className="text-xs text-gray-500 mt-1 italic">{first.motivo}</p>}

                      {isOpen && (
                        <div className="mt-3 space-y-1 border-t border-gray-100 pt-2">
                          {sorted.map(u => (
                            <div key={u.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 bg-gray-50">
                              <div>
                                <span className="text-xs font-medium text-brand-700 capitalize">
                                  {fmtDate(u.data_hora_inicio)}
                                </span>
                                {!u.is_all_day && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    {fmtTime(u.data_hora_inicio)} – {fmtTime(u.data_hora_fim)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => openEdit(u)}
                                  className="p-1 rounded hover:bg-white text-gray-400 hover:text-brand-600 transition-colors">
                                  <Pencil size={12} />
                                </button>
                                <button onClick={() => remove.mutate(u.id)}
                                  className="p-1 rounded hover:bg-white text-gray-400 hover:text-red-500 transition-colors">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => {
                                if (window.confirm(`Eliminar todas as ${items.length} ocorrências deste grupo?`))
                                  removeGroup.mutate(gid)
                              }}
                              className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                            >🗑️ Eliminar tudo</button>
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* SINGLES */}
          {singles.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Individuais</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {singles.map(u => (
                  <Card key={u.id} padding="md">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{TYPE_ICONS[u.tipo]}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{u.barbeiro_nome}</p>
                          <span className={`badge text-xs mt-0.5 ${TYPE_COLORS[u.tipo]}`}>{TYPE_LABELS[u.tipo]}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-600 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => remove.mutate(u.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {fmtDate(u.data_hora_inicio)}
                      {u.data_hora_fim !== u.data_hora_inicio && <> — {fmtDate(u.data_hora_fim)}</>}
                    </p>
                    {!u.is_all_day && (
                      <p className="text-xs text-gray-500 mt-0.5">{fmtTime(u.data_hora_inicio)} — {fmtTime(u.data_hora_fim)}</p>
                    )}
                    {u.motivo && <p className="text-xs text-gray-500 mt-2 italic">{u.motivo}</p>}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal criar / editar */}
      <Modal
        open={modal}
        onClose={() => { setModal(false); setEditTarget(null); setForm(EMPTY_FORM) }}
        title={editTarget ? 'Editar indisponibilidade' : 'Nova indisponibilidade'}
      >
        <UnavailableEditorForm
          form={form}
          barbers={barbers}
          isNew={!editTarget}
          disableBarberSelection={!!loggedBarberId}
          error={formError}
          saving={submitSaving}
          onChange={(k, v) => upd(k as keyof UnavailableFormState, v as UnavailableFormState[keyof UnavailableFormState])}
          onSave={() => { void handleSubmit() }}
          onCancel={() => setModal(false)}
        />
      </Modal>

      <UnavailabilityConflictsModal
        open={conflictReservations.length > 0}
        reservations={conflictReservations}
        saving={submitSaving}
        onCancel={() => {
          setConflictReservations([])
          setPendingCreatePayload(null)
        }}
        onConfirm={async ({ selectedIds, reason }) => {
          if (!pendingCreatePayload) return
          setSubmitSaving(true)
          setFormError(null)
          try {
            const response = await barbersApi.createUnavailable({
              ...pendingCreatePayload,
              skip_conflict_check: true,
              cancel_reservation_ids: selectedIds,
              cancel_reason: reason,
            })
            if (!response.success) throw new Error(response.error ?? 'Erro ao guardar')
            qc.invalidateQueries({ queryKey: ['unavailable'] })
            setModal(false)
            setForm(EMPTY_FORM)
            setPendingCreatePayload(null)
            setConflictReservations([])
          } catch (e: unknown) {
            setFormError(e instanceof Error ? e.message : 'Erro ao guardar')
          } finally {
            setSubmitSaving(false)
          }
        }}
      />

      {/* Modal detalhe do grupo */}
      {groupDetail && (
        <Modal
          open={!!groupDetail}
          onClose={() => setGroupDetail(null)}
          title="Detalhes da Recorrência"
          footer={
            <>
              <button
                className="btn-danger"
                onClick={() => { if (window.confirm('Eliminar todo o grupo?')) removeGroup.mutate(groupDetail.group_id) }}
                disabled={removeGroup.isPending}
              >🗑️ Eliminar tudo</button>
              <button className="btn-secondary" onClick={() => setGroupDetail(null)}>Fechar</button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex gap-4">
                <p><span className="text-gray-500">Tipo:</span> <strong>{TYPE_LABELS[groupDetail.items[0].tipo]}</strong></p>
                <p><span className="text-gray-500">Barbeiro:</span> <strong>{groupDetail.items[0].barbeiro_nome}</strong></p>
              </div>
              <p><span className="text-gray-500">Total de ocorrências:</span> <strong>{groupDetail.items.length}</strong></p>
            </div>
            <p className="text-sm font-semibold text-gray-700">Ocorrências:</p>
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {groupDetail.items.map(u => (
                <div key={u.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                  <div>
                    <span className="text-xs font-semibold text-brand-700 capitalize">
                      {format(parseISO(u.data_hora_inicio), "EEEE, dd/MM", { locale: pt })}
                    </span>
                    {!u.is_all_day && (
                      <span className="text-xs text-gray-500 ml-2">
                        {fmtTime(u.data_hora_inicio)} – {fmtTime(u.data_hora_fim)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { openEdit(u); setGroupDetail(null) }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-600 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => remove.mutate(u.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
