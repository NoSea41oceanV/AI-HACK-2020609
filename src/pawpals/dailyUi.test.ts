import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { demoPets } from '../data/demoData'
import type { DailyOperationDay, DailyOperationPlan, FacilityRoomSettings } from '../domain/dailyOperations'
import TodayScreen, { type TodayScreenProps } from './TodayScreen'

const at = '2026-09-22T09:00:00+09:00'
const rooms = [{ id: 'room-a', name: 'ひだまり', capacity: 3, minOccupancy: 0 }]
const day: DailyOperationDay = { facilityId: 'facility-a', date: '2026-09-22', selectedPetIds: ['coco'], revision: 2, latestPlanId: 'plan-a', lastAuditId: 'audit-a', updatedAt: at, updatedBy: '田中' }
const roomSettings: FacilityRoomSettings = { facilityId: day.facilityId, rooms, revision: 1, lastAuditId: 'rooms-a', updatedAt: at, updatedBy: '田中' }
const plan: DailyOperationPlan = {
  id: 'plan-a', facilityId: day.facilityId, date: day.date, status: 'proposed', petIds: ['coco'], rooms,
  roomsRevision: 1, dayRevision: 2, sourcePlanId: null, createdAt: at, updatedAt: at, staffId: '田中', reason: '初回計算', lastAuditId: 'audit-a',
  result: { status: 'success', pairResults: [], rooms: [{ roomId: 'room-a', petIds: ['coco'], pairKeys: [], averageCompatibility: null, minimumCompatibility: null }], objectiveScore: 0, totalCompatibilityScore: 0, evaluatedAssignments: 1 },
}

function render(overrides: Partial<TodayScreenProps> = {}) {
  return renderToStaticMarkup(createElement(TodayScreen, {
    pets: demoPets, matchingResult: null, rooms, matchingHistory: [], observations: [], busy: false, staffName: '田中',
    operationDate: day.date, dailyOperation: day, roomSettings, currentPlan: plan, auditEntries: [],
    onOperationDateChange: () => {}, onSaveDailyPets: async () => {}, onSaveRooms: async () => {}, onOptimize: () => {}, onDecidePlan: async () => {},
    ...overrides,
  }))
}

const approvalCount = (html: string) => html.match(/<b>(\d)<small>件<\/small><\/b><span>最新案の承認待ち/)?.[1]
const reasonDisabled = (html: string) => /<textarea[^>]*disabled/.test(html)

describe('daily operations display guards', () => {
  it('counts only the current unresolved plan and uses the saved daily selection', () => {
    const html = render()
    expect(approvalCount(html)).toBe('1')
    expect(html).toContain('<b>1<small>頭</small></b><span>当日の預かり犬・保存済み')
    expect(reasonDisabled(html)).toBe(false)
    expect(html).toContain('承認・却下ともに必須')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>この案を承認・確定/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>この案を却下/)
  })

  it('does not count or expose a different date or superseded head as the current plan', () => {
    for (const currentPlan of [{ ...plan, date: '2026-09-21' }, { ...plan, id: 'old-plan' }]) {
      const html = render({ currentPlan })
      expect(approvalCount(html)).toBe('0')
      expect(html).toContain('当日の編成案はまだありません')
      expect(reasonDisabled(html)).toBe(true)
    }
  })

  it('blocks decisions for stale room or day revisions', () => {
    for (const overrides of [{ roomSettings: { ...roomSettings, revision: 2 } }, { dailyOperation: { ...day, revision: 3 } }]) {
      const html = render(overrides)
      expect(approvalCount(html)).toBe('0')
      expect(reasonDisabled(html)).toBe(true)
      expect(html).toContain('再計算が必要')
    }
  })

  it.each(['confirmed', 'rejected'] as const)('keeps a valid %s decision despite the incremented head revision', (status) => {
    const html = render({ dailyOperation: { ...day, revision: 3 }, currentPlan: { ...plan, status, reason: '体調を確認済み' } })
    expect(approvalCount(html)).toBe('0')
    expect(reasonDisabled(html)).toBe(true)
    expect(html).not.toContain('再計算が必要')
    expect(html).toContain('体調を確認済み')
  })

  it('does not use historical matching records as today’s pending plan', () => {
    const html = render({ currentPlan: null, matchingHistory: [{ id: 'yesterday', status: 'proposed', petIds: ['coco'], rooms: [], pairResults: [], objectiveScore: 0, createdAt: '2026-09-21T09:00:00+09:00' }] })
    expect(approvalCount(html)).toBe('0')
    expect(html).toContain('過去の日付を含む計算・観測の記録')
    expect(html).toContain('部屋割りの計算結果を保存')
  })

  it('shows staff, reason and plan provenance for saved audits', () => {
    const html = render({ auditEntries: [{ id: 'decision-a', facilityId: day.facilityId, date: day.date, action: 'rejected', staffId: '佐藤', reason: '体調変化を確認', sourcePlanId: 'plan-previous', planId: 'plan-a', createdAt: at, dayRevision: 3, roomsRevision: 1 }] })
    expect(html).toContain('担当：佐藤')
    expect(html).toContain('理由：体調変化を確認')
  })
})
