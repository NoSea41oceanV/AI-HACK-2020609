import { ChangeEvent, FormEvent, ReactNode, useEffect, useState } from 'react'
import { AI_MEDIA_LIMITS, AI_MEDIA_TYPES, validateOwnerAnalysisMedia } from '../lib/workerClient'
import './OwnerForm.css'
import { STRUCTURED_INTAKE_LABELS, STRUCTURED_INTAKE_OPTIONS, STRUCTURED_INTAKE_TEXT_KEYS, isStructuredIntakeAnswers, type StructuredIntakeAnswers } from '../domain/structuredIntake'

export type PetSex = 'male' | 'female' | 'unknown'

export interface OwnerRegistrationPayload {
  inviteId: string
  owner: {
    name: string
    contact: string
  }
  pet: {
    name: string
    breed: string
    age: number
    weightKg: number
    sex: PetSex
    personality: string
    playStyle: string
    concerns: string
    structured: StructuredIntakeAnswers
  }
  consent: { version: '2026-09'; accepted: true; acceptedAt: string }
  media: {
    photo: File | null
    video: File | null
  }
}

export interface OwnerFormProps {
  onSubmit: (payload: OwnerRegistrationPayload) => void | Promise<void>
  inviteId: string
  sidePanel?: ReactNode
}

type MediaKind = 'photo' | 'video'

interface MediaSelection {
  file: File | null
  previewUrl: string
  error: string
}

const EMPTY_MEDIA: MediaSelection = { file: null, previewUrl: '', error: '' }

const PHOTO_TYPES: readonly string[] = AI_MEDIA_TYPES.image
const VIDEO_TYPES: readonly string[] = AI_MEDIA_TYPES.video
const MAX_PHOTO_BYTES = AI_MEDIA_LIMITS.imageBytes
const MAX_VIDEO_BYTES = AI_MEDIA_LIMITS.videoBytes

const BASIC_KEYS = ['neuter', 'heat'] as const
const HEALTH_KEYS = ['mixedVaccine', 'rabiesVaccine', 'fleaTickPrevention', 'foodAllergy', 'medicalHistory', 'sensoryJointConcerns'] as const
const SOCIAL_KEYS = ['multiDogExperience', 'facilityExperience', 'puppySocialization', 'troubleHistory'] as const
const BEHAVIOR_KEYS = ['firstMeeting', 'playPreference', 'resourceReaction', 'excitement', 'recovery', 'stressResponse'] as const
const STRUCTURED_KEYS = [...BASIC_KEYS, ...HEALTH_KEYS, ...SOCIAL_KEYS, ...BEHAVIOR_KEYS]

export function createOwnerRegistrationPayload(values: FormData, inviteId: string, media: OwnerRegistrationPayload['media']): OwnerRegistrationPayload {
  const structured = Object.fromEntries(STRUCTURED_KEYS.map((key) => [key, String(values.get(key) ?? '').trim()]))
  if (!isStructuredIntakeAnswers(structured) || STRUCTURED_INTAKE_TEXT_KEYS.some((key) => !structured[key])) throw new Error('健康・社会化歴・いつもの様子の必須項目を確認してください。')
  if (values.get('consent') !== 'accepted') throw new Error('情報の利用について確認し、同意してください。')
  return {
    inviteId,
    owner: {
      name: String(values.get('ownerName') ?? '').trim(),
      contact: String(values.get('contact') ?? '').trim(),
    },
    pet: {
      name: String(values.get('petName') ?? '').trim(),
      breed: String(values.get('breed') ?? '').trim(),
      age: Number(values.get('age')),
      weightKg: Number(values.get('weightKg')),
      sex: String(values.get('sex')) as PetSex,
      personality: BEHAVIOR_KEYS.map((key) => `${STRUCTURED_INTAKE_LABELS[key]}：${structured[key]}`).join('\n'),
      playStyle: structured.playPreference,
      concerns: String(values.get('concerns') ?? '').trim(),
      structured,
    },
    consent: { version: '2026-09', accepted: true, acceptedAt: new Date().toISOString() },
    media,
  }
}

function StructuredFields({ fields, disabled }: { fields: readonly (keyof StructuredIntakeAnswers)[]; disabled: boolean }) {
  return <>{fields.map((key) => {
    const options = STRUCTURED_INTAKE_OPTIONS[key as keyof typeof STRUCTURED_INTAKE_OPTIONS] as readonly string[] | undefined
    return <label className={`owner-field${options ? '' : ' owner-field-wide'}`} key={key}>
      <span>{STRUCTURED_INTAKE_LABELS[key]} <em>必須</em></span>
      {options ? <select name={key} defaultValue="" required disabled={disabled}>
        <option value="" disabled>選択してください</option>
        {options.map((option) => <option value={option} key={option}>{option}</option>)}
      </select> : <textarea name={key} required maxLength={1000} rows={2} disabled={disabled} placeholder={key === 'troubleHistory' ? '相手のサイズ・状況・程度・原因など。なければ「なし」' : 'なければ「なし」。分からない場合は「不明」'} />}
    </label>
  })}</>
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ kind }: { kind: MediaKind }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {kind === 'photo' ? (
        <>
          <rect x="3.25" y="4.25" width="17.5" height="15.5" rx="3" />
          <circle cx="8.5" cy="9" r="1.5" />
          <path d="m5.5 17 4.4-4.3 2.8 2.7 2.4-2.2 3.4 3.8" />
        </>
      ) : (
        <>
          <rect x="3.25" y="5.25" width="12.5" height="13.5" rx="3" />
          <path d="m15.75 9.5 4.5-2.25v9.5l-4.5-2.25z" />
        </>
      )}
    </svg>
  )
}

export default function OwnerForm({ onSubmit, inviteId, sidePanel }: OwnerFormProps) {
  const [photo, setPhoto] = useState<MediaSelection>(EMPTY_MEDIA)
  const [video, setVideo] = useState<MediaSelection>(EMPTY_MEDIA)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(
    () => () => {
      if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl)
    },
    [photo.previewUrl],
  )

  useEffect(
    () => () => {
      if (video.previewUrl) URL.revokeObjectURL(video.previewUrl)
    },
    [video.previewUrl],
  )

  const selectMedia = (kind: MediaKind, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    const current = kind === 'photo' ? photo : video
    const setMedia = kind === 'photo' ? setPhoto : setVideo
    if (current.previewUrl) URL.revokeObjectURL(current.previewUrl)

    if (!file) {
      setMedia(EMPTY_MEDIA)
      return
    }

    const allowedTypes = kind === 'photo' ? PHOTO_TYPES : VIDEO_TYPES
    const maxBytes = kind === 'photo' ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES
    const typeLabel = kind === 'photo' ? 'JPG・PNG・WebP' : 'MP4・WebM・MOV'
    const sizeLabel = kind === 'photo' ? '5MB' : '20MB'

    if (!allowedTypes.includes(file.type)) {
      setMedia({ file: null, previewUrl: '', error: `${typeLabel}形式のファイルを選んでください。` })
      event.target.value = ''
      return
    }

    if (file.size > maxBytes) {
      setMedia({ file: null, previewUrl: '', error: `ファイルサイズは${sizeLabel}以下にしてください。` })
      event.target.value = ''
      return
    }

    setMedia({ file, previewUrl: URL.createObjectURL(file), error: '' })
  }

  const clearMedia = (kind: MediaKind) => {
    const current = kind === 'photo' ? photo : video
    if (current.previewUrl) URL.revokeObjectURL(current.previewUrl)
    if (kind === 'photo') setPhoto(EMPTY_MEDIA)
    else setVideo(EMPTY_MEDIA)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (photo.error || video.error) return

    const form = event.currentTarget
    if (!form.reportValidity()) return
    const values = new FormData(form)

    let payload: OwnerRegistrationPayload
    try {
      validateOwnerAnalysisMedia({ photo: photo.file ?? undefined, video: video.file ?? undefined })
      payload = createOwnerRegistrationPayload(values, inviteId, { photo: photo.file, video: video.file })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '入力内容と写真・動画のサイズを確認してください。')
      return
    }

    setSubmitError('')
    setSubmitted(false)
    setIsSubmitting(true)
    try {
      await onSubmit(payload)
      form.reset()
      if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl)
      if (video.previewUrl) URL.revokeObjectURL(video.previewUrl)
      setPhoto(EMPTY_MEDIA)
      setVideo(EMPTY_MEDIA)
      setSubmitted(true)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '送信できませんでした。時間をおいてお試しください。')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <main className="owner-form-page owner-form-page--complete">
        <OwnerHeader />
        <div className="owner-workspace owner-workspace--complete">
          <section className="owner-complete" role="status" aria-labelledby="owner-complete-title">
            <span className="owner-complete-mark" aria-hidden="true">✓</span>
            <h1 id="owner-complete-title">登録を受け付けました</h1>
            <p>ご入力ありがとうございました。お預かりした情報は施設スタッフが確認します。</p>
            <small>この画面を閉じていただけます。</small>
          </section>
          {sidePanel}
        </div>
      </main>
    )
  }

  return (
    <main className="owner-form-page">
      <OwnerHeader />

      <section className="owner-form-intro" aria-labelledby="owner-form-title">
        <div>
          <span className="owner-eyebrow">飼い主さんの登録</span>
          <h1 id="owner-form-title">愛犬プロフィール登録</h1>
          <p>安全で楽しい時間を過ごせるよう、普段の様子を教えてください。回答をもとにAIが行動傾向を整理します。</p>
        </div>
        <div className="owner-progress-pill"><b>18</b>項目の健康・行動情報</div>
      </section>

      <div className="owner-workspace">
      <form className="owner-form" onSubmit={handleSubmit} noValidate>
        <fieldset disabled={isSubmitting}>
          <legend><span>A</span><span><b>飼い主さまの情報</b><small>施設からの連絡に使う情報</small></span></legend>
          <div className="owner-form-grid">
            <label className="owner-field">
              <span>お名前 <em>必須</em></span>
              <input name="ownerName" type="text" autoComplete="name" required placeholder="例：山田 花子" />
            </label>
            <label className="owner-field">
              <span>連絡先 <em>必須</em></span>
              <input name="contact" type="text" autoComplete="tel" required placeholder="電話番号またはメールアドレス" />
            </label>
          </div>
        </fieldset>

        <fieldset disabled={isSubmitting}>
          <legend><span>B</span><span><b>基本属性</b><small>相性判定に使う基本情報</small></span></legend>
          <div className="owner-form-grid">
            <label className="owner-field owner-field-wide">
              <span>お名前 <em>必須</em></span>
              <input name="petName" type="text" required placeholder="例：こむぎ" />
            </label>
            <label className="owner-field owner-field-wide">
              <span>犬種 <em>必須</em></span>
              <input name="breed" type="text" required placeholder="例：トイプードル" />
            </label>
            <label className="owner-field">
              <span>年齢 <em>必須</em></span>
              <span className="owner-input-unit"><input name="age" type="number" inputMode="decimal" min="0" max="30" step="0.1" required /><b>歳</b></span>
            </label>
            <label className="owner-field">
              <span>体重 <em>必須</em></span>
              <span className="owner-input-unit"><input name="weightKg" type="number" inputMode="decimal" min="0.1" max="100" step="0.1" required /><b>kg</b></span>
            </label>
            <label className="owner-field owner-field-wide">
              <span>性別 <em>必須</em></span>
              <select name="sex" defaultValue="" required>
                <option value="" disabled>選択してください</option>
                <option value="male">男の子</option>
                <option value="female">女の子</option>
                <option value="unknown">不明・回答しない</option>
              </select>
            </label>
            <StructuredFields fields={BASIC_KEYS} disabled={isSubmitting} />
          </div>
        </fieldset>

        <fieldset disabled={isSubmitting}>
          <legend><span>C</span><span><b>健康・管理情報</b><small>安全確認に必要な情報</small></span></legend>
          <div className="owner-form-grid"><StructuredFields fields={HEALTH_KEYS} disabled={isSubmitting} /></div>
        </fieldset>

        <fieldset disabled={isSubmitting}>
          <legend><span>D</span><span><b>社会化歴</b><small>他犬との過去の経験</small></span></legend>
          <div className="owner-form-grid"><StructuredFields fields={SOCIAL_KEYS} disabled={isSubmitting} /></div>
        </fieldset>

        <fieldset disabled={isSubmitting}>
          <legend><span>E</span><span><b>いつもの様子</b><small>専門用語は使わず、普段の場面について答えてください</small></span></legend>
          <div className="owner-form-grid owner-behavior-grid"><StructuredFields fields={BEHAVIOR_KEYS} disabled={isSubmitting} /></div>
          <label className="owner-field owner-free-text">
            <span>うちの子の性格・苦手なこと・注意点（自由記入）</span>
            <textarea name="concerns" maxLength={1000} rows={4} placeholder="普段の性格、苦手な音、触られるのが苦手な場所、興奮しやすい状況など" />
          </label>
        </fieldset>

        <fieldset disabled={isSubmitting}>
          <legend><span>F</span><span><b>写真・動画</b><small>任意の補助資料</small></span></legend>
          <p className="owner-fieldset-help">表情や動きが分かるファイルがあると、性格傾向の確認に役立ちます。音声ファイルは使用しません。写真と動画は合計20MBまでです。</p>
          <div className="owner-media-grid">
            <MediaInput
              id="owner-photo"
              kind="photo"
              title="写真を追加"
              note="JPG・PNG・WebP / 5MBまで"
              accept="image/jpeg,image/png,image/webp"
              selection={photo}
              onChange={(event) => selectMedia('photo', event)}
              onClear={() => clearMedia('photo')}
            />
            <MediaInput
              id="owner-video"
              kind="video"
              title="動画を追加"
              note="MP4・WebM・MOV / 20MBまで"
              accept="video/mp4,video/webm,video/quicktime"
              selection={video}
              onChange={(event) => selectMedia('video', event)}
              onClear={() => clearMedia('video')}
            />
          </div>
        </fieldset>

        <div className="owner-form-submit-area">
          <div className="owner-consent-notice" id="owner-consent-description">
            <strong>情報の利用について</strong>
            <p>健康・管理情報、社会化歴、行動の回答と任意の写真をAIに送り、行動傾向や相性の参考情報を整理します。氏名・連絡先はAIに送りません。自由記入や写真にも氏名・連絡先を含めないでください。</p>
            <p>動画は任意です。音声を使わず抽出した静止画だけを一時処理し、動画本体は保存しません。入力内容と分析結果は施設スタッフが確認します。</p>
          </div>
          <label className="owner-consent-checkbox">
            <input name="consent" type="checkbox" value="accepted" required disabled={isSubmitting} aria-describedby="owner-consent-description" />
            <span>上記の情報の利用に同意します <em>必須</em></span>
          </label>
          {submitError && <p className="owner-submit-message owner-submit-error" role="alert">{submitError}</p>}
          <button className="owner-submit-button" type="submit" disabled={isSubmitting || submitted}>
            {isSubmitting ? '送信中…' : 'この内容で登録する'}
            {!isSubmitting && <span aria-hidden="true">→</span>}
          </button>
        </div>
      </form>
      {sidePanel}
      </div>
    </main>
  )
}

function OwnerHeader() {
  return (
    <header className="owner-form-header">
      <div className="owner-form-brand" aria-label="PawPals">
        <span>PawPals</span>
        <small>AIと一緒に、今日のわんこたちを見守る。</small>
      </div>
      <p>わんちゃん情報の登録</p>
    </header>
  )
}

export type OwnerInviteErrorReason = 'missing' | 'invalid' | 'used' | 'network' | 'unavailable'

export interface OwnerInviteErrorProps {
  reason?: OwnerInviteErrorReason
  title?: string
  message?: string
  onRetry?: () => void
  loading?: boolean
}

const INVITE_ERROR_COPY: Record<OwnerInviteErrorReason, { title: string; message: string }> = {
  missing: {
    title: '登録URLを確認してください',
    message: 'このページは施設からお渡しした登録URLから開く必要があります。URLをもう一度ご確認ください。',
  },
  invalid: {
    title: 'この登録URLは利用できません',
    message: 'URLが途中で切れていないかご確認ください。解決しない場合は施設へお問い合わせください。',
  },
  used: {
    title: 'この登録URLは使用済みです',
    message: '1つのURLで登録できるのは1頭です。追加登録が必要な場合は、施設へ新しいURLの発行をご依頼ください。',
  },
  unavailable: {
    title: '登録ページを開けませんでした',
    message: '時間をおいてもう一度お試しください。解決しない場合は施設へお問い合わせください。',
  },
  network: {
    title: '登録URLを確認できませんでした',
    message: '通信状況を確認して、もう一度お試しください。',
  },
}

export function OwnerInviteError({
  reason = 'invalid',
  title,
  message,
  onRetry,
  loading = false,
}: OwnerInviteErrorProps) {
  const copy = INVITE_ERROR_COPY[reason]
  const displayTitle = title ?? (loading ? '登録URLを確認しています' : copy.title)
  const displayMessage = message ?? (loading ? '安全な登録ページを準備しています。' : copy.message)
  return (
    <main className="owner-form-page owner-form-page--error">
      <OwnerHeader />
      <section
        className={`owner-invite-error${loading ? ' owner-invite-error--loading' : ''}`}
        role={loading ? 'status' : 'alert'}
        aria-live={loading ? 'polite' : undefined}
        aria-labelledby="owner-invite-error-title"
      >
        <span className="owner-invite-error-mark" aria-hidden="true">{loading ? '…' : '!'}</span>
        <h1 id="owner-invite-error-title">{displayTitle}</h1>
        <p>{displayMessage}</p>
        {onRetry && !loading && (
          <button className="owner-invite-retry" type="button" onClick={onRetry}>もう一度試す</button>
        )}
      </section>
    </main>
  )
}

interface MediaInputProps {
  id: string
  kind: MediaKind
  title: string
  note: string
  accept: string
  selection: MediaSelection
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
}

function MediaInput({ id, kind, title, note, accept, selection, onChange, onClear }: MediaInputProps) {
  return (
    <div className="owner-media-field">
      {selection.file && selection.previewUrl ? (
        <div className="owner-media-preview">
          {kind === 'photo' ? (
            <img src={selection.previewUrl} alt="選択したわんちゃんのプレビュー" />
          ) : (
            <video src={selection.previewUrl} controls preload="metadata" aria-label="選択した動画のプレビュー" />
          )}
          <div>
            <strong>{selection.file.name}</strong>
            <span>{formatFileSize(selection.file.size)}</span>
          </div>
          <button type="button" onClick={onClear} aria-label={`${selection.file.name}を削除`}>削除</button>
        </div>
      ) : (
        <label className="owner-media-drop" htmlFor={id}>
          <span className="owner-media-icon"><FileIcon kind={kind} /></span>
          <strong>{title}</strong>
          <small>{note}</small>
          <span className="owner-media-action">ファイルを選ぶ</span>
        </label>
      )}
      <input
        key={selection.file?.name ?? 'empty'}
        id={id}
        className="owner-media-native"
        type="file"
        accept={accept}
        onChange={onChange}
      />
      {selection.error && <p className="owner-media-error" role="alert">{selection.error}</p>}
    </div>
  )
}
