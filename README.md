# PAWPAIR

ペットホテル向けの相性評価・部屋割り支援デモです。サンプルなのは入力データだけです。フォーム保存、AI解析、全ペア採点、部屋割りは実サービスを使う本物の処理として構成します。

## 目標と現在の状態

目標の流れは、飼い主フォーム → Cloudflare Workers Freeへの実リクエスト → OrcaRouterによる文章・写真・動画由来の静止画フレームの実解析 → 性格パラメータと分析結果のFirebase Spark保存 → 全ペア実採点 → 部屋最適化です。

Cloudflare Worker `pet-hotel-agent-api` はWorkers Freeへ配備済みで、[`/health`](https://pet-hotel-agent-api.nosea41oceanv.workers.dev/health) とOrcaRouterの実構造化分析を確認済みです。FirebaseはProject ID、Web App設定、Sparkプラン、Firestore `asia-northeast1` まで設定済みですが、Firebase CLIの本人認証が残っているためHosting / Firestore Rulesの実配備と実Firestore read-backは未確認です。したがって、フロー全体の実E2Eはまだ完了扱いにしません。進捗は [TASKS.md](TASKS.md) を参照してください。

## 固定要件

- FirebaseはSparkプランのみ。Cloud Functions for FirebaseとCloud Storage for Firebaseは使用しません。
- AIプロキシはCloudflare Workers Freeのみを使用します。
- 飼い主名、連絡先、音声をOrcaRouterへ送信しません。AIへ渡す文章は性格・遊び方・注意事項の3項目だけです。
- 写真・動画はAI解析のための一時入力とし、解析後に永続保存しません。分析結果と性格パラメータはFirebaseへ保存します。
- 写真は一時的な画像data URLとして送ります。動画はブラウザで最大2枚のJPEGフレームへ変換し、元動画と動画内音声はWorkerへ送りません。
- 音声の入力・抽出・解析・保存を行いません。Workerもraw動画と音声を拒否します。
- AI/Workerの失敗を成功扱いせず、固定結果やローカルAI風判定に置き換えません。失敗は画面に明示します。
- 全ペアの採点を完了してから、部屋数・定員・安全制約を考慮した部屋割り最適化を行います。
- 単一利用者、固定URLを前提とします。ログイン、複数施設分離、有料プランは対象外です。

## ローカル開発

Node.js 20.19以上（推奨22.12以上）とnpmを使用します。

```powershell
npm install
Copy-Item .env.example .env.local
# .env.local にFirebase公開Web設定4項目とVITE_AI_WORKER_URLを設定
npm run dev
```

- スタッフ画面: `/`
- 飼い主フォーム: `/?view=owner`

`.env.local` には `VITE_FIREBASE_API_KEY`、`VITE_FIREBASE_AUTH_DOMAIN`、`VITE_FIREBASE_PROJECT_ID`、`VITE_FIREBASE_APP_ID`、`VITE_AI_WORKER_URL` が必要です。Repositoryには開発用localStorage実装もありますが、Firebaseを有効にした実フローではOwnerIntakeをlocalStorageへミラーせず、Firebase未設定・保存失敗・AI接続失敗をローカル成功へ置き換えません。

## 接続設定・配備

Firebase Project ID `pawpair-ai-hack-2026`、Web App設定、Firestoreリージョン `asia-northeast1`、Sparkプランは設定済みです。Firebase CLIの本人認証、実Firestore read-back、Hosting / Rules配備は未確認です。リポジトリの `.firebaserc` は実Project IDを設定済みなので、サンプルで上書きしないでください。

Cloudflare Workers Freeの `pet-hotel-agent-api` は `https://pet-hotel-agent-api.nosea41oceanv.workers.dev` へ配備済みです。`health`、新しい `ORCAROUTER_API_KEY` Secret参照、実OrcaRouter構造化分析、media storage無効を確認済みです。旧`prompt`形式は400、raw動画・音声は415で拒否します。飼い主名・連絡先・音声・request bodyをログへ含めず、以前チャットに貼られたキーも使用しません。

Firebase SparkとWorkers Freeを越える設定へ移行しません。Firebaseの公開匿名書込みは認証を省いたハッカソン限定構成で、第三者アクセスによる無料枠消費リスクがあります。配備手順は [DEPLOYMENT.md](docs/DEPLOYMENT.md) を参照してください。

## 検証

```powershell
npm run typecheck
npm test
npm run build
```

Workerのテストは `npm --prefix worker test` で実行します。Cloudflare WorkerとOrcaRouterの実疎通は確認済みですが、自動テストやその疎通だけではFirebase保存を含む全体E2Eを証明しません。Firebase配備後に実施結果を記録してください。

## 設計資料

- [プロダクト設計書](docs/ペットホテル自律AIエージェント_設計書_v4.md)
- [Firebase版 実装設計書](docs/実装設計書_Firebase版.md)
- [ER図](docs/ER図.md)
- [アーキテクチャ図](docs/アーキテクチャ図.md)
- [実装タスク](TASKS.md)
