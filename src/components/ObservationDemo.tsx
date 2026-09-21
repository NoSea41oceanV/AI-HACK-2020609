import { useMemo, useState } from 'react'
import './ObservationDemo.css'

export type ObservationFactType = 'overexcited' | 'tense' | 'isolated' | 'calm'

export interface ObservationFact {
  id: string
  type: ObservationFactType
  label: string
  detail: string
  petName?: string
}

export interface ObservationImpact {
  title: string
  detail: string
  severity?: 'info' | 'attention' | 'high'
}

export interface ObservationScenario {
  id: string
  title: string
  description: string
  sourceLabel: string
  facts: ObservationFact[]
  impacts: ObservationImpact[]
  recommendation: string
}

export interface ObservationDemoProps {
  scenarios: ObservationScenario[]
  selectedScenarioId?: string
  onScenarioSelect?: (scenarioId: string) => void
  onRecalculateRequest?: (scenario: ObservationScenario) => void
  isRecalculating?: boolean
}

const factIcon: Record<ObservationFactType, string> = {
  overexcited: '↗',
  tense: '!',
  isolated: '◌',
  calm: '✓',
}

const severityLabel: Record<NonNullable<ObservationImpact['severity']>, string> = {
  info: '確認',
  attention: '注意',
  high: '優先確認',
}

export function ObservationDemo({
  scenarios,
  selectedScenarioId,
  onScenarioSelect,
  onRecalculateRequest,
  isRecalculating = false,
}: ObservationDemoProps) {
  const [internalScenarioId, setInternalScenarioId] = useState(scenarios[0]?.id ?? '')
  const activeScenarioId = selectedScenarioId ?? internalScenarioId
  const scenario = useMemo(
    () => scenarios.find((item) => item.id === activeScenarioId) ?? scenarios[0],
    [activeScenarioId, scenarios],
  )

  const selectScenario = (id: string) => {
    if (selectedScenarioId === undefined) setInternalScenarioId(id)
    onScenarioSelect?.(id)
  }

  if (!scenario) {
    return (
      <section className="observation-demo" aria-labelledby="observation-demo-title">
        <p className="observation-demo__empty">表示できる観測シナリオがありません。</p>
      </section>
    )
  }

  return (
    <section className="observation-demo" aria-labelledby="observation-demo-title">
      <div className="observation-demo__heading">
        <div>
          <p className="observation-demo__eyebrow">DEMO ONLY</p>
          <h2 id="observation-demo-title">当日観測デモ</h2>
          <p>録画済みの短尺動画またはサンプル事象から、配置への影響を確認します。</p>
        </div>
        <span className="observation-demo__notice">本番監視ではありません</span>
      </div>

      <label className="observation-demo__picker">
        <span>シナリオを選択</span>
        <select value={scenario.id} onChange={(event) => selectScenario(event.target.value)}>
          {scenarios.map((item) => (
            <option key={item.id} value={item.id}>{item.title}</option>
          ))}
        </select>
      </label>

      <div className="observation-demo__scenario">
        <div className="observation-demo__source" aria-label={`観測ソース: ${scenario.sourceLabel}`}>
          <span className="observation-demo__play" aria-hidden="true">▶</span>
          <div>
            <strong>{scenario.sourceLabel}</strong>
            <p>{scenario.title}</p>
          </div>
        </div>
        <p className="observation-demo__description">{scenario.description}</p>
      </div>

      <div className="observation-demo__grid">
        <article className="observation-demo__panel" aria-labelledby="observation-facts-title">
          <h3 id="observation-facts-title">観測された事実</h3>
          <ul className="observation-demo__facts">
            {scenario.facts.map((fact) => (
              <li key={fact.id} className={`observation-demo__fact observation-demo__fact--${fact.type}`}>
                <span aria-hidden="true">{factIcon[fact.type]}</span>
                <div>
                  <strong>{fact.petName ? `${fact.petName}: ${fact.label}` : fact.label}</strong>
                  <p>{fact.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="observation-demo__panel" aria-labelledby="observation-impact-title">
          <h3 id="observation-impact-title">現在配置への影響</h3>
          <ul className="observation-demo__impacts">
            {scenario.impacts.map((impact) => {
              const severity = impact.severity ?? 'info'
              return (
                <li key={impact.title}>
                  <span className={`observation-demo__severity observation-demo__severity--${severity}`}>
                    {severityLabel[severity]}
                  </span>
                  <div>
                    <strong>{impact.title}</strong>
                    <p>{impact.detail}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </article>
      </div>

      <div className="observation-demo__recommendation">
        <div>
          <p>再計算の提案</p>
          <strong>{scenario.recommendation}</strong>
        </div>
        <button
          type="button"
          onClick={() => onRecalculateRequest?.(scenario)}
          disabled={!onRecalculateRequest || isRecalculating}
        >
          {isRecalculating ? '再計算中…' : 'この条件で再計算'}
        </button>
      </div>
    </section>
  )
}

export default ObservationDemo
