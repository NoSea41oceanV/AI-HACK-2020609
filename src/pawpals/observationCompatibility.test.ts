import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ObservationPanel from '../components/ObservationPanel'
import { createOptimalRoomPlan } from '../domain'
import CompatibilityScreen from './CompatibilityScreen'
import FriendMapScreen from './FriendMapScreen'
import { formatRecordedAt, type DomainPetProfile } from './pawPalsModel'
import type { PersonalityAxes } from '../domain/structuredIntake'

const pet = (id: string, hardBlockedPetIds: string[] = [], tabooNotes = '', hardBlockedPetReasons: Record<string, string> = {}): DomainPetProfile => ({
  id, name: id.toUpperCase(), ageYears: 3, weightKg: 8, energyLevel: 3,
  sociability: 3, anxietyLevel: 2, assertiveness: 2, resourceGuarding: 1,
  playStyles: ['gentle'], hardBlockedPetIds, hardBlockedPetReasons, tabooNotes,
})
const rooms = [{ id: 'a', name: 'A室', capacity: 2, minOccupancy: 0 }, { id: 'b', name: 'B室', capacity: 2, minOccupancy: 0 }]
const onSelectPet = () => undefined
const axes: PersonalityAxes = {
  extraversion: 65, sociability: 72, neuroticism: 28, trainability: 80,
  resourceGuarding: 15, assertiveness: 42, resilience: 76,
}

describe('daily compatibility views', () => {
  it('displays continuous compatibility percentages while preserving explicit blocks', () => {
    const pets = [pet('a', ['b'], '食器の近くでは距離を取る', { b: '食事中は同室不可' }), pet('b', [], '急な接触を避ける')]
    const matchingResult = createOptimalRoomPlan(pets, rooms)
    const chart = renderToStaticMarkup(createElement(CompatibilityScreen, { pets, matchingResult, selectedPetId: 'a', onSelectPet }))
    const map = renderToStaticMarkup(createElement(FriendMapScreen, { pets, matchingResult, rooms, selectedPetId: 'a', onSelectPet }))
    for (const html of [chart, map]) {
      expect(html).toContain('<small>%</small>')
      expect(html).not.toContain('/100')
      expect(html).toContain('同室不可')
      expect(html).not.toContain('AI生成')
    }
    expect(chart).toContain('明示的な同室不可')
    expect(chart).toContain('食器の近くでは距離を取る')
    expect(chart).toContain('食事中は同室不可')
    expect(chart).toContain('急な接触を避ける')
    expect(chart).toContain('相性の内訳')
  })

  it('does not leak removed daily pets from an older matching result', () => {
    const pets = [pet('a'), pet('b')]
    const matchingResult = createOptimalRoomPlan([...pets, { ...pet('c'), name: '前日のみの犬' }], rooms)
    const chart = renderToStaticMarkup(createElement(CompatibilityScreen, { pets, matchingResult, selectedPetId: 'a', onSelectPet }))
    const map = renderToStaticMarkup(createElement(FriendMapScreen, { pets, matchingResult, rooms, selectedPetId: 'a', onSelectPet }))
    expect(chart).not.toContain('前日のみの犬')
    expect(chart).not.toContain('>c<')
    expect(map).not.toContain('>c<')
    expect(map).toContain('1ペア')
  })

  it('shows the saved AI seven-axis contribution and its typed breakdown', () => {
    const pets = [{ ...pet('a'), personalityAxes: axes }, { ...pet('b'), personalityAxes: { ...axes, extraversion: 55 } }]
    const matchingResult = createOptimalRoomPlan(pets, rooms)
    const chart = renderToStaticMarkup(createElement(CompatibilityScreen, { pets, matchingResult, selectedPetId: 'a', onSelectPet }))
    expect(chart).toContain('/ 18点')
    expect(chart).toContain('外向性の近さ')
    expect(chart).toContain('神経質性 × 自己主張の安全性')
    expect(chart).toContain('回復力の支え')
    expect(chart).not.toContain('7軸はこの計算に未適用')
  })

  it('names the pet whose valid seven-axis data is missing without inventing values', () => {
    const pets = [{ ...pet('a'), name: '七軸あり', personalityAxes: axes }, { ...pet('b'), name: '旧プロフィール' }]
    const matchingResult = createOptimalRoomPlan(pets, rooms)
    const chart = renderToStaticMarkup(createElement(CompatibilityScreen, { pets, matchingResult, selectedPetId: 'a', onSelectPet }))
    expect(chart).toContain('7軸はこの計算に未適用')
    expect(chart).toContain('旧プロフィールに保存済みの有効な7軸データがない')
    expect(chart).toContain('既存プロフィールの6因子で計算')
    expect(chart).not.toContain('七軸ありに保存済みの有効な7軸データがない')
  })
})

describe('manual observation context', () => {
  it('shows the selected operation date and recorder without storage implementation details', () => {
    const html = renderToStaticMarkup(createElement(ObservationPanel, {
      pets: [{ id: 'a', name: 'A', ageLabel: '3歳' }, { id: 'b', name: 'B', ageLabel: '3歳' }],
      operationDate: '2026-09-22', staffName: '受付担当', onSubmit: async () => undefined,
    }))
    expect(html).toContain('2026-09-22')
    expect(html).toContain('受付担当')
    expect(html).toContain('手動で記録')
    expect(html).not.toContain('Firestore')
  })

  it('formats saved timestamps in Japan time even across a UTC date boundary', () => {
    expect(formatRecordedAt('2026-09-21T16:05:00.000Z')).toBe('9/22 01:05')
  })
})
