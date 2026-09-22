import { useState } from 'react'
import './StaffInvitePanel.css'

export interface StaffInvitePanelProps {
  onIssue: () => Promise<string>
  issuedByLabel?: string
}

export async function createInviteQrSvg(inviteUrl: string): Promise<string> {
  const { encodeQR } = await import('qr')
  return encodeQR(inviteUrl, 'svg', { ecc: 'medium', border: 4, scale: 6 })
}

export async function createInviteQrMatrix(inviteUrl: string): Promise<boolean[][]> {
  const { encodeQR } = await import('qr')
  return encodeQR(inviteUrl, 'raw', { ecc: 'medium', border: 4 })
}

export function StaffInvitePanel({ onIssue, issuedByLabel }: StaffInvitePanelProps) {
  const [inviteUrl, setInviteUrl] = useState('')
  const [qrSvg, setQrSvg] = useState('')
  const [isIssuing, setIsIssuing] = useState(false)
  const [isGeneratingQr, setIsGeneratingQr] = useState(false)
  const [qrError, setQrError] = useState('')
  const [status, setStatus] = useState('')

  const generateQr = async (url: string) => {
    setIsGeneratingQr(true)
    setQrError('')
    try {
      setQrSvg(await createInviteQrSvg(url))
    } catch {
      setQrSvg('')
      setQrError('QRコードを生成できませんでした。URLはコピーして利用できます。')
    } finally {
      setIsGeneratingQr(false)
    }
  }

  const issueInvite = async () => {
    setIsIssuing(true)
    setStatus('')
    try {
      const url = await onIssue()
      setInviteUrl(url)
      setQrSvg('')
      setQrError('')
      setStatus('登録URLを発行しました。')
      await generateQr(url)
    } catch {
      setStatus('登録URLを発行できませんでした。接続と利用権限を確認し、もう一度お試しください。')
    } finally {
      setIsIssuing(false)
    }
  }

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setStatus('登録URLをコピーしました。')
    } catch {
      setStatus('コピーできませんでした。URLを選択してコピーしてください。')
    }
  }

  return (
    <section className="staff-invite" aria-labelledby="staff-invite-title">
      <div className="staff-invite__heading">
        <div>
          <h2 id="staff-invite-title">飼い主さま用の登録URL</h2>
        </div>
        {issuedByLabel && <span className="staff-invite__issuer">担当 {issuedByLabel}</span>}
      </div>

      {!inviteUrl ? (
        <div className="staff-invite__empty">
          <span className="staff-invite__paw" aria-hidden="true">
            <svg viewBox="0 0 32 32">
              <ellipse cx="10" cy="9" rx="3.2" ry="4.2" />
              <ellipse cx="22" cy="9" rx="3.2" ry="4.2" />
              <ellipse cx="5.8" cy="16" rx="3" ry="3.8" transform="rotate(-24 5.8 16)" />
              <ellipse cx="26.2" cy="16" rx="3" ry="3.8" transform="rotate(24 26.2 16)" />
              <path d="M16 14c-5 0-8.7 4.7-8.7 8.6 0 3 2.5 4.9 5.3 4.1a12.5 12.5 0 0 1 6.8 0c2.8.8 5.3-1.1 5.3-4.1C24.7 18.7 21 14 16 14Z" />
            </svg>
          </span>
          <div>
            <strong>来店前の入力をかんたんに</strong>
            <p>発行したURLをコピーするか、QRコードを読み取ってもらってください。</p>
          </div>
          <button type="button" onClick={issueInvite} disabled={isIssuing}>
            {isIssuing ? '発行中…' : '登録URLを発行'}
          </button>
        </div>
      ) : (
        <div className="staff-invite__result">
          <div className="staff-invite__share">
            <label htmlFor="staff-invite-url">発行したURL</label>
            <div className="staff-invite__url-row">
              <input id="staff-invite-url" value={inviteUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
              <button type="button" onClick={copyInvite}>コピー</button>
            </div>
            <p>このURLは登録完了まで利用できます。飼い主さまごとに新しく発行してください。</p>
            <button className="staff-invite__new" type="button" onClick={issueInvite} disabled={isIssuing}>
              {isIssuing ? '発行中…' : '新しい登録URLを発行'}
            </button>
          </div>
          <div className="staff-invite__qr">
            {qrSvg ? (
              <>
                <div aria-label="登録URLのQRコード" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                <span>スマートフォンで読み取る</span>
              </>
            ) : isGeneratingQr ? (
              <p>QRコードを生成中…</p>
            ) : qrError ? (
              <div className="staff-invite__qr-error" role="alert">
                <p>{qrError}</p>
                <button type="button" onClick={() => generateQr(inviteUrl)}>QRコードを再生成</button>
              </div>
            ) : (
              <p>新しい登録URLを発行中…</p>
            )}
          </div>
        </div>
      )}
      <p className="staff-invite__status" aria-live="polite">{status}</p>
    </section>
  )
}

export default StaffInvitePanel
