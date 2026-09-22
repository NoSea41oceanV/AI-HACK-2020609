import { describe, expect, it } from 'vitest'
import { ownerAnalysisErrorMessage } from './OwnerRegistration'
import { WorkerClientError } from './lib/workerClient'

describe('ownerAnalysisErrorMessage', () => {
  it('explains a deployed Worker contract mismatch', () => {
    expect(ownerAnalysisErrorMessage(new WorkerClientError('未対応の項目です: structured', 'unknown_field', 400)))
      .toBe('AI確認機能の更新が必要です。施設へお問い合わせいただき、時間をおいてもう一度お試しください。')
  })

  it('preserves actionable media errors', () => {
    const error = new WorkerClientError('動画から静止画を作成できませんでした。', 'video_frame_extraction_failed', 422)
    expect(ownerAnalysisErrorMessage(error)).toBe(error.message)
  })

  it('keeps unexpected failures generic', () => {
    expect(ownerAnalysisErrorMessage(new Error('sensitive implementation detail')))
      .toBe('内容の確認処理を完了できませんでした。接続を確認し、もう一度お試しください。')
  })
})
