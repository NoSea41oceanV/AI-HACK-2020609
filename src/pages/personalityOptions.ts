export const PERSONALITY_QUESTIONS = [
  {
    key: 'firstMeeting',
    label: '初めて会う犬には？',
    options: ['すぐ近づく', '様子を見てから近づく', '距離を取る', '吠えることがある'],
  },
  {
    key: 'playWithDogs',
    label: '他の犬との遊び方は？',
    options: ['追いかけるのが好き', '追いかけられるのが好き', 'じゃれ合うのが好き', '同じ場所で別々に過ごす', '遊ばない・避ける'],
  },
  {
    key: 'sharing',
    label: 'おもちゃやごはんに他の犬が近づいてきたら？',
    options: ['気にしない', 'その場を離れる', '取られないよう守る', 'うなる・吠えることがある'],
  },
  {
    key: 'excited',
    label: '楽しくなったときは？',
    options: ['少しずつ盛り上がる', '急に走り回る', '声が出やすい', '飛びつくことがある', 'あまり変わらない'],
  },
  {
    key: 'settle',
    label: '興奮したあと落ち着くまで？',
    options: ['すぐ落ち着く', '少し時間がかかる', 'かなり時間がかかる', '人が声をかけると落ち着く', '一人にすると落ち着く'],
  },
  {
    key: 'stress',
    label: '苦手なことがあったときは？',
    options: ['少し離れると落ち着く', '飼い主の近くに来る', '固まる・動かなくなる', '隠れようとする', '吠える・うなることがある'],
  },
] as const

export type PersonalityQuestionKey = (typeof PERSONALITY_QUESTIONS)[number]['key']
export type PersonalityAnswers = Partial<Record<PersonalityQuestionKey, string>>

export interface SerializedPersonality {
  value: string
  playStyle: string
  errors: Partial<Record<PersonalityQuestionKey, string>>
}

export function serializePersonalityAnswers(
  answers: PersonalityAnswers,
  otherDetails: PersonalityAnswers,
): SerializedPersonality {
  const errors: Partial<Record<PersonalityQuestionKey, string>> = {}
  const statements: string[] = []
  let playStyle = ''

  for (const question of PERSONALITY_QUESTIONS) {
    const answer = answers[question.key] ?? ''
    if (!answer) {
      errors[question.key] = '選択してください。'
      continue
    }

    if (answer === 'その他') {
      const detail = otherDetails[question.key]?.trim() ?? ''
      if (!detail) {
        errors[question.key] = '「その他」の様子を入力してください。'
        continue
      }
      const statement = `${question.label}：その他（${detail}）`
      if (question.key === 'playWithDogs') playStyle = statement
      else statements.push(statement)
      continue
    }

    const statement = `${question.label}：${answer}`
    if (question.key === 'playWithDogs') playStyle = statement
    else statements.push(statement)
  }

  return {
    value: Object.keys(errors).length === 0 ? statements.join('；') : '',
    playStyle: Object.keys(errors).length === 0 ? playStyle : '',
    errors,
  }
}
