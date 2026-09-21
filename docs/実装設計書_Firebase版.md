# Firebase版 実装設計書

> 目標仕様を記す。2026-09-22時点ではFirebase/Worker/OrcaRouterの実配備・実E2Eを確認していない。コード実装と外部稼働を混同しない。

## 1. 採用構成

| 責務 | 技術・制約 |
|---|---|
| UI | React / TypeScript / Vite |
| 受付・結果保存 | Firebase Cloud Firestore（Spark） |
| 静的配信 | Firebase Hosting（Spark） |
| AI秘密鍵プロキシ | Cloudflare Workers Free |
| AI | OrcaRouter。SecretはWorkerに保持 |
| 画像・動画 | 解析の一時入力のみ。永続保存しない |
| 相性・最適化 | TypeScript決定ロジック。全ペア採点後に最適化 |
| 利用者 | 単一利用者、固定URL |

Firebase Cloud Functions、Firebase Cloud Storage、Workers Paidを使わない。

## 2. 現状コードと差分

- Firebase未設定時、RepositoryはlocalStorageへ自動切替する。確定要件では本番フローの成功にこの経路を使わない。
- Firebase設定時、受付をlocalStorage保存後にFirestoreへcreateするコードがある。実Firebase保存とread-backは未確認。
- OwnerFormの送信処理はAI Workerを呼ばず、ローカルキーワード変換でPetProfileを作る。確定要件に反するため、AI失敗/未実行時の成功経路として残さない。
- `AIWorkerClient` とWorker `/api/analyze` はあるが、フォームから未接続。実Worker・OrcaRouter応答は未確認。
- `/api/media` はR2へ原本を永続保存する。解析後の媒体破棄要件と衝突し、目標フローでは利用しない。
- OwnerIntakeはFirestore create-onlyで、AI解析後の結果更新ができない。結果を含めて解析後に一度だけcreateするか、AI結果用の明示的な保存モデル/Rulesを追加する。
- 画像/動画のフォーム上限はWorker上限より大きい。統合時に共通制限へ揃える。
- 動画ファイルの拒否はあるが、動画内音声トラックを除去・除外する機構は確認できない。

## 3. 登録・解析フロー

1. 固定URLから飼い主フォームを送信する。
2. 受付情報をFirestoreへ保存し、成功をread-backする。保存が失敗したらエラーを返して後続処理を成功扱いにしない。
3. AI入力を許可フィールドから組み立てる。`owner.name` と `owner.contact` はpayloadに含めない。
4. 写真/動画は一時的にWorkerへ送り、OrcaRouterで解析する。音声ファイル・動画音声は送らない。
5. タイムアウト、4xx/5xx、不正応答、無料枠超過はエラー状態として表示する。キーワード判定、固定結果、擬似AI応答へ切り替えない。
6. 構造化応答を検証し、性格パラメータと根拠/信頼度をFirestoreへ保存する。
7. 一時媒体を破棄し、永続メディア領域・ログ・URL queryへ残さない。
8. 全対象ペットの確定後、n(n-1)/2の全ペアを採点する。
9. 全ペア結果を保存または保持した後に最適配置を計算し、提案を保存する。
10. オペレーターが提案を確認して確定する。

## 4. Firestoreデータ

コレクション案は [ER図](ER図.md) を参照する。最低限、受付、非PIIのペットプロフィール、AI分析結果、全ペア結果と部屋案を区別する。受付の名前・連絡先はFirebase保存要件に従いFirestore内に保持できるが、AI入力payloadやWorkerへ渡してはならない。実際の公開Rules/アクセス境界は配備前に確認する。

分析結果を保存する場合は受付との参照ID、モデル識別子、分析日時、構造化profile、根拠・confidence、エラー状態を記録する。写真/動画バイナリ、署名URL、取得可能な長期メディアURLは保存しない。

## 5. AI Worker契約

| API | 目的 | 入出力境界 |
|---|---|---|
| `GET /health` | Workerの状態確認 | Secret値を返さない |
| `POST /api/analyze` | 文章と一時画像/動画をOrcaRouterへ送り、構造化分析を返す | 飼い主名・連絡先・音声なし。失敗は明示エラー |

永続R2へのmedia upload APIは本要件では使用しない。処理中の一時バッファから解析し、完了/失敗/timeout後に破棄する。旧API/実装が残る間は受入完了としない。API keyは `ORCAROUTER_API_KEY` SecretとしてWorkerだけに設定し、以前チャットへ貼付したキーは再利用しない。

## 6. ペア採点と最適化

`calculateAllPairCompatibilities` 相当の決定関数で全ての異なるペアを列挙し、スコアと禁止制約を返す。全件完了前に部屋探索を開始しない。最適化は全ペットを一部屋ずつ配置し、部屋定員とhard blockを満たす解のうち目的関数を最大化する。解なしは理由を返し、危険案や固定案を提示しない。AIは安全制約、スコア、配置を上書きしない。

## 7. 失敗と費用境界

| 失敗 | 動作 |
|---|---|
| Firebase設定なし | 実フローを成功扱いにせず、設定エラーを示す。開発用ローカル画面はAI接続状態と分離して表示 |
| Firebase書込/読戻失敗 | 明示エラー。AI解析や成功表示へ進まない |
| Worker/OrcaRouter失敗・不正応答 | 明示AIエラー。ローカル判定や固定結果を返さない |
| 無料枠上限 | 新規処理を止め、エラーを表示。自動課金/有料化なし |
| 部屋最適化が解なし | 理由を表示。代替の安全でない配置を生成しない |

## 8. 設定・Secret

Firebase Web configとProject IDは実値を `.env.example` 等へ書かず、ローカル環境設定へ登録する。Cloudflare Workers Freeの `pet-hotel-agent-api` 作成と、新規 `ORCAROUTER_API_KEY` Secretの暗号化登録は報告済みだが、現在のWorkerソース配備・Secret参照・実リクエストは未確認。以前チャットに貼られたキーは使用禁止。許可済みの外部送信範囲は性格・遊び方・注意事項・写真・動画に限る。飼い主名・連絡先・音声とrequest bodyはログへ出さない。Firebase設定と実接続確認が済むまで実フローの完了扱いにしない。

## 9. 検証・完了条件

- 単体: n(n-1)/2全ペア、禁止条件、定員、解なし、決定性。
- データ: Firebase書込後のread-back、AI結果と性格パラメータのread-back、PII非含有のWorker payload。
- Worker: 実配備先への実リクエスト、OrcaRouter実応答、失敗時の明示エラー、Secret/PII/媒体がログにないこと。
- メディア: 解析後に原本、R2オブジェクト、一時URLが残らないこと。動画の音声が外部へ送られないこと。
- 統合E2E: フォーム→Firebase→Worker→OrcaRouter→結果保存→全ペア採点→部屋最適化。
- プラン: Firebase Spark、Cloudflare Workers Freeであること。

この文書の更新時点で、実配備・実E2Eは確認されていない。実行していない検証は成功として報告しない。
