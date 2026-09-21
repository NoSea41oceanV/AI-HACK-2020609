# PAWPAIR 実装タスク台帳

最終更新: 2026-09-22（JST）

## 最重要の保留事項・確定した送信範囲

- **外部送信範囲**: ユーザー許可済みなのは性格・遊び方・注意事項・写真・動画のみ。飼い主名・連絡先・音声はWorkerリクエスト、OrcaRouter送信、ログのいずれにも含めない。リクエスト本文をログ出力しない。
- **Firebase設定・接続**: Project ID `pawpair-ai-hack-2026`、Firestore `asia-northeast1`、Sparkプランは確認済み。Firebase Web App config、実Firestore read-back、Hosting配備は未確認。
- **Cloudflare Worker接続**: Freeプランで `pet-hotel-agent-api` が作成され、新規 `ORCAROUTER_API_KEY` Secret がDashboard上で暗号化登録されたとの報告あり。現在のリポジトリコードの配備、Secret参照、実HTTP/OrcaRouter応答は未確認。
- **外部AI送信承認**: 飼い主が入力した性格文と選択写真・動画をOrcaRouterへ送る処理の明示承認が必要。飼い主名・連絡先・音声は送らない。
- **料金境界**: FirebaseはSparkのみ。CloudflareもWorkers Freeのみ。上位プラン、課金移行、従量課金機能は採用しない。

## 確定要件と完了の定義

- デモ用サンプルは入力データだけ。フォーム保存、Worker呼出、AI解析、分析結果保存、全ペア採点、部屋割り最適化は本物の処理にする。
- フローは飼い主フォーム → Firebase実保存 → Cloudflare Worker実リクエスト → OrcaRouterによる文章・写真・動画の実解析 → 性格パラメータの実保存 → 全ペア実採点 → 部屋最適化。
- 飼い主名・連絡先・音声は外部AIへ送信しない。画像・動画は解析処理の完了後に永続保存しない。分析結果と性格パラメータは保存する。
- AI/Workerが失敗したときは明示的なエラー状態にする。固定結果、擬似成功、黙ったローカルAI代替は認めない。AIなしの独立した操作を提供する場合は、AI失敗を隠さず区別する。
- 単一利用者、固定URL、音声なし。全ペアの採点完了後に部屋割り最適化を行う。
- 実配備と実E2Eが終わるまでは配備済み・統合完了としない。コードや単体テストの存在を実接続の証拠にしない。

## 作業タスク

Codexのworktree準備中client IDは統括タスク側で管理する。ここでは個別client IDを推測・転記しない。

| ID | 目的 | 状態 | 保留理由 / 必要なユーザー回答 | 次の一手 | 依存 | 主な担当ファイル | 検証方法 |
|---|---|---|---|---|---|---|---|
| [01] | Firebase Spark実保存と固定URL配備 | worktree準備中 | Project ID `pawpair-ai-hack-2026`、Firestore `asia-northeast1`、Sparkは確認済み。Web App configと実配備権限は未確認 | Firebase Web App configを安全な設定経路で登録し、Spark限定でFirestore/Hostingを接続 | なし | `src/lib/firebase.ts`, `src/data/firestore*`, `firestore.rules`, `firebase.json`, `docs/DEPLOYMENT.md` | Firestore実保存のread-back、Rules確認、Sparkプラン確認、Hosting URLの実配備確認 |
| [02] | Cloudflare Workers Freeへ実配備 | worktree準備中 | Worker `pet-hotel-agent-api` と暗号化済み新Secretの作成報告あり。現行コード配備・実接続は未確認 | 現行WorkerソースをFree Workerへ配備しhealthと実HTTPを確認 | Firebase側CORS設定 | `worker/**`, `wrangler.toml.example`, `docs/DEPLOYMENT.md` | Worker URLへの実HTTP、ログにPII/secretがないこと、Workers Free利用 |
| [03] | OrcaRouter実解析と失敗制御 | worktree準備中 | 許可されたデータ範囲は明示済み。新Secret登録報告あり。旧貼付キーは禁止。実応答は未確認 | デプロイWorkerのSecret参照とOrcaRouter実解析を確認 | [02] | `src/lib/workerClient.ts`, `worker/**`, `src/domain/intakeProfile.ts` | 実解析リクエスト/応答、AI失敗時の明示エラー、PII/音声/本文ログ非含有を確認 |
| [04] | 入力保存・PII境界・媒体一時処理 | worktree準備中 | Firebase設定は[01]。送信範囲は上記の限定許可に従う | 飼い主情報はFirebaseへ保存しAI送信payloadから除外、画像/動画は解析後に破棄、解析結果は保存 | [01], [03] | `src/pages/OwnerForm.tsx`, `src/data/intakeRepository.ts`, `src/data/firestoreIntakeRepository.ts`, `worker/index.ts`, `firestore.rules` | Firebase read-back、AI payload検査、媒体の保存/削除確認、分析結果の永続化確認 |
| [05] | 全ペア実採点と部屋割り最適化の実接続 | worktree準備中 | 結果を使うFirestore実データ接続は[01][04] | 保存された性格パラメータから全組合せを採点し、全件終了後に最適配置を保存・表示 | [01], [04] | `src/domain/**`, `src/pages/**`, `src/data/firestorePetRepository.ts`, `src/data/firestoreOperationRepository.ts` | n(n-1)/2全ペア、採点完了後に最適化、制約/解なし結果を検証 |
| [06] | README・TASKS・設計書・図を確定要件と実装事実へ同期 | 完了 | 実配備・実E2Eの証跡は未入手 | 統括側でレビューし、実装・配備証跡に応じて状態を更新 | [01]-[05]の現状を読取確認 | `README.md`, `TASKS.md`, `docs/ペットホテル自律AIエージェント_設計書_v4.md`, `docs/実装設計書_Firebase版.md`, `docs/ER図.md`, `docs/アーキテクチャ図.md`, `docs/HACKATHON_CHARTER.md` | 旧表現の横断検索、相対リンク、Mermaid fence、`git diff --check` |

## 現在のコードから確認したこと

- `src/pages/OwnerForm.tsx` は飼い主名・連絡先・ペット情報と写真/動画を受け取る。
- `src/App.tsx` はOwnerFormからAI解析を先に実行し、分析結果・性格パラメータを含む受付をFirestoreへ保存する。その後プロフィールを保存してFirestoreから読戻し、全ペア採点・最適化を保存する。実Firebase接続は未確認。
- `src/lib/workerClient.ts` と `worker/index.ts` はフォームの性格・遊び方・注意事項と画像・動画を `/api/analyze` へ送る経路、入力/応答検証を実装している。実OrcaRouterリクエストは未確認。
- 現Workerコードの `/api/media` は410で永続保存を拒否し、分析へdata URLを直接渡す。実配備先にもこのバージョンが反映済みかは未確認。
- Firebase/Workerが未設定ならアプリはエラー表示し、localStorageの成功動線に切り替えない。domain層にはローカル推定関数が残るが、フォーム送信ではWorker解析結果を必須にする。
- WorkerとSecretの作成、Firebase Project ID/リージョン/Sparkの報告はあるが、現行ソースの実配備、Firebase Web config/read-back、実OrcaRouter応答、実E2Eの証跡はこの作業開始時点では確認できない。

## タスク状態の意味

- **worktree準備中**: 作業タスクの隔離環境が準備中。実装着手・完了を意味しない。
- **進行中**: この台帳・文書の更新作業中。
- **実装済み**: コードが存在すること。外部接続・配備完了を意味しない。
- **検証済み**: 明記された検証だけを実行済み。
- **配備済み**: 指定サービス上の実配備と疎通が証拠で確認済み。

## 全体の受入ゲート

1. Firebase Spark上に実保存し、read-backで永続化を確認する。
2. Cloudflare Workers Freeへ実配備し、Worker実リクエストを確認する。
3. 再発行したOrcaRouter SecretをWorker Secretとして使い、実解析結果を得る。
4. テキスト・写真・動画が解析され、名前・連絡先・音声がAIへ送られず、媒体が解析後に残らないことを確認する。
5. 性格パラメータ/分析結果をFirebaseから再読込できることを確認する。
6. 全ペアを実採点してから部屋最適化が走る実E2Eを確認する。
7. AI失敗時に明示エラーとなり、擬似結果・固定結果・ローカルAI代替へ成功扱いで切り替わらないことを確認する。
8. 使用サービスがFirebase SparkとCloudflare Workers Freeに限られることを確認する。
