import { useEffect, useRef, useState } from 'react'
import { createIntakeRepository, createInviteRepository, type OwnerInvite, type OwnerIntake, type IntakeMediaMetadata } from './data'
import { createAIWorkerClient } from './lib/workerClient'
import type { IntakeAiAnalysis } from './domain/intakeProfile'
import OwnerForm, { OwnerInviteError, type OwnerRegistrationPayload } from './pages/OwnerForm'
import ProcessingStatus, { type ProcessingStep } from './components/ProcessingStatus'

const INITIAL_STEPS: ProcessingStep[] = [
  { id: 'analysis', label: 'わんちゃんの様子を確認', status: 'idle' },
  { id: 'intake', label: '施設へ登録内容を送信', status: 'idle' },
]
function mediaMetadata(file: File | null, kind: IntakeMediaMetadata['kind']): IntakeMediaMetadata | undefined {
  return file ? { kind, fileName:file.name, contentType:file.type, sizeBytes:file.size, status:'selected' } : undefined
}
function validate(payload: OwnerRegistrationPayload) {
  for (const [name,value,max] of [
    ['飼い主名',payload.owner.name,80],['連絡先',payload.owner.contact,200],['わんちゃんの名前',payload.pet.name,40],
    ['犬種',payload.pet.breed,80],['性格',payload.pet.personality,1000],['遊び方',payload.pet.playStyle,1000],['注意事項',payload.pet.concerns,1000],
  ] as const) if(value.length>max) throw new Error(`${name}は${max}文字以内で入力してください。`)
  if([payload.media.photo,payload.media.video].some(file=>file && file.name.length>120)) throw new Error('ファイル名は120文字以内にしてください。')
}
type InviteState = { kind:'loading' } | { kind:'ready'; invite:OwnerInvite } | { kind:'invalid' } | { kind:'unavailable' }

export default function OwnerRegistration({ token }: { token:string|null }) {
  const [attempt,setAttempt]=useState(0)
  const [state,setState]=useState<InviteState>({kind:'loading'})
  const [steps,setSteps]=useState(INITIAL_STEPS)
  const [complete,setComplete]=useState(false)
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
    setSteps(INITIAL_STEPS.map(item=>({...item,status:item.id===step?'active':'idle'})))
    try {
      // Recheck the capability before processing. No staff repositories are used on this route.
      const current=await createInviteRepository()!.get(token)
      if(!current||current.id!==state.invite.id||current.facilityId!==state.invite.facilityId)throw new Error('invite-invalid')
      const key=(file:File|null)=>file?[file.name,file.type,file.size,file.lastModified]:null
      const signature=JSON.stringify({pet:payload.pet,photo:key(payload.media.photo),video:key(payload.media.video)})
      if(cached.current?.signature!==signature){
        const result=await worker.analyzeOwnerRegistration({personality:payload.pet.personality,playStyle:payload.pet.playStyle,concerns:payload.pet.concerns,photo:payload.media.photo??undefined,video:payload.media.video??undefined})
        cached.current={signature,analysis:result.analysis}
      }
      const analysis=cached.current.analysis
      step='intake'
      setSteps([{...INITIAL_STEPS[0],status:'done'},{...INITIAL_STEPS[1],status:'active'}])
      const intake:OwnerIntake={
        id:current.id,inviteId:current.id,facilityId:current.facilityId,owner:{...payload.owner},
        pet:{name:payload.pet.name,breed:payload.pet.breed,ageYears:payload.pet.age,weightKg:payload.pet.weightKg,sex:payload.pet.sex,personality:payload.pet.personality,playStyle:payload.pet.playStyle,concerns:payload.pet.concerns},
        media:{photo:mediaMetadata(payload.media.photo,'image'),video:mediaMetadata(payload.media.video,'video')},
        aiAnalysis:analysis,matchingProfile:analysis.matchingProfile,status:'ready',submittedAt:new Date().toISOString(),
      }
      await repository.save(intake)
      cached.current=null
      setComplete(true)
      setSteps(INITIAL_STEPS)
    } catch(error) {
      setSteps(items=>items.map(item=>item.id===step?{...item,status:'error'}:item))
      if(step==='intake')throw new Error('登録を確認できませんでした。このURLが使用済みの可能性があります。施設へ登録状況を確認し、必要な場合は新しいURLをご依頼ください。')
      if(error instanceof Error && error.message==='invite-invalid')throw new Error('この登録URLは利用できません。施設へお問い合わせください。')
      throw new Error('内容の確認処理を完了できませんでした。接続を確認し、もう一度お試しください。')
    }
  }
  if(!token)return <OwnerInviteError reason="missing" />
  if(state.kind==='loading')return <section className="app-state-panel" role="status"><h1>登録URLを確認しています</h1><p>そのままお待ちください。</p></section>
  if(state.kind==='invalid')return <OwnerInviteError reason="invalid" />
  if(state.kind==='unavailable')return <OwnerInviteError reason="unavailable" onRetry={()=>setAttempt(n=>n+1)} />
  return <div className="app-shell app-shell--owner">
    {!complete && <ProcessingStatus title="登録の進行状況" steps={steps} />}
    <OwnerForm inviteId={state.invite.id} onSubmit={submit}/>
  </div>
}
