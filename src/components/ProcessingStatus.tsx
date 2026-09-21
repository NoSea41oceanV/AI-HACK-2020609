export type ProcessingStepStatus = 'idle' | 'active' | 'done' | 'error'

export interface ProcessingStep {
  id: string
  label: string
  status: ProcessingStepStatus
}

interface ProcessingStatusProps {
  title: string
  steps: readonly ProcessingStep[]
  error?: string
}

const statusLabel: Record<ProcessingStepStatus, string> = {
  idle: '待機',
  active: '処理中',
  done: '完了',
  error: 'エラー',
}

export default function ProcessingStatus({ title, steps, error }: ProcessingStatusProps) {
  const hasProgress = steps.some((step) => step.status !== 'idle')
  if (!hasProgress && !error) return null

  return (
    <section className="processing-status" aria-live="polite" aria-atomic="true">
      <div className="processing-status__heading">
        <strong>{title}</strong>
        <span>個人情報はAIへ送信しません</span>
      </div>
      <ol>
        {steps.map((step) => (
          <li className={`processing-status__step processing-status__step--${step.status}`} key={step.id}>
            <span aria-hidden="true" />
            <strong>{step.label}</strong>
            <small>{statusLabel[step.status]}</small>
          </li>
        ))}
      </ol>
      {error ? <p className="processing-status__error" role="alert">{error}</p> : null}
    </section>
  )
}
