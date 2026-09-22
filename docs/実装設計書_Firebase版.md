# Firebase版 実装設計書

更新日: 2026-09-22。基点 `6609e68` と [確定設計書](ペットホテル自律AIエージェント_設計書_v4.md) を対応付ける。
ここでいう基点コード、既存検証記録、今回の追加要件を混同しない。新機能の受入状況は [証拠対応表](integration/pawpals-acceptance.md) を参照。

## 1. サービスと責務

| サービス・処理 | 責務 |
|---|---|
| React / TypeScript / Vite | 飼い主フォーム、スタッフ画面、ブラウザ内媒体処理、全ペア採点と部屋最適化 |
| Firebase Hosting（Spark） | React静的アプリの配信 |
| Firebase Auth | 施設メール/パスワードログイン。選択スタッフは施設配下のプロフィール |
| Cloud Firestore（Spark） | 施設・招待・受付・プロフィール・提案・観測の保存。今回、当日対象・部屋設定・監査を拡張 |
| Cloudflare Workers Free | AI秘密鍵を保持し、入力検証後にOrcaRouterへ中継 |
| OrcaRouter | 構造化分析結果を返す。採用モデルを実際の応答・設定に基づいて扱う |

Firestoreは `pawpair-ai-hack-2026` / `asia-northeast1`。Firebase Cloud Functions / Cloud Storage、有料Worker機能を追加しない。課金が必要なら停止する。

## 2. 基点コードの状態

- `src/App.tsx` は施設認証・スタッフ選択、招待発行、施設スコープの読み取り、提案/確定保存、手動観測からの再計算を接続している。
- `src/pages/personalityOptions.ts` の既存6問は5問を `personality`、遊び方を `playStyle` へ文字列化する。今回採用する実モックの選択肢とは差がある。
- `OwnerIntake` は施設・招待ID、飼い主情報、基本犬情報、自由記述、媒体メタデータ、AI分析・5軸を保持する。
- `MatchingSnapshot` は `proposed | confirmed` の2状態。今回の `rejected / superseded`、担当監査、対象日は未統合。
- 計算対象は基点で取得した登録犬、部屋は暫定生成であり、日付付き明示選択・施設別保存への拡張が必要。
- 現Firestore Rulesは施設スコープと招待境界を持つ。旧トップレベルの公開デモcollectionと区別する。
- Workerの基点契約は `personality / playStyle / concerns` と一時画像。今回の構造化入力・7軸は `3048cc6` でbackend実装・検証済み。UI/App統合、実サービスE2E、配備は別途確認する。

## 3. 追加実装の接続順

1. モック由来の健康・社会化・行動6問を構造化入力へ追加し、7軸出力の型を確定する。
2. 保存Repository、AIクライアント/Worker、Rules、validation、同意文を同じ契約へ揃える。既存自由記述と旧データの読み取り互換を検証する。
3. スタッフが施設・対象日・対象犬を明示選択し保存する。施設別部屋設定も保存・読み戻しする。
4. 選択対象だけの全ペア採点後、保存した部屋設定で最適化する。
5. 最新案、旧案のsuperseded化、元案参照、担当と理由の監査を整合させて保存する。
6. 選択中スタッフによる最新案の承認/却下、最新未確定案だけの待ち件数、観測からの再計算を画面へ接続する。
7. 手動観測と将来入力源のadapter契約を分け、カメラIFは型/境界/テストまでに留める。

`App.tsx` は[09]単独所有。型/Rules/データ、UI、App統合を別commitにする。

## 4. 保存・認証境界

[ER図](ER図.md) の基点collectionを維持し、施設UIDと有効な施設・スタッフ契約に従う。招待発行者のstaffIdは施設内非公開メタデータに保持する。招待トークンはURL fragmentで扱い、Firestoreにはハッシュを保存する。招待は期限なし、受付は一度だけ作成可能という既存契約を維持する。

今回の先行確定契約は施設配下の `dailyOperations/{YYYY-MM-DD}`、`settings/rooms`、`operationPlans/{id}`、`operationAudit/{id}`。詳細は[ER図](ER図.md)。型・API契約の受領は実装・配備完了を意味しない。旧proposedの無効化と新案保存が途中失敗した場合や同時承認時の整合性を、Repository/Rules/統合テストで確認する。

### 追加APIの先行確定契約

- `StructuredIntakeAnswers`: モック由来18キー。3自由記述は各1000文字以下、残りはモックの日本語選択肢。新しい `pet.structured` 受付には `consent: {version:'2026-09', accepted:true, acceptedAt:string}` が必須。
- `PersonalityAxes`: extraversion / sociability / neuroticism / trainability / resourceGuarding / assertiveness / resilience、整数0〜100。構造化分析時は必須。`aiAnalysis.personalityAxes` と `matchingProfile.personalityAxes` に同値保存し、`PetProfile.personalityAxes?` へ伝搬。旧5軸互換を保持。
- `OwnerAnalysisInput.structured?` → Worker `profile.structured`。飼い主情報・施設認証情報をAI入力へ混入させない。
- `FirestoreDailyOperationRepository`: getDay / getPlan / getRooms / saveDay / saveRooms / recalculate / decide / listAudit。更新はexpectedRevisionと選択staffIdを受け、transactionと監査を伴う。
- `recalculate` はexpectedRoomsRevisionも検証。`decide` は最新headと日付・対象revision・部屋revisionの一致案だけをconfirmed/rejectedへ進める。旧日付なし履歴は当日集計しない。
- `ManualObservationRecord`: 既存観測に `source:'manual', staffId, petIds, operationDate` を追加。createManualがsource/scenarioIdをmanualへ固定。listManualを提供。同ID同内容は再送可能、別内容は拒否。スタッフ有効性・対象犬の施設所属を確認する。
- 将来IFは `src/domain/observationIngestion.ts`。cameraはunsupported。手動観測・ingestion境界は `d6431c9`、当日運用・部屋設定・監査は `48e0e02` で実装された。

実装証拠: `origin/feat/pawpals-data-contracts` の `3048cc6`（受付/7軸）、`48e0e02`（当日運用/監査）、`d6431c9`（手動観測/ingestion）。担当報告ではアプリ89件、Worker 18件、typecheck/build、Rules実emulatorが成功。Firestore indexesを追加済み。文書担当はリモート変更範囲を照合したが、テスト自体は再実行していない。公開配備は未実施。

統合branchではbackendが `d12a381` / `3350193` / `373f39e` として取り込まれ、UI `87ad6c0` も共有済み。統合途中の担当報告ではアプリ18ファイル114件とWorker 18件が成功した。Appの旧props接続1件が残ってtypecheckは未完であり、App統合、build、統合E2E、公開配備の完了証拠はまだない。

## 5. AI・媒体・エラー

`GET /health` は状態確認、`POST /api/analyze` は構造化分析。SecretはWorkerだけに保持する。拡張profileと7軸の許可キー、値域、欠損、AI応答の検証を両端で同期し、フォームだけを先行させない。

写真は画像data URL、動画はブラウザ内の25%/75%地点から最大2枚のJPEG（長辺1280px、品質0.82）にする。基点の入力上限は写真5MiB、動画20MiB、合計20MiB、Workerへ最大3画像。原本・音声・飼い主名・連絡先をAIに送らず、request bodyをログ出力しない。媒体原本を保存せず、`/api/media` は410、raw動画/音声は415で拒否する既存境界を維持する。

AI失敗、不正応答、認証/保存/読み戻し失敗、無料枠上限は明示エラー。成功済みの固定結果やローカル代替へ黙って切り替えない。保存しない入力欄、固定のAI説明、架空の観測ログを追加しない。

## 6. 計算・表示・監査

相性スコアは0〜100の既存数値を%表示する。全ペア完了後、定員・最低頭数・全頭配置・hard blockを満たす解を選ぶ。基点の選択基準は同室ペアの `score - 50` 合計、合計スコア、ID順。今回の入力拡張は配点変更を自動的に意味しない。

監査は選択スタッフ、操作日時、操作種別、対象案、理由、元案参照を保存する。最新proposedのみ承認対象・待ち件数とし、旧proposedはsupersededへ遷移する。手動部屋編集と未確定の5分類は追加しない。

## 7. 検証と配備

基点のモック統合検証記録は [対応表](integration/pawpals-mapping.md) を参照。ローカルAuth/Firestore emulatorとAI test doubleのブラウザE2E、および別途テキスト1件の実Worker/OrcaRouter疎通が記録されている。これは新7軸・当日対象・監査の検証ではない。

今回の変更は [受入条件](integration/pawpals-acceptance.md) に実行commit・環境・結果・証拠を揃えてから検証済みへ進める。既存公開サービスがあることだけで最新コードやRulesを配備済みと扱わない。施設認証/招待版、今回追加要件とも公開配備の証拠を別途記録する。
