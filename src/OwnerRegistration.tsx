import { useEffect, useRef, useState } from 'react'
import { createIntakeRepository, createInviteRepository, type OwnerInvite, type OwnerIntake, type IntakeMediaMetadata } from './data'
import { createAIWorkerClient, WorkerClientError } from './lib/workerClient'
import type { IntakeAiAnalysis } from './domain/intakeProfile'
import OwnerForm, { OwnerInviteError, type OwnerRegistrationPayload } from './pages/OwnerForm'
import ProcessingStatus, { type ProcessingStep } from './components/ProcessingStatus'
import PersonalityAxesDisplay from './components/PersonalityAxesDisplay'
import { isIntakeConsent, isStructuredIntakeAnswers } from './domain/structuredIntake'

const INITIAL_STEPS: ProcessingStep[] = [
  { id: 'analysis', label: 'わんちゃんの様子を確認', status: 'idle' },
  { id: 'intake', label: '施設へ登録内容を送信', status: 'idle' },
]
function mediaMetadata(file: File | null, kind: IntakeMediaMetadata['kind']): IntakeMediaMetadata | undefined {
  return file ? { kind, fileName:file.name, contentType:file.type, sizeBytes:file.size, status:'selected' } : undefined
}
function validate(payload: OwnerRegistrationPayload) {
  if (!isStructuredIntakeAnswers(payload.pet.structured)) throw new Error('健康・社会化歴・いつもの様子の必須項目を確認してください。')
  if (!isIntakeConsent(payload.consent)) throw new Error('情報の利用への同意を確認してください。')
  for (const [name,value,max] of [
    ['飼い主名',payload.owner.name,80],['連絡先',payload.owner.contact,200],['わんちゃんの名前',payload.pet.name,40],
    ['犬種',payload.pet.breed,80],['性格',payload.pet.personality,1000],['遊び方',payload.pet.playStyle,1000],['注意事項',payload.pet.concerns,1000],
  ] as const) if(value.length>max) throw new Error(`${name}は${max}文字以内で入力してください。`)
  if([payload.media.photo,payload.media.video].some(file=>file && file.name.length>120)) throw new Error('ファイル名は120文字以内にしてください。')
}
type InviteState = { kind:'loading' } | { kind:'ready'; invite:OwnerInvite } | { kind:'invalid' } | { kind:'unavailable' }

export function ownerAnalysisErrorMessage(error: unknown): string {
  if (!(error instanceof WorkerClientError)) {
    return '内容の確認処理を完了できませんでした。接続を確認し、もう一度お試しください。'
  }
  if (error.code === 'unknown_field') {
    return 'AI確認機能の更新が必要です。施設へお問い合わせいただき、時間をおいてもう一度お試しください。'
  }
  return error.message
}

export default function OwnerRegistration({ token }: { token:string|null }) {
  const [attempt,setAttempt]=useState(0)
  const [state,setState]=useState<InviteState>({kind:'loading'})
  const [steps,setSteps]=useState(INITIAL_STEPS)
  const [analysis,setAnalysis]=useState<IntakeAiAnalysis|null>(null)
  const cached=useRef<{signature:string;analysis:IntakeAiAnalysis}|null>(null)
  useEffect(()=>{
    let active=true
    setState({kind:'loading'})
    if(!token){setState({kind:'invalid'});return}
    void (async()=>{
      try {
        const repository=createInviteRepository()
        if(!repository)throw new Error('Unconfigured')
        const invite=await repository.get(token)
        if(active)setState(invite ? {kind:'ready',invite}:{kind:'invalid'})
      } catch { if(active)setState({kind:'unavailable'}) }
    })()
    return ()=>{active=false}
  },[token,attempt])

  async function submit(payload: OwnerRegistrationPayload) {
    if(state.kind!=='ready'||!token||payload.inviteId!==state.invite.id)throw new Error('登録URLを確認してください。')
    validate(payload)
    const repository=createIntakeRepository()
    if(repository.kind!=='firestore')throw new Error('現在、登録を受け付けられません。施設にお問い合わせください。')
    const worker=createAIWorkerClient()
    if(worker.state.kind!=='enabled')throw new Error('現在、登録を受け付けられません。施設にお問い合わせください。')
    let step='analysis'
    setAnalysis(null)
    setSteps(INITIAL_STEPS.map(item=>({...item,status:item.id===step?'active':'idle'})))
    try {
      // Recheck the capability before processing. No staff repositories are used on this route.
      const current=await createInviteRepository()!.get(token)
      if(!current||current.id!==state.invite.id||current.facilityId!==state.invite.facilityId)throw new Error('invite-invalid')
      const key=(file:File|null)=>file?[file.name,file.type,file.size,file.lastModified]:null
      const signature=JSON.stringify({pet:payload.pet,photo:key(payload.media.photo),video:key(payload.media.video)})
      if(cached.current?.signature!==signature){
        const result=await worker.analyzeOwnerRegistration({personality:payload.pet.personality,playStyle:payload.pet.playStyle,concerns:payload.pet.concerns,structured:payload.pet.structured,photo:payload.media.photo??undefined,video:payload.media.video??undefined})
        cached.current={signature,analysis:result.analysis}
      }
      const analysis=cached.current.analysis
      setAnalysis(analysis)
      step='intake'
      setSteps([{...INITIAL_STEPS[0],status:'done'},{...INITIAL_STEPS[1],status:'active'}])
      const intake:OwnerIntake={
        id:current.id,inviteId:current.id,facilityId:current.facilityId,owner:{...payload.owner},
        pet:{name:payload.pet.name,breed:payload.pet.breed,ageYears:payload.pet.age,weightKg:payload.pet.weightKg,sex:payload.pet.sex,personality:payload.pet.personality,playStyle:payload.pet.playStyle,concerns:payload.pet.concerns,structured:payload.pet.structured},
        consent:{...payload.consent},
        media:{photo:mediaMetadata(payload.media.photo,'image'),video:mediaMetadata(payload.media.video,'video')},
        aiAnalysis:analysis,matchingProfile:analysis.matchingProfile,status:'ready',submittedAt:new Date().toISOString(),
      }
      await repository.save(intake)
      cached.current=null
      setSteps(INITIAL_STEPS)
    } catch(error) {
      setSteps(items=>items.map(item=>item.id===step?{...item,status:'error'}:item))
      if(step==='intake')throw new Error('登録を確認できませんでした。このURLが使用済みの可能性があります。施設へ登録状況を確認し、必要な場合は新しいURLをご依頼ください。')
      if(error instanceof Error && error.message==='invite-invalid')throw new Error('この登録URLは利用できません。施設へお問い合わせください。')
      throw new Error(ownerAnalysisErrorMessage(error))
    }
  }
  if(!token)return <OwnerInviteError reason="missing" />
  if(state.kind==='loading')return <section className="app-state-panel" role="status"><h1>登録URLを確認しています</h1><p>そのままお待ちください。</p></section>
  if(state.kind==='invalid')return <OwnerInviteError reason="invalid" />
  if(state.kind==='unavailable')return <OwnerInviteError reason="unavailable" onRetry={()=>setAttempt(n=>n+1)} />
  const isWorking=steps.some(item=>item.status==='active')
  const hasError=steps.some(item=>item.status==='error')
  const sidePanel=(
    <aside className="owner-analysis-card" aria-labelledby="owner-analysis-title">
      <div className="owner-analysis-card__head">
        <div>
          <span className="owner-eyebrow">AIプロフィール分析</span>
          <h2 id="owner-analysis-title">AIプロフィール分析</h2>
        </div>
        <span className={`owner-analysis-status${isWorking?' owner-analysis-status--active':''}${hasError?' owner-analysis-status--error':''}`}>
          {hasError?'確認が必要':isWorking?'処理中':analysis?'分析完了':'送信後に開始'}
        </span>
      </div>
      <ProcessingStatus title="登録の進行状況" steps={steps} />
      {analysis ? (
        <div className="owner-analysis-result" aria-live="polite">
          <strong>AIによる整理</strong>
          <p>{analysis.summary}</p>
          {analysis.observations.length>0 && <ul>{analysis.observations.slice(0,3).map(item=><li key={item}>{item}</li>)}</ul>}
          <PersonalityAxesDisplay axes={analysis.personalityAxes} />
          <small>入力した氏名・連絡先はAIへ送信していません。</small>
        </div>
      ) : (
        <div className="owner-analysis-empty">
          <span aria-hidden="true">🐾</span>
          <p>入力内容を送信すると、AIが健康・社会化歴・普段の様子と任意の写真・動画から行動傾向、7軸、遊び方を整理します。</p>
          <small>動画は音声を使わず、抽出した静止画だけを一時処理します。</small>
        </div>
      )}
    </aside>
  )
  return <div className="app-shell app-shell--owner">
    <OwnerForm inviteId={state.invite.id} onSubmit={submit} sidePanel={sidePanel}/>
  </div>
}
