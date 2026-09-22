# Hackathon Evidence Charter

## 狙う成果

サンプル入力を使い、実際のFirebase保存、Worker経由のOrcaRouter解析、分析結果保存、全ペア採点、部屋最適化を短いデモで示す。サンプルデータを使うことと、処理が実サービスで行われることを混同しない。

## デモで示す証拠

- 固定URLのフォームから飼い主とペットを登録し、Firebaseへ保存した値を再読込できる。
- 名前・連絡先を除外した性格・遊び方・注意事項と、写真・動画から抽出した静止画フレームをWorker経由でOrcaRouterが実際に解析する。
- 分析結果と性格パラメータをFirebaseに保存して読み戻す。
- 写真・動画は解析後に永続保存されず、元動画と動画内音声もAIへ送られない。
- 全ペアのスコアが揃った後で、定員・安全制約を考慮した部屋割りを作成する。
- AIや保存に失敗したとき、成功を捏造せず明示エラーになる。
- オペレーターが提案を確認し、最終確定する。

## 技術・料金境界

- Firebase Sparkのみ（Firestore、Hosting）。Firebase Cloud Functions / Cloud Storageを使わない。
- Cloudflare Workers Freeのみ。
- OrcaRouter Secretは再発行済みのものをCloudflare Worker Secretへだけ設定する。以前チャットに貼られたキーを使わない。
- Firebase Project ID `pawpair-ai-hack-2026`、Firestore `asia-northeast1`、Spark、Hosting / Rules配備、公開URL `https://pawpair-ai-hack-2026.web.app`、実Firestore read-backを確認済み。
- Cloudflare Workers Freeの `pet-hotel-agent-api` は `https://pet-hotel-agent-api.nosea41oceanv.workers.dev` へ配備済み。health、Secret参照、media storage無効、OrcaRouter実構造化分析を確認済み。旧`prompt`は400、raw動画・音声は415で拒否する。
- 外部AIへ送信可能なのは性格・遊び方・注意事項と画像だけである。動画はブラウザで最大2枚のJPEGフレームへ変換し、元動画・動画内音声は送らない。飼い主名・連絡先・音声・request bodyは送らず記録しない。

## 禁止するデモ表現

- AI未実行のキーワード規則や固定値をAI成功のように見せない。
- AI/Worker失敗時にローカル推論や固定結果で成功したように振る舞わない。
- 飼い主名・連絡先・音声を外部AIへ送らない。
- 解析後も画像・動画を保存する構成にせず、raw動画をWorkerへ送らない。
- 未実施の配備・検証を実績として記録しない。
- AIが安全を保証する、または人間確認なしに部屋を確定すると主張しない。

## 受入条件

2026-09-22に、架空2頭のOwnerフォーム登録、Worker / OrcaRouter実解析、Firestore受付保存、非PIIプロフィール保存/read-back、全1ペア採点、1部屋最適化、当日観測保存・再計算、施設オペレーター最終確定まで公開E2Eで確認した。console error/warn 0、OwnerIntake localStorage key null、390 × 844表示も確認済みである。公開匿名書込みはハッカソン限定であり、第三者アクセスによる無料枠消費リスクを受容したデモ構成として扱う。詳細は [TASKS.md](../TASKS.md) を参照。
