import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ObservationRecord } from '../data'
import type { OperationAuditEvent } from '../domain/dailyOperations'
import { createOptimalRoomPlan } from '../domain'
import AgentScreen, { auditEntriesForDate, manualObservationsForDate } from './AgentScreen'

const operationDate = '2026-09-22'
const legacy: ObservationRecord = {
  id: 'legacy', scenarioId: 'demo', title: '旧シナリオ', facts: ['過去のデモ記録'],
  impacts: [], recommendation: '', observedAt: '2026-09-22T00:00:00.000Z',
}
const manual = {
  ...legacy, id: 'manual', scenarioId: 'manual', title: '手動観測', facts: ['距離を取っていた'],
  source: 'manual' as const, staffId: 'staff-a', petIds: ['a', 'b'], operationDate,
}
const props: ComponentProps<typeof AgentScreen> = {
  pets: [], matchingResult: null, observations: [], operationDate, staffName: '担当A',
  dailyOperation: null, roomSettings: null, currentPlan: null, auditEntries: [],
  busy: false, onObserve: async () => undefined,
}

describe('day-scoped manual observation history', () => {
  it('excludes undated legacy scenarios and manual records from another operation date', () => {
    const observations = [legacy, { ...manual, id: 'yesterday', operationDate: '2026-09-21' }, manual]
    expect(manualObservationsForDate(observations, operationDate).map((item) => item.id)).toEqual(['manual'])
    expect(observations.map((item) => item.id)).toEqual(['legacy', 'yesterday', 'manual'])
  })

  it('does not claim observation completion because a legacy demo record exists', () => {
    const html = renderToStaticMarkup(createElement(AgentScreen, { ...props, observations: [legacy] }))
    expect(html).toContain('手動観測保存：未完了')
    expect(html).toContain('この運用日の手動観測はありません')
    expect(html).not.toContain('過去のデモ記録')
  })

  it('attributes current manual observations to the original recorder and operation date', () => {
    const html = renderToStaticMarkup(createElement(AgentScreen, { ...props, observations: [manual] }))
    expect(html).toContain('手動観測保存：完了')
    expect(html).toContain('staff-a')
    expect(html).toContain(operationDate)
    expect(html).toContain('距離を取っていた')
  })
})

describe('operation audit history', () => {
  const audit = (id: string, action: OperationAuditEvent['action'], date: string | null): OperationAuditEvent => ({
    id, facilityId: 'facility-a', action, date, staffId: 'staff-b', reason: '確認して記録',
    sourcePlanId: null, planId: null, createdAt: '2026-09-22T01:00:00.000Z',
    dayRevision: null, roomsRevision: null,
  })

  it('keeps shared room settings and current-day actions, without leaking another day', () => {
    const entries = [audit('yesterday', 'confirmed', '2026-09-21'), audit('rooms', 'rooms_saved', null), audit('today', 'rejected', operationDate)]
    expect(auditEntriesForDate(entries, operationDate).map((entry) => entry.id)).toEqual(['rooms', 'today'])
  })

  it('labels rejected actions honestly instead of presenting every saved event as success', () => {
    const html = renderToStaticMarkup(createElement(AgentScreen, {
      ...props, auditEntries: [audit('rejected', 'rejected', operationDate)],
    }))
    expect(html).toContain('スタッフが割当案を却下')
    expect(html).toContain('スタッフ確定：未完了')
    expect(html).toContain('staff-b')
  })
})

describe('current plan progress', () => {
  const pets = [{ id: 'a', name: 'A', ageYears: 3, weightKg: 8, energyLevel: 3, sociability: 3,
    anxietyLevel: 2, assertiveness: 2, resourceGuarding: 1, playStyles: ['gentle' as const] }]
  const rooms = [{ id: 'room-a', name: 'A室', capacity: 2, minOccupancy: 0 }]
  const result = createOptimalRoomPlan(pets, rooms)
  if (result.status !== 'success') throw new Error('Fixture plan must be feasible')
  const metadata = { facilityId: 'facility-a', lastAuditId: 'audit-a', updatedAt: '2026-09-22T01:00:00.000Z' }
  const dailyOperation = { ...metadata, date: operationDate, selectedPetIds: ['a'], revision: 2, latestPlanId: 'plan-a', updatedBy: 'staff-a' }
  const roomSettings = { ...metadata, rooms, revision: 1, updatedBy: 'staff-a' }
  const currentPlan = { ...metadata, id: 'plan-a', date: operationDate, petIds: ['a'], rooms, roomsRevision: 1,
    dayRevision: 1, result, sourcePlanId: null, createdAt: metadata.updatedAt, staffId: 'staff-a', reason: '確認', status: 'confirmed' as const }

  it('recognizes a fresh confirmed plan using the decision revision', () => {
    const html = renderToStaticMarkup(createElement(AgentScreen, { ...props, pets, matchingResult: result, dailyOperation, roomSettings, currentPlan }))
    expect(html).toContain('スタッフ確定：完了')
    expect(html).toContain('部屋割り：完了')
  })

  it('does not mark a stale confirmed plan complete after rooms change', () => {
    const html = renderToStaticMarkup(createElement(AgentScreen, {
      ...props, pets, matchingResult: result, dailyOperation, currentPlan, roomSettings: { ...roomSettings, revision: 2 },
    }))
    expect(html).toContain('スタッフ確定：未完了')
    expect(html).toContain('部屋割り：未完了')
    expect(html).toContain('条件変更のため再計算が必要')
  })

  it('does not mark a proposed plan complete after the day head advances', () => {
    const html = renderToStaticMarkup(createElement(AgentScreen, {
      ...props, pets, matchingResult: result, dailyOperation, roomSettings,
      currentPlan: { ...currentPlan, status: 'proposed' },
    }))
    expect(html).toContain('相性計算：未完了')
    expect(html).toContain('部屋割り：未完了')
  })
})
