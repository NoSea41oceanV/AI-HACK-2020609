# PAWPAIR

ペットホテル向けの相性評価・部屋割り支援デモです。サンプルなのは入力データだけです。フォーム保存、AI解析、全ペア採点、部屋割りは実サービスを使う本物の処理として構成します。

## 目標と現在の状態

目標の流れは、飼い主フォーム → Firebase Sparkへの実保存 → Cloudflare Workers Freeへの実リクエスト → OrcaRouterによる文章・写真・動画の実解析 → 性格パラメータと分析結果のFirebase保存 → 全ペア実採点 → 部屋最適化です。

この流れは**まだ実配備・実E2Eで確認されていません**。コードにある機能とサービス上の実稼働を区別してください。現在、OwnerFormからWorkerを呼ぶ接続はなく、FirebaseとOrcaRouterも実設定・実接続を確認していません。進捗は [TASKS.md](TASKS.md) を参照してください。

## 固定要件

- FirebaseはSparkプランのみ。Cloud Functions for FirebaseとCloud Storage for Firebaseは使用しません。
- AIプロキシはCloudflare Workers Freeのみを使用します。
- 飼い主名、連絡先、音声をOrcaRouterへ送信しません。AIへ渡すのは分析に必要な性格文章と写真・動画だけです。
- 写真・動画はAI解析のための一時入力とし、解析後に永続保存しません。分析結果と性格パラメータはFirebaseへ保存します。
- 音声の入力・抽出・解析・保存を行いません。
- AI/Workerの失敗を成功扱いせず、固定結果やローカルAI風判定に置き換えません。失敗は画面に明示します。
- 全ペアの採点を完了してから、部屋数・定員・安全制約を考慮した部屋割り最適化を行います。
- 単一利用者、固定URLを前提とします。ログイン、複数施設分離、有料プランは対象外です。

## ローカル開発

Node.js 20.19以上（推奨22.12以上）とnpmを使用します。

```powershell
npm install
npm run dev
```

- スタッフ画面: `/`
- 飼い主フォーム: `/?view=owner`

現在はFirebase設定がない場合にlocalStorageリポジトリが選ばれます。このローカル動作は開発用であり、本番フローの完了やAI処理の成功を示しません。AI接続に失敗した場合は成功データを作らずエラーにします。

## 接続設定・配備

Firebase Web configとProject ID、Cloudflareログイン、再発行済みOrcaRouter Secretが未確認です。以前チャットに貼られたキーは使わないでください。新しいキーはCloudflare Worker Secretにのみ登録し、ブラウザ変数、リポジトリ、Firestore、ログには置きません。

実設定値を作成・配備する前に、タスク台帳の保留事項を解消してください。Firebase SparkとWorkers Freeを越える設定へ移行しません。配備手順は [DEPLOYMENT.md](docs/DEPLOYMENT.md) が担当文書です。

## 検証

```powershell
npm run typecheck
npm test
npm run build
```

Workerのテストは `cd worker; npm test` で実行します。これらの自動テストだけではFirebase、Worker、OrcaRouterへの実接続・配備を証明しません。実E2Eは外部保留事項を解消して別途実行し、実施結果を記録してください。

## 設計資料

- [プロダクト設計書](docs/ペットホテル自律AIエージェント_設計書_v4.md)
- [Firebase版 実装設計書](docs/実装設計書_Firebase版.md)
- [ER図](docs/ER図.md)
- [アーキテクチャ図](docs/アーキテクチャ図.md)
- [実装タスク](TASKS.md)
