import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { AI_MEDIA_LIMITS, AI_MEDIA_TYPES, validateOwnerAnalysisMedia } from '../lib/workerClient'
import './OwnerForm.css'

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
  }
  media: {
    photo: File | null
    video: File | null
  }
}

export interface OwnerFormProps {
  onSubmit: (payload: OwnerRegistrationPayload) => void | Promise<void>
  inviteId?: string
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

function resolveInviteId(explicitInviteId?: string): string {
  if (explicitInviteId) return explicitInviteId
  if (typeof window === 'undefined') return 'PAW-2026'

  const params = new URLSearchParams(window.location.search)
  const fromQuery = params.get('invite') ?? params.get('inviteId')
  if (fromQuery) return fromQuery

  const segments = window.location.pathname.split('/').filter(Boolean)
  const markerIndex = segments.findIndex((segment) =>
    ['invite', 'owner', 'register'].includes(segment.toLowerCase()),
  )
  return markerIndex >= 0 && segments[markerIndex + 1]
    ? decodeURIComponent(segments[markerIndex + 1])
    : 'PAW-2026'
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

export default function OwnerForm({ onSubmit, inviteId: inviteIdProp }: OwnerFormProps) {
  const inviteId = useMemo(() => resolveInviteId(inviteIdProp), [inviteIdProp])
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

    try {
      validateOwnerAnalysisMedia({ photo: photo.file ?? undefined, video: video.file ?? undefined })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '写真・動画のサイズを確認してください。')
      return
    }

    const payload: OwnerRegistrationPayload = {
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
        personality: String(values.get('personality') ?? '').trim(),
        playStyle: String(values.get('playStyle') ?? '').trim(),
        concerns: String(values.get('concerns') ?? '').trim(),
      },
      media: { photo: photo.file, video: video.file },
    }

    setSubmitError('')
    setSubmitted(false)
    setIsSubmitting(true)
    try {
      await onSubmit(payload)
      setSubmitted(true)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '送信できませんでした。時間をおいてお試しください。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="owner-form-page">
      <header className="owner-form-header">
        <a className="owner-form-brand" href="/" aria-label="PawPair ホーム">
          <span className="owner-form-brand-mark" aria-hidden="true">P</span>
          <span>PAWPAIR</span>
        </a>
        <p>わんちゃん情報の登録</p>
      </header>

      <section className="owner-form-intro" aria-labelledby="owner-form-title">
        <div>
          <h1 id="owner-form-title">お預かりする<br />わんちゃんについて</h1>
          <p>安全で楽しい時間を過ごせるよう、普段の様子を教えてください。</p>
        </div>
        <div className="owner-form-invite" aria-label={`受付ID ${inviteId}`}>
          <span>受付ID</span>
          <strong>{inviteId}</strong>
          <small>このURLからいつでも情報を登録できます</small>
        </div>
      </section>

      <form className="owner-form" onSubmit={handleSubmit} noValidate={false}>
        <fieldset>
          <legend><span>01</span>飼い主さまの情報</legend>
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

        <fieldset>
          <legend><span>02</span>わんちゃんの基本情報</legend>
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
          </div>
        </fieldset>

        <fieldset>
          <legend><span>03</span>性格と普段の過ごし方</legend>
          <div className="owner-form-grid">
            <label className="owner-field owner-field-wide">
              <span>性格 <em>必須</em></span>
              <textarea name="personality" required maxLength={500} rows={4} placeholder="人や他の犬への接し方、慣れるまでの様子など" />
            </label>
            <label className="owner-field owner-field-wide">
              <span>好きな遊び・遊び方 <em>必須</em></span>
              <textarea name="playStyle" required maxLength={500} rows={4} placeholder="例：ボール遊びが好き。追いかけられるより追いかける方が好き。" />
            </label>
            <label className="owner-field owner-field-wide">
              <span>苦手なこと・注意点</span>
              <textarea name="concerns" maxLength={500} rows={4} placeholder="苦手な音、触られるのが苦手な場所、興奮しやすい状況など" />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>04</span>写真・動画</legend>
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
          <p>入力内容は施設スタッフがマッチングの参考情報として確認します。</p>
          {submitError && <p className="owner-submit-message owner-submit-error" role="alert">{submitError}</p>}
          {submitted && <p className="owner-submit-message owner-submit-success" role="status">登録を受け付けました。ありがとうございます。</p>}
          <button className="owner-submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '送信中…' : 'この内容で登録する'}
            {!isSubmitting && <span aria-hidden="true">→</span>}
          </button>
        </div>
      </form>
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
