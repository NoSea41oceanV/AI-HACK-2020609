import { useState } from 'react'
import type { PairCompatibility } from '../domain/types'
import type { DomainPetProfile, MatchingResult, RoomDefinition } from './pawPalsModel'
import { petById, petPhotoUrl, roomName, sharesRoom } from './pawPalsModel'

interface FriendMapScreenProps {
  pets: readonly DomainPetProfile[]
  matchingResult: MatchingResult | null
  rooms: readonly RoomDefinition[]
  selectedPetId: string
  onSelectPet: (petId: string) => void
}

type MapFilter = 'all' | 'room' | 'blocked' | 'allowed'
type Position = { x: number; y: number }

const MAP_FILTERS: ReadonlyArray<{ id: MapFilter; label: string }> = [
  { id: 'all', label: 'すべて' },
  { id: 'room', label: '同じ部屋' },
  { id: 'blocked', label: '禁忌事項あり' },
  { id: 'allowed', label: '禁忌事項なし' },
]

function createPositions(pets: readonly DomainPetProfile[], selectedPetId: string): ReadonlyMap<string, Position> {
  const positions = new Map<string, Position>()
  if (pets.length === 0) return positions
  positions.set(selectedPetId, { x: 450, y: 280 })
  const others = pets.filter((pet) => pet.id !== selectedPetId)
  others.forEach((pet, index) => {
    const angle = -Math.PI / 2 + index / Math.max(1, others.length) * Math.PI * 2
    positions.set(pet.id, {
      x: 450 + Math.cos(angle) * 330,
      y: 280 + Math.sin(angle) * 205,
    })
  })
  return positions
}

function filterPairs(pairs: readonly PairCompatibility[], filter: MapFilter, result: MatchingResult | null): PairCompatibility[] {
  if (filter === 'room') return pairs.filter((pair) => sharesRoom(result, pair))
  if (filter === 'blocked') return pairs.filter((pair) => !pair.allowed)
  if (filter === 'allowed') return pairs.filter((pair) => pair.allowed)
  return [...pairs]
}

function nodeClassForPet(pet: DomainPetProfile): string {
  const style = pet.playStyles[0]
  if (style === 'chase') return 'chaser'
  if (style === 'wrestle') return 'wrestler'
  if (style === 'tug' || style === 'fetch') return 'toy'
  if (style === 'gentle') return 'observer'
  return 'unknown'
}

export default function FriendMapScreen({ pets, matchingResult, rooms, selectedPetId, onSelectPet }: FriendMapScreenProps) {
  const [filter, setFilter] = useState<MapFilter>('all')
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0] ?? null
  const petIndex = petById(pets)
  const positions = createPositions(pets, selectedPet?.id ?? '')
  const pairs = matchingResult?.pairResults.filter((pair) => petIndex.has(pair.petAId) && petIndex.has(pair.petBId)) ?? []
  const selectedPairs = selectedPet
    ? pairs.filter((pair) => pair.petAId === selectedPet.id || pair.petBId === selectedPet.id)
    : []
  const visiblePairs = filterPairs(selectedPairs, filter, matchingResult)
  const sameRoomCount = selectedPairs.filter((pair) => sharesRoom(matchingResult, pair)).length
  const blockedCount = selectedPairs.filter((pair) => !pair.allowed).length

  return (
    <section className="screen active" aria-labelledby="friend-map-title">
      <div className="page-title">
        <div>
          <span className="eyebrow">おともだちマップ</span>
          <h1 id="friend-map-title">おともだちマップ</h1>
          <p>当日の預かり犬を選ぶと、その子を中心に相性・禁忌事項・割当案の同室状況を確認できます。</p>
        </div>
      </div>
      {selectedPet && matchingResult ? (
        <>
          <div className="card map-card">
            <div className="map-toolbar">
              <div role="group" aria-label="関係線の絞り込み">
                {MAP_FILTERS.map((item) => (
                  <button type="button" className={`filter ${filter === item.id ? 'active' : ''}`} key={item.id} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="graph">
              <svg viewBox="0 0 900 560" preserveAspectRatio="xMidYMid meet" aria-label="登録犬の相性関係図">
                <g className="edges">
                  {visiblePairs.map((pair) => {
                    const start = positions.get(pair.petAId)
                    const end = positions.get(pair.petBId)
                    if (!start || !end) return null
                    const sameRoom = sharesRoom(matchingResult, pair)
                    return (
                      <line
                        key={pair.pairKey}
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        className={`${pair.allowed ? 'good' : 'incompatible'} ${sameRoom ? 'active-room' : 'not-in-room'}`}
                      >
                        <title>{petIndex.get(pair.petAId)?.name} × {petIndex.get(pair.petBId)?.name}: 相性 {pair.score}% / {pair.allowed ? '禁忌事項なし' : '禁忌事項あり'}</title>
                      </line>
                    )
                  })}
                </g>
                <g className="nodes">
                  {pets.map((pet) => {
                    const position = positions.get(pet.id)
                    if (!position) return null
                    const selected = pet.id === selectedPet.id
                    const inRoom = matchingResult.status === 'success' && matchingResult.rooms.some((room) => room.petIds.includes(pet.id))
                    return (
                      <g
                        transform={`translate(${position.x} ${position.y})`}
                        className={`node ${nodeClassForPet(pet)} ${inRoom ? 'room' : ''} ${selected ? 'selected' : ''}`}
                        key={pet.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${pet.name}を中心に表示`}
                        onClick={() => onSelectPet(pet.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onSelectPet(pet.id)
                          }
                        }}
                      >
                        <circle r={selected ? 36 : 29} />
                        <clipPath id={`pet-clip-${pet.id}`}><circle r={selected ? 32 : 25} /></clipPath>
                        <image href={petPhotoUrl(pet)} x={selected ? -32 : -25} y={selected ? -32 : -25} width={selected ? 64 : 50} height={selected ? 64 : 50} preserveAspectRatio="xMidYMid slice" clipPath={`url(#pet-clip-${pet.id})`} />
                        <text className="name" y={selected ? 58 : 51}>{pet.name}</text>
                      </g>
                    )
                  })}
                </g>
              </svg>
            </div>
            <div className="legend">
              <span><i className="dot good" />禁忌事項なし</span>
              <span><i className="dot incompatible" />同室不可</span>
              <span>太い実線＝同じ部屋</span><span>点線＝別の部屋</span><span>赤い点線＝同室不可</span>
            </div>
          </div>

          <div className="card map-detail-wide">
            <div className="map-detail-head">
              <div><span className="eyebrow">選択中の犬</span><h2>{selectedPet.name}の関係</h2><p>当日の預かり犬の全候補を表示しています。相性は6因子と利用可能なAI 7軸から計算した目安です。</p></div>
              <span className="map-focus">{selectedPairs.length}ペア</span>
            </div>
            <div className="relation-summary">
              <div><b>{selectedPairs.length}</b><span>評価済み</span></div>
              <div><b>{sameRoomCount}</b><span>同じ部屋</span></div>
              <div><b>{blockedCount}</b><span>同室不可</span></div>
            </div>
            <div className="relation-grid-list">
              {selectedPairs.map((pair) => {
                const otherId = pair.petAId === selectedPet.id ? pair.petBId : pair.petAId
                const other = petIndex.get(otherId)
                const currentRoom = matchingResult.status === 'success'
                  ? matchingResult.rooms.find((room) => room.petIds.includes(selectedPet.id) && room.petIds.includes(otherId))
                  : undefined
                return (
                  <div className={`relation-card ${pair.allowed ? 'good' : 'incompatible'}`} key={pair.pairKey}>
                    <div className="relation-head">
                      <div><b>{selectedPet.name}</b><span>×</span><b>{other?.name ?? otherId}</b></div>
                      <span className={`verdict ${pair.allowed ? 'good' : 'incompatible'}`}>{pair.allowed ? '制約なし' : '同室不可'}</span>
                    </div>
                    <div className="relation-score"><strong>{pair.score}</strong><small>%</small></div>
                    <div className="relation-grid">
                      <div><span>割当案の部屋</span><b>{currentRoom ? roomName(rooms, currentRoom.roomId) : '同室割当なし'}</b></div>
                      <div><span>禁忌事項</span><b>{pair.hardConstraints.map((item) => item.message).join(' / ') || '該当なし'}</b></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="card pawpals-empty"><b>マップを表示できません</b><p>{pets.length === 0 ? '当日の預かり犬を選択してください。' : '相性計算を実行すると関係図を確認できます。'}</p></div>
      )}
    </section>
  )
}
