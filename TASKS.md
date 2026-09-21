# PAWPAIR 実装タスク台帳

最終更新: 2026-09-22（JST）

## 最重要の保留事項・確定した送信範囲

- **外部送信範囲**: ユーザー承認済み。性格・遊び方・注意事項と、写真または動画からブラウザで抽出したJPEGフレームだけを送る。飼い主名・連絡先・元動画・音声はWorkerリクエスト、OrcaRouter送信、ログのいずれにも含めず、request bodyもログ出力しない。
- **Firebase設定・接続**: Project ID `pawpair-ai-hack-2026`、Web App設定、Firestore `asia-northeast1`、Sparkプランは設定済み。Firebase CLIの本人認証が未完了で、実Firestore read-backとHosting / Rules配備は未確認。
- **Cloudflare Worker接続**: Workers Freeの `pet-hotel-agent-api` を `https://pet-hotel-agent-api.nosea41oceanv.workers.dev` へ配備済み。`health`、新規 `ORCAROUTER_API_KEY` Secret参照、media storage無効、実OrcaRouter構造化応答を確認済み。旧`prompt`は400、raw動画・音声は415で拒否する。
- **料金境界**: FirebaseはSparkのみ。CloudflareもWorkers Freeのみ。上位プラン、課金移行、従量課金機能は採用しない。

## 確定要件と完了の定義

- デモ用サンプルは入力データだけ。フォーム保存、Worker呼出、AI解析、分析結果保存、全ペア採点、部屋割り最適化は本物の処理にする。
- フローは飼い主フォーム → Cloudflare Worker実リクエスト → OrcaRouterによる文章・写真・動画由来JPEGフレームの実解析 → Firebase実保存 → 全ペア実採点 → 部屋最適化。
- 飼い主名・連絡先・音声は外部AIへ送信しない。画像・動画は解析処理の完了後に永続保存しない。分析結果と性格パラメータは保存する。
- AI/Workerが失敗したときは明示的なエラー状態にする。固定結果、擬似成功、黙ったローカルAI代替は認めない。AIなしの独立した操作を提供する場合は、AI失敗を隠さず区別する。
- 単一利用者、固定URL、音声なし。全ペアの採点完了後に部屋割り最適化を行う。
- 実配備と実E2Eが終わるまでは配備済み・統合完了としない。コードや単体テストの存在を実接続の証拠にしない。

## 作業タスク

| ID | 目的 | 状態 | 保留理由 / 必要なユーザー回答 | 次の一手 | 依存 | 主な担当ファイル | 検証方法 |
|---|---|---|---|---|---|---|---|
| [01] | Firebase Spark実保存と固定URL配備 | 配備待ち | Project / Web App / Spark / Firestoreリージョンは設定済み。Firebase CLI本人認証が未完了 | CLIログイン後、`firestore:rules,hosting`だけを配備しread-backを確認 | なし | `src/lib/firebase.ts`, `src/data/firestore*`, `firestore.rules`, `firebase.json`, `docs/DEPLOYMENT.md` | Firestore実保存のread-back、Rules確認、Sparkプラン確認、Hosting URLの実配備確認 |
| [02] | Cloudflare Workers Freeへ実配備 | 配備・疎通済み | なし | Firebase Hostingのorigin確定後にCORSを再確認 | なし | `worker/**`, `wrangler.toml.example`, `docs/DEPLOYMENT.md` | Worker URLのhealth、実HTTP、media storage無効、Workers Freeを確認済み |
| [03] | OrcaRouter実解析と失敗制御 | 実解析確認済み | ブラウザからFirebaseまでの統合E2Eは[01]待ち | Firebase配備後のUI経由E2Eで再確認 | [02] | `src/lib/workerClient.ts`, `worker/**`, `src/domain/intakeProfile.ts` | 実構造化応答成功、旧payload 400、raw動画/音声415を確認済み |
| [04] | 入力保存・PII境界・媒体一時処理 | 実装済み・Firebase確認待ち | 実Firestore write/read-backは[01]待ち | UIから架空データを登録し、保存内容とWorker payloadを確認 | [01], [03] | `src/pages/OwnerForm.tsx`, `src/data/intakeRepository.ts`, `src/data/firestoreIntakeRepository.ts`, `worker/index.ts`, `firestore.rules` | Firebase read-back、AI payload検査、原本非保存、分析結果永続化 |
| [05] | 全ペア実採点と部屋割り最適化の実接続 | 実装済み・Firebase確認待ち | 実FirestoreデータでのE2Eは[01][04]待ち | 複数頭を登録し、全組合せ計算後の保存・表示を確認 | [01], [04] | `src/domain/**`, `src/pages/**`, `src/data/firestorePetRepository.ts`, `src/data/firestoreOperationRepository.ts` | n(n-1)/2全ペア、採点完了後の最適化、制約/解なし結果 |
| [06] | README・TASKS・設計書・図を確定要件と実装事実へ同期 | 完了 | Firebase実配備後に最終状態を追記する | Firebase配備証跡に応じて状態を更新 | [01]-[05]の現状を読取確認 | `README.md`, `TASKS.md`, `docs/ペットホテル自律AIエージェント_設計書_v4.md`, `docs/実装設計書_Firebase版.md`, `docs/ER図.md`, `docs/アーキテクチャ図.md`, `docs/HACKATHON_CHARTER.md` | 旧表現の横断検索、相対リンク、Mermaid fence、`git diff --check` |

## 現在のコードから確認したこと

- `src/pages/OwnerForm.tsx` は飼い主名・連絡先・ペット情報と写真/動画を受け取る。
- `src/App.tsx` はWorker解析を先に実行し、分析結果・性格パラメータを含む受付をFirestoreへcreateする。その後プロフィールを保存してFirestoreからread-backし、全ペア採点・最適化を保存する。Firebase有効時のOwnerIntakeをlocalStorageへミラーしない。
- `src/lib/workerClient.ts` は性格・遊び方・注意事項だけでpayloadを作り、写真と、動画からブラウザ内で最大2枚抽出したJPEGフレームを `/api/analyze` へ送る。元動画と動画内音声は送らない。
- 配備済みWorkerは3項目以外のprofile keyと旧`prompt`を拒否する。画像は最大3件、raw動画・音声は拒否し、`/api/media` は410で永続保存を拒否する。
- Firebase未設定・Firestore失敗・Worker失敗は明示エラーとなり、localStorageや固定値の成功動線に切り替えない。
- Worker / OrcaRouterの実疎通は確認済み。残る外部証跡はFirebase Hosting / Rules配備、Firestore read-back、UIから確定までの実E2Eである。

## タスク状態の意味

- **進行中**: この台帳・文書の更新作業中。
- **実装済み**: コードが存在すること。外部接続・配備完了を意味しない。
- **検証済み**: 明記された検証だけを実行済み。
- **配備済み**: 指定サービス上の実配備と疎通が証拠で確認済み。

## 全体の受入ゲート

1. Firebase SparkへHosting / Rulesを実配備し、Firestore read-backで永続化を確認する。
2. Cloudflare Workers Freeへの実配備、Worker health、実OrcaRouter構造化応答（確認済み）。
3. 再発行したOrcaRouter SecretをWorker Secretとして参照し、Secret値を露出しない（確認済み）。
4. 3項目のテキスト・写真・動画由来JPEGフレームが解析され、名前・連絡先・元動画・音声がAIへ送られず、媒体が解析後に残らないことを確認する。
5. 性格パラメータ/分析結果をFirebaseから再読込できることを確認する。
6. 全ペアを実採点してから部屋最適化が走る実E2Eを確認する。
7. AI失敗時に明示エラーとなり、擬似結果・固定結果・ローカルAI代替へ成功扱いで切り替わらないことを確認する。
8. 使用サービスがFirebase SparkとCloudflare Workers Freeに限られることを確認する。

公開Rulesは認証を省いたハッカソン限定構成である。第三者による匿名書込みと無料枠消費のリスクがあるため、本番運用へ流用しない。
