# Hackathon Evidence Charter

## 狙う成果

サンプル入力を使い、実際のFirebase保存、Worker経由のOrcaRouter解析、分析結果保存、全ペア採点、部屋最適化を短いデモで示す。サンプルデータを使うことと、処理が実サービスで行われることを混同しない。

## デモで示す証拠

- 固定URLのフォームから飼い主とペットを登録し、Firebaseへ保存した値を再読込できる。
- 名前・連絡先を除外した文章と写真・動画をWorker経由でOrcaRouterが実際に解析する。
- 分析結果と性格パラメータをFirebaseに保存して読み戻す。
- 写真・動画は解析後に永続保存されず、音声もAIへ送られない。
- 全ペアのスコアが揃った後で、定員・安全制約を考慮した部屋割りを作成する。
- AIや保存に失敗したとき、成功を捏造せず明示エラーになる。
- オペレーターが提案を確認し、最終確定する。

## 技術・料金境界

- Firebase Sparkのみ（Firestore、Hosting）。Firebase Cloud Functions / Cloud Storageを使わない。
- Cloudflare Workers Freeのみ。
- OrcaRouter Secretは再発行済みのものをCloudflare Worker Secretへだけ設定する。以前チャットに貼られたキーを使わない。
- Firebase Project ID `pawpair-ai-hack-2026`、Firestore `asia-northeast1`、Sparkプランは確認済み。Web App configと実保存・配備は未確認。外部AIへ送信可能なのは性格・遊び方・注意事項・写真・動画のみで、飼い主名・連絡先・音声・request bodyは送らず記録しない。Cloudflare Workers Freeの `pet-hotel-agent-api` 作成と新規Secretの暗号化登録は報告済みだが、現在コードの配備・実リクエストは未確認。

## 禁止するデモ表現

- AI未実行のキーワード規則や固定値をAI成功のように見せない。
- AI/Worker失敗時にローカル推論や固定結果で成功したように振る舞わない。
- 飼い主名・連絡先・音声を外部AIへ送らない。
- 解析後も画像・動画を保存する構成にしない。
- 実配備・実E2E未実施を完了と書かない。
- AIが安全を保証する、または人間確認なしに部屋を確定すると主張しない。

## 受入条件

Firebase read-back、Worker実リクエスト、OrcaRouter実解析、分析結果保存、媒体破棄、全ペア→最適化の実E2Eを記録する。テスト/配備ごとに実施日、対象環境、結果を残す。詳細な保留事項は [TASKS.md](../TASKS.md) を参照。
