import StaffInvitePanel from '../components/StaffInvitePanel'

interface InviteScreenProps {
  staffName: string
  onIssueInvite: () => Promise<string>
}

export default function InviteScreen({ staffName, onIssueInvite }: InviteScreenProps) {
  return (
    <section className="screen active" aria-labelledby="invite-screen-title">
      <div className="page-title">
        <div>
          <span className="eyebrow">飼い主さんの登録</span>
          <h1 id="invite-screen-title">愛犬プロフィール登録のご案内</h1>
          <p>施設から専用URLまたはQRコードを発行し、飼い主さんへお渡しします。</p>
        </div>
      </div>
      <div className="owner-layout pawpals-owner-layout">
        <div className="card pawpals-owner-guide">
          <div className="section-heading">
            <span>1</span>
            <div><h2>登録URLを発行</h2><small>1頭につき1つのURLを発行します</small></div>
          </div>
          <div className="section-heading">
            <span>2</span>
            <div><h2>飼い主さんが専用フォームへ入力</h2><small>招待URL以外からは登録フォームへ入れません</small></div>
          </div>
          <div className="section-heading">
            <span>3</span>
            <div><h2>登録後に施設データへ反映</h2><small>プロフィール帳と相性計算で確認できます</small></div>
          </div>
        </div>
        <div className="card pawpals-invite-card">
          <StaffInvitePanel onIssue={onIssueInvite} issuedByLabel={staffName} />
        </div>
      </div>
    </section>
  )
}
