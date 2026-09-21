# PAWPAIR 実装タスク台帳

最終更新: 2026-09-22（JST）

## 完了状態・確定した送信範囲

- **外部送信範囲**: ユーザー承認済み。性格・遊び方・注意事項と、写真または動画からブラウザで抽出したJPEGフレームだけを送る。飼い主名・連絡先・元動画・音声はWorkerリクエスト、OrcaRouter送信、ログのいずれにも含めず、request bodyもログ出力しない。
- **Firebase設定・接続**: Project ID `pawpair-ai-hack-2026`、Firestore `asia-northeast1`、Spark、Hosting / Rules配備、公開URL `https://pawpair-ai-hack-2026.web.app`、実Firestore read-backを確認済み。
- **Cloudflare Worker接続**: Workers Freeの `pet-hotel-agent-api` を `https://pet-hotel-agent-api.nosea41oceanv.workers.dev` へ配備済み。`health`、新規 `ORCAROUTER_API_KEY` Secret参照、media storage無効、実OrcaRouter構造化応答を確認済み。旧`prompt`は400、raw動画・音声は415で拒否する。
- **料金境界**: FirebaseはSparkのみ。CloudflareもWorkers Freeのみ。上位プラン、課金移行、従量課金機能は採用しない。

## 確定要件と完了の定義

- デモ用サンプルは入力データだけ。フォーム保存、Worker呼出、AI解析、分析結果保存、全ペア採点、部屋割り最適化は本物の処理にする。
- フローは飼い主フォーム → Cloudflare Worker実リクエスト → OrcaRouterによる文章・写真・動画由来JPEGフレームの実解析 → Firebase実保存 → 全ペア実採点 → 部屋最適化。
- 飼い主名・連絡先・音声は外部AIへ送信しない。画像・動画は解析処理の完了後に永続保存しない。分析結果と性格パラメータは保存する。
- AI/Workerが失敗したときは明示的なエラー状態にする。固定結果、擬似成功、黙ったローカルAI代替は認めない。AIなしの独立した操作を提供する場合は、AI失敗を隠さず区別する。
- 単一利用者、固定URL、音声なし。全ペアの採点完了後に部屋割り最適化を行う。
- 2026-09-22の公開E2Eで、架空2頭の登録から実AI分析、Firestore保存/read-back、全1ペア採点、1部屋最適化、当日観測保存・再計算、施設オペレーター最終確定まで確認済み。

## 作業タスク

| ID | 目的 | 状態 | 保留理由 / 必要なユーザー回答 | 次の一手 | 依存 | 主な担当ファイル | 検証方法 |
|---|---|---|---|---|---|---|---|
| [01] | Firebase Spark実保存と固定URL配備 | 完了 | なし | 再配備時に同じE2Eを回帰確認 | なし | `src/lib/firebase.ts`, `src/data/firestore*`, `firestore.rules`, `firebase.json`, `docs/DEPLOYMENT.md` | Hosting / Rules配備、Spark、Firestore write/read-back確認済み |
| [02] | Cloudflare Workers Freeへ実配備 | 完了 | なし | 変更時にhealth・CORS・実AIを回帰確認 | なし | `worker/**`, `wrangler.toml.example`, `docs/DEPLOYMENT.md` | Worker URLのhealth、実HTTP、media storage無効、Workers Freeを確認済み |
| [03] | OrcaRouter実解析と失敗制御 | 完了 | なし | 変更時に正常・拒否ケースを回帰確認 | [02] | `src/lib/workerClient.ts`, `worker/**`, `src/domain/intakeProfile.ts` | 実構造化応答成功、旧payload 400、raw動画/音声415を確認済み |
| [04] | 入力保存・PII境界・媒体一時処理 | 完了 | なし | 公開匿名書込みと無料枠使用量を監視 | [01], [03] | `src/pages/OwnerForm.tsx`, `src/data/intakeRepository.ts`, `src/data/firestoreIntakeRepository.ts`, `worker/index.ts`, `firestore.rules` | AI分析を含む受付保存、非PIIプロフィール保存/read-back、OwnerIntake localStorage key nullを確認済み |
| [05] | 全ペア実採点と部屋割り最適化の実接続 | 完了 | なし | ペット数増加時の回帰確認 | [01], [04] | `src/domain/**`, `src/pages/**`, `src/data/firestorePetRepository.ts`, `src/data/firestoreOperationRepository.ts` | 2頭の全1ペア、1部屋最適化、観測再計算、最終確定を確認済み |
| [06] | README・TASKS・設計書・図を確定要件と実装事実へ同期 | 完了 | なし | 実装・配備変更時に更新 | [01]-[05] | `README.md`, `TASKS.md`, `docs/ペットホテル自律AIエージェント_設計書_v4.md`, `docs/実装設計書_Firebase版.md`, `docs/ER図.md`, `docs/アーキテクチャ図.md`, `docs/HACKATHON_CHARTER.md` | 旧表現の横断検索、相対リンク、Mermaid fence、`git diff --check` |

## 現在のコードから確認したこと

- `src/pages/OwnerForm.tsx` は飼い主名・連絡先・ペット情報と写真/動画を受け取る。
- `src/App.tsx` はWorker解析を先に実行し、分析結果・性格パラメータを含む受付をFirestoreへcreateする。その後プロフィールを保存してFirestoreからread-backし、全ペア採点・最適化を保存する。Firebase有効時のOwnerIntakeをlocalStorageへミラーしない。
- `src/lib/workerClient.ts` は性格・遊び方・注意事項だけでpayloadを作り、写真と、動画からブラウザ内で最大2枚抽出したJPEGフレームを `/api/analyze` へ送る。元動画と動画内音声は送らない。
- 配備済みWorkerは3項目以外のprofile keyと旧`prompt`を拒否する。画像は最大3件、raw動画・音声は拒否し、`/api/media` は410で永続保存を拒否する。
- Firebase未設定・Firestore失敗・Worker失敗は明示エラーとなり、localStorageや固定値の成功動線に切り替えない。
- 公開E2EでFirebase Hosting / Rules、Firestore read-back、UIから観測再計算・確定までを確認済み。console error/warn 0、390 × 844のモバイル表示も成功した。

## タスク状態の意味

- **進行中**: この台帳・文書の更新作業中。
- **実装済み**: コードが存在すること。外部接続・配備完了を意味しない。
- **検証済み**: 明記された検証だけを実行済み。
- **配備済み**: 指定サービス上の実配備と疎通が証拠で確認済み。

## 全体の受入ゲート

1. [x] Firebase SparkへHosting / Rulesを配備し、Firestore read-backで永続化を確認。
2. [x] Cloudflare Workers Freeへの配備、Worker health、実OrcaRouter構造化応答を確認。
3. [x] 再発行したOrcaRouter SecretをWorker Secretとして参照し、Secret値を露出しない。
4. [x] 許可payload、画像のみの媒体経路、旧payload/raw動画/音声の拒否を確認。
5. [x] AI分析を含む受付を保存し、AI由来性格パラメータを含む非PIIプロフィールをFirebaseからread-back。
6. [x] 全ペア採点後の部屋最適化、観測再計算、施設オペレーター確定を公開E2Eで確認。
7. [x] 自動テストでAI失敗時の明示エラーとno fallbackを確認。
8. [x] Firebase SparkとCloudflare Workers Freeだけで構成されることを確認。

最終検証はアプリ34/34、Worker 15/15、typecheck、build、`qa-preflight` が成功。公開画面のブラウザfetch `Illegal invocation` はcommit `9078b51` で修正済み。

公開Rulesは認証を省いたハッカソン限定構成である。第三者による匿名書込みと無料枠消費のリスクがあるため、本番運用へ流用しない。
