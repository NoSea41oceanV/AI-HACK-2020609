# Firebase版 実装設計書

> 目標仕様と2026-09-22時点の確認済み状態を記す。Cloudflare Worker / OrcaRouterの実疎通は確認済みだが、Firebase Hosting / Rules配備、実Firestore read-back、全体E2Eは未確認である。コード実装と外部稼働を混同しない。

## 1. 採用構成

| 責務 | 技術・制約 |
|---|---|
| UI | React / TypeScript / Vite |
| 受付・結果保存 | Firebase Cloud Firestore（Spark） |
| 静的配信 | Firebase Hosting（Spark） |
| AI秘密鍵プロキシ | Cloudflare Workers Free |
| AI | OrcaRouter。SecretはWorkerに保持 |
| 画像・動画 | 写真と動画由来JPEGフレームだけを一時解析。原本を永続保存しない |
| 相性・最適化 | TypeScript決定ロジック。全ペア採点後に最適化 |
| 利用者 | 単一利用者、固定URL |

Firebase Project IDは `pawpair-ai-hack-2026`、Web App設定、Firestoreリージョン `asia-northeast1`、Sparkプランまで設定済みである。Firebase CLI本人認証、実データのread-back、Hosting / Rules配備は未確認。

Firebase Cloud Functions、Firebase Cloud Storage、Workers Paidを使わない。

## 2. 現状コードと差分

- Repositoryには開発用localStorage実装もあるが、AppはFirebase未設定時にエラー表示し、成功扱いでlocalStorageへ切り替えない。Firebase有効時のOwnerIntakeをlocalStorageへミラーしない。
- AppはOwnerFormからWorker解析を実行し、構造化分析結果を含む受付をFirestoreへcreateする。その後Profileを保存・読戻ししてから全ペア採点・最適化を保存する。実Firebase read-backは未確認。
- `AIWorkerClient` とWorker `/api/analyze` はフォーム送信動線へ接続済み。payloadは性格・遊び方・注意事項の3項目と画像だけで、その他のprofile keyを作らない。
- 写真は画像data URLとして送る。動画はブラウザで25%・75%地点から最大2枚、長辺1280px、JPEG品質0.82の静止画を抽出し、元動画と動画内音声はWorkerへ送らない。
- WorkerはWorkers Freeへ配備済みで、health、Secret参照、media storage無効、OrcaRouter実構造化分析を確認済み。旧`prompt`は400、raw動画・音声は415で拒否する。
- `/api/media` は410を返して永続保存を拒否し、受付にはメディアのファイル名・種類・サイズだけを保存する。
- OwnerIntakeはFirestore create-onlyであるため、Worker解析完了後にAI結果を含む1レコードを一度だけcreateする。
- 写真5MiB、動画20MiB、合計20MiBのフォーム入力制限を適用する。Workerへ届くのは1枚の写真と最大2枚の動画フレームを合わせた最大3画像である。

## 3. 登録・解析フロー

1. 固定URLから飼い主フォームを送信する。
2. AI入力を性格・遊び方・注意事項だけから組み立てる。`owner.name` と `owner.contact` はpayloadに含めない。
3. 写真を画像として、動画をブラウザ内で最大2枚のJPEGフレームへ変換してWorkerへ送り、OrcaRouterで解析する。元動画・音声は送らない。
4. タイムアウト、4xx/5xx、不正応答、無料枠超過はエラー状態として表示する。キーワード判定、固定結果、擬似AI応答へ切り替えない。
5. 構造化応答を検証し、受付情報、性格パラメータ、根拠/信頼度を1件のOwnerIntakeとしてFirestoreへcreateする。バイナリは保存しない。
6. 非PIIのPetProfileを保存してread-backする。保存またはread-backが失敗したら後続処理を成功扱いにしない。
7. 一時媒体を破棄し、永続メディア領域・ログ・URL queryへ残さない。
8. 全対象ペットの確定後、n(n-1)/2の全ペアを採点する。
9. 全ペア結果を保持した後に最適配置を計算し、提案を保存する。
10. オペレーターが提案を確認して確定する。

## 4. Firestoreデータ

コレクション案は [ER図](ER図.md) を参照する。最低限、受付、非PIIのペットプロフィール、AI分析結果、全ペア結果と部屋案を区別する。受付の名前・連絡先はFirestore内だけに保持し、AI入力payloadやWorkerへ渡してはならない。公開Rulesは認証を省いたハッカソン限定構成で、匿名第三者の書込みによる無料枠消費リスクがある。本番用の安全なアクセス境界とは見なさない。

分析結果を保存する場合は受付との参照ID、モデル識別子、分析日時、構造化profile、根拠・confidence、エラー状態を記録する。写真/動画バイナリ、署名URL、取得可能な長期メディアURLは保存しない。

## 5. AI Worker契約

| API | 目的 | 入出力境界 |
|---|---|---|
| `GET /health` | Workerの状態確認 | Secret値を返さない |
| `POST /api/analyze` | 3項目のprofileと一時画像をOrcaRouterへ送り、構造化分析を返す | 飼い主名・連絡先・元動画・音声なし。失敗は明示エラー |

永続R2へのmedia upload APIは本要件では使用しない。現コードは写真と動画から抽出したJPEGフレームだけを一時画像data URLで分析リクエストに含め、永続保存APIを無効化している。Workerはraw動画・音声を415で拒否する。完了/失敗/timeout後も媒体が残らないことを実E2Eで確認する。API keyは `ORCAROUTER_API_KEY` SecretとしてWorkerだけに設定し、以前チャットへ貼付したキーは再利用しない。

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

Firebase Project ID `pawpair-ai-hack-2026` / Web App設定 / Firestore `asia-northeast1` / Sparkは設定済み。公開Web設定は `.env.local` に置き、`.env.example` はダミー値のままにする。リポジトリの `.firebaserc` は実Project IDを設定済みなので上書きしない。Firebase CLI本人認証、Hosting / Rules配備、実read-backは未確認である。

Cloudflare Workers Freeの `pet-hotel-agent-api` と、新規 `ORCAROUTER_API_KEY` Secret参照、実OrcaRouter応答は確認済みである。以前チャットに貼られたキーは使用禁止。許可済みの外部送信範囲は性格・遊び方・注意事項と画像に限り、動画はJPEGフレームへ変換する。飼い主名・連絡先・元動画・音声とrequest bodyはログへ出さない。

## 9. 検証・完了条件

- 単体: n(n-1)/2全ペア、禁止条件、定員、解なし、決定性。
- データ: Firebase書込後のread-back、AI結果と性格パラメータのread-back、PII非含有のWorker payload。
- Worker: 実配備先へのhealthとOrcaRouter構造化応答、旧payload/raw動画/音声の拒否は確認済み。失敗時UIとSecret/PII/媒体のログ非含有を統合E2Eで確認する。
- メディア: 解析後に原本、R2オブジェクト、一時URLが残らず、動画から抽出したJPEG以外と動画音声が外部へ送られないこと。
- 統合E2E: フォーム→Worker→OrcaRouter→Firestore結果保存/read-back→全ペア採点→部屋最適化。
- プラン: Firebase Spark、Cloudflare Workers Freeであること。

この文書の更新時点で、Cloudflare Worker / OrcaRouter実疎通は確認済みである。Firebase配備・read-backと、それを含む全体E2Eは未確認であり、実行していない検証を成功として報告しない。
