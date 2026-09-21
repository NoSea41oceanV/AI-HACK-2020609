# PAWPAIR 実装タスク台帳

最終更新: 2026-09-22（JST）

## 最重要の保留事項

- **外部送信承認**: 飼い主が入力した性格文と選択写真・動画をOrcaRouterへ送る処理の有効化は、明示承認を得るまで保留。飼い主名・連絡先・音声はOrcaRouterへ送らない。
- **Firebase Web config / Project ID**: 実Firestore保存とHosting配備に必要。値が渡されておらず、実接続・実配備は未確認。
- **Cloudflareログイン**: Worker配備・実リクエストに必要。ログイン状態と配備先は未確認。
- **新OrcaRouter Secret**: 以前チャットに貼られたキーは使用禁止。再発行キーがWorker Secretに登録されたことを確認するまでAI実接続は未完了。
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
| [01] | Firebase Spark実保存と固定URL配備 | worktree準備中 | Firebase Web config、Project ID、実配備の実施時期 | Firebase値を安全な設定経路で受領後、Spark限定でFirestore/Hostingを接続 | なし | `src/lib/firebase.ts`, `src/data/firestore*`, `firestore.rules`, `firebase.json`, `docs/DEPLOYMENT.md` | Firestore実保存のread-back、Rules確認、Sparkプラン確認、Hosting URLの実配備確認 |
| [02] | Cloudflare Workers Freeへ実配備 | worktree準備中 | Cloudflareログイン/対象アカウント確認 | FreeプランのWorkerを配備しhealthと認可された実リクエストを確認 | [01]のURL/CORS設定 | `worker/**`, `wrangler.toml.example`, `docs/DEPLOYMENT.md` | Worker URLへの実HTTP、ログにPII/secretがないこと、Workers Free利用 |
| [03] | OrcaRouter実解析と失敗制御 | worktree準備中 | 明示的な外部送信承認、新規発行Secret。旧貼付キーは禁止 | SecretをWorkerにのみ設定し、文章・画像・動画の実解析と失敗表示を実装 | [02] | `src/lib/workerClient.ts`, `worker/**`, `src/domain/intakeProfile.ts` | 実解析リクエスト/応答の確認、AI失敗でエラーとなり代替成功しないこと |
| [04] | 入力保存・PII境界・媒体一時処理 | worktree準備中 | Firebase設定は[01]。外部AI送信承認は[03] | 飼い主情報はFirebaseへ保存しAI送信payloadから除外、画像/動画は解析後に破棄、解析結果は保存 | [01], [03] | `src/pages/OwnerForm.tsx`, `src/data/intakeRepository.ts`, `src/data/firestoreIntakeRepository.ts`, `worker/index.ts`, `firestore.rules` | Firebase read-back、AI payload検査、媒体の保存/削除確認、分析結果の永続化確認 |
| [05] | 全ペア実採点と部屋割り最適化の実接続 | worktree準備中 | 結果を使うFirestore実データ接続は[01][04] | 保存された性格パラメータから全組合せを採点し、全件終了後に最適配置を保存・表示 | [01], [04] | `src/domain/**`, `src/pages/**`, `src/data/firestorePetRepository.ts`, `src/data/firestoreOperationRepository.ts` | n(n-1)/2全ペア、採点完了後に最適化、制約/解なし結果を検証 |
| [06] | README・TASKS・設計書・図を確定要件と実装事実へ同期 | 進行中 | 実配備・実E2Eの結果は未入手。配備や外部接続をこの担当で代行しない | 文書差分・リンク・Mermaid・旧矛盾語・git diffを確認し、文書だけをコミット | [01]-[05]の現状を読取確認 | `README.md`, `TASKS.md`, `docs/ペットホテル自律AIエージェント_設計書_v4.md`, `docs/実装設計書_Firebase版.md`, `docs/ER図.md`, `docs/アーキテクチャ図.md`, `docs/HACKATHON_CHARTER.md` | 旧表現の横断検索、相対リンク、Mermaid fence、`git diff --check` |

## 現在のコードから確認したこと

- `src/pages/OwnerForm.tsx` は飼い主名・連絡先・ペット情報と写真/動画を受け取る。
- `src/data/index.ts` はFirebase設定時、受付をlocalStorage保存後にFirestoreへcreateする。これは「localStorageのみ」「create-onlyで読めない」という旧設計と異なるが、実Firebase設定でのread-backは未確認。
- `src/lib/workerClient.ts` と `worker/index.ts` にWorker契約、分析・メディアAPI、応答検証がある。ただしOwnerFormからの呼出しは確認できず、OrcaRouterへの実リクエストも未確認。
- WorkerにはR2へ画像・動画を保存するAPIがある。確定要件の「解析後に永続保存しない」に合わないため、削除/一時処理へ改める必要がある。
- `src/domain/intakeProfile.ts` はキーワード規則によるローカル性格値生成を持つ。これをAI失敗時の成功代替に使わない。
- 実配備済みWorker、Firebaseプロジェクト、実OrcaRouter応答、実E2Eの証跡はこの作業開始時点では確認できない。

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
