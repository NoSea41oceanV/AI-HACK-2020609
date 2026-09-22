import { describe, expect, it } from 'vitest'
import { serializePersonalityAnswers, type PersonalityAnswers } from './personalityOptions'

const COMPLETE_ANSWERS: PersonalityAnswers = {
  firstMeeting: '様子を見てから近づく',
  playWithDogs: '追いかけるのが好き',
  sharing: '気にしない',
  excited: '少しずつ盛り上がる',
  settle: 'すぐ落ち着く',
  stress: '少し離れると落ち着く',
}

describe('serializePersonalityAnswers', () => {
  it('serializes every answer in a stable, natural Japanese string', () => {
    expect(serializePersonalityAnswers(COMPLETE_ANSWERS, {})).toEqual({
      value: '初めて会う犬には？：様子を見てから近づく；おもちゃやごはんに他の犬が近づいてきたら？：気にしない；楽しくなったときは？：少しずつ盛り上がる；興奮したあと落ち着くまで？：すぐ落ち着く；苦手なことがあったときは？：少し離れると落ち着く',
      playStyle: '他の犬との遊び方は？：追いかけるのが好き',
      errors: {},
    })
  })

  it('reports every unanswered question', () => {
    const result = serializePersonalityAnswers({ firstMeeting: 'わからない' }, {})
    expect(result.value).toBe('')
    expect(result.playStyle).toBe('')
    expect(result.errors).toEqual({
      playWithDogs: '選択してください。',
      sharing: '選択してください。',
      excited: '選択してください。',
      settle: '選択してください。',
      stress: '選択してください。',
    })
  })

  it('requires and trims detail for an other answer', () => {
    const withOther = { ...COMPLETE_ANSWERS, sharing: 'その他' }
    expect(serializePersonalityAnswers(withOther, { sharing: '   ' }).errors).toEqual({
      sharing: '「その他」の様子を入力してください。',
    })
    expect(serializePersonalityAnswers(withOther, { sharing: '  一度こちらを見る  ' }).value).toContain(
      'おもちゃやごはんに他の犬が近づいてきたら？：その他（一度こちらを見る）',
    )
  })

  it('ignores unused other detail', () => {
    const result = serializePersonalityAnswers(COMPLETE_ANSWERS, { sharing: '入力途中の補足' })
    expect(result.errors).toEqual({})
    expect(result.value).not.toContain('入力途中の補足')
    expect(result.playStyle).toBe('他の犬との遊び方は？：追いかけるのが好き')
  })

  it('stays within the existing 1000-character personality contract', () => {
    const allOther = Object.fromEntries(Object.keys(COMPLETE_ANSWERS).map((key) => [key, 'その他'])) as PersonalityAnswers
    const maximumDetails = Object.fromEntries(Object.keys(COMPLETE_ANSWERS).map((key) => [key, 'あ'.repeat(80)])) as PersonalityAnswers
    const result = serializePersonalityAnswers(allOther, maximumDetails)
    expect(result.errors).toEqual({})
    expect(result.value.length).toBeLessThanOrEqual(1_000)
    expect(result.playStyle.length).toBeLessThanOrEqual(1_000)
  })
})
