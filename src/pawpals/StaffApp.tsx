import { useState } from 'react'
import type { ObservationSubmission } from '../components/ObservationPanel'
import type { MatchingSnapshot, ObservationRecord } from '../data'
import type { DailyOperationDay, DailyOperationPlan, FacilityRoomSettings, OperationAuditEvent } from '../domain/dailyOperations'
import type { MatchingResult, PetProfile as DomainPetProfile, RoomDefinition } from '../domain/types'
import CompatibilityScreen from './CompatibilityScreen'
import FriendMapScreen from './FriendMapScreen'
import InviteScreen from './InviteScreen'
import ProfileScreen from './ProfileScreen'
import TodayScreen from './TodayScreen'
import './PawPals.css'
import './StaffApp.css'

export interface StaffAppProps {
  pets: readonly DomainPetProfile[]
  matchingResult: MatchingResult | null
  rooms: readonly RoomDefinition[]
  matchingHistory: readonly MatchingSnapshot[]
  observations: readonly ObservationRecord[]
  operationDate: string
  dailyOperation: DailyOperationDay | null
  roomSettings: FacilityRoomSettings | null
  currentPlan: DailyOperationPlan | null
  auditEntries: readonly OperationAuditEvent[]
  staffName: string
  busy: boolean
  onSaveDailyPets: (petIds: string[]) => Promise<void>
  onSaveRooms: (rooms: RoomDefinition[]) => Promise<void>
  onOptimize: () => void | Promise<void>
  onDecidePlan: (decision: 'confirmed' | 'rejected', reason: string) => Promise<void>
  onIssueInvite: () => Promise<string>
  onObserve: (submission: ObservationSubmission) => Promise<void>
  onSavePetProfile: (pet: DomainPetProfile) => Promise<void>
}

type ScreenId = 'owner' | 'today' | 'profile' | 'match' | 'map'

const NAV_ITEMS: ReadonlyArray<{ id: ScreenId; label: string }> = [
  { id: 'owner', label: '飼い主入力' },
  { id: 'today', label: '今日の運営' },
  { id: 'profile', label: 'プロフィール帳' },
  { id: 'match', label: '相性カルテ' },
  { id: 'map', label: 'おともだちマップ' },
]

export default function StaffApp(props: StaffAppProps) {
  const [screen, setScreen] = useState<ScreenId>('today')
  const [selectedPetId, setSelectedPetId] = useState('')
  const dailyPetIds = new Set(props.dailyOperation?.date === props.operationDate ? props.dailyOperation.selectedPetIds : [])
  const dailyPets = props.pets.filter((pet) => dailyPetIds.has(pet.id))
  return (
    <div className="app pawpals-app">
      <header className="site-header">
        <div className="brand-wrap">
          <div className="brand">PawPals</div>
          <div className="tagline">AIと一緒に、今日のわんこたちを見守る。</div>
        </div>
      </header>

      <nav className="main-nav" aria-label="施設メニュー">
        {NAV_ITEMS.map((item) => (
          <button
            type="button"
            className={`nav-item ${screen === item.id ? 'active' : ''}`}
            key={item.id}
            onClick={() => setScreen(item.id)}
            aria-current={screen === item.id ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main>
        {screen === 'owner' ? <InviteScreen staffName={props.staffName} onIssueInvite={props.onIssueInvite} /> : null}
        {screen === 'today' ? <TodayScreen {...props} /> : null}
        {screen === 'profile' ? (
          <ProfileScreen
            pets={props.pets}
            selectedPetId={selectedPetId}
            onSelectPet={setSelectedPetId}
            onOpenCompatibility={() => setScreen('match')}
            onOpenMap={() => setScreen('map')}
            onSavePetProfile={props.onSavePetProfile}
          />
        ) : null}
        {screen === 'match' ? (
          <CompatibilityScreen
            pets={dailyPets}
            matchingResult={props.matchingResult}
            selectedPetId={selectedPetId}
            onSelectPet={setSelectedPetId}
          />
        ) : null}
        {screen === 'map' ? (
          <FriendMapScreen
            pets={dailyPets}
            matchingResult={props.matchingResult}
            rooms={props.rooms}
            selectedPetId={selectedPetId}
            onSelectPet={setSelectedPetId}
          />
        ) : null}
      </main>
    </div>
  )
}
