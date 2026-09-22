import './StaffSignIn.css'

export interface StaffChoice { id: string; name: string }
interface StaffSelectionProps {
  staff: readonly StaffChoice[]
  onSelect: (id: string) => void
  onSignOut: () => void
}

export default function StaffSelection({ staff, onSelect, onSignOut }: StaffSelectionProps) {
  return (
    <main className="staff-sign-in">
      <section className="staff-sign-in__card" aria-labelledby="staff-selection-title">
        <span className="staff-sign-in__brand">PAWLAND</span>
        <h1 id="staff-selection-title">操作するスタッフを選択</h1>
        <p>登録URLを発行した担当者として記録します。</p>
        {staff.length ? <div className="staff-selection__list">{staff.map(person => <button key={person.id} type="button" onClick={() => onSelect(person.id)}>{person.name}</button>)}</div> : <p role="status">スタッフがまだ登録されていません。施設の管理担当者に確認してください。</p>}
        <p className="staff-sign-in__help">スタッフ名の選択は操作担当の記録用です。個人の本人確認ではありません。</p>
        <button className="staff-selection__sign-out" type="button" onClick={onSignOut}>施設アカウントからログアウト</button>
      </section>
    </main>
  )
}
