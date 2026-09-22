import { PERSONALITY_AXIS_KEYS, PERSONALITY_AXIS_LABELS, isPersonalityAxes, type PersonalityAxes } from '../domain/structuredIntake'
import './PersonalityAxesDisplay.css'

export default function PersonalityAxesDisplay({ axes }: { axes?: PersonalityAxes }) {
  return <section className="personality-axes" aria-label="性格傾向の7軸">
    <h3>性格傾向の7軸 <small>傾向の目安</small></h3>
    {isPersonalityAxes(axes) ? <>
      <div className="personality-axes__grid">
        {PERSONALITY_AXIS_KEYS.map((key) => <div className="personality-axes__row" key={key}>
          <span>{PERSONALITY_AXIS_LABELS[key]}</span>
          <meter min={0} max={100} value={axes[key]} aria-label={PERSONALITY_AXIS_LABELS[key]}>{axes[key]}</meter>
          <b>{axes[key]}<small>/100</small></b>
        </div>)}
      </div>
      <p>AIが整理した参考値です。数値は特徴の出方を示すもので、優劣や良し悪しを表すものではありません。</p>
    </> : <p className="personality-axes__missing">7軸の分析結果は未生成、または旧形式の登録です。保存済みの7軸データがありません。</p>}
  </section>
}
