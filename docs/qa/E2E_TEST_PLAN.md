# PAWPAIR E2E・安全性検証計画

## 目的と合格条件

配備済みの本番相当デモで、サンプル入力が `UI → Cloudflare Worker → OrcaRouter実応答 → Firestore構造化保存 → 全ペア計算 → 部屋割り → 確定` まで一貫して反映されることを、画面・Network・Firestoreの証跡で確認する。モック応答、AI失敗時のローカル推定、偽の成功表示は合格証拠にしない。

同時に次を満たすことを確認する。

- 飼い主名、連絡先、住所、音声をWorker・OrcaRouterへ送らない。
- 公開クライアントから `demoIntakes` を読めない。
- APIキー、Bearer値、秘密鍵をソース、ログ、Network応答、成果物へ残さない。
- Firebase SparkのHosting / FirestoreとCloudflare Workers Freeだけを使い、Functions、Storage、R2を使わない。
- 390px幅のmobileと1280px幅のdesktopで主要画面が利用できる。

## 必要環境

- Node.js 22.6以上、npm、Git
- Firebase Sparkプロジェクト（Hosting、Cloud Firestore、配備済みRules）
- Cloudflare Workers Freeの配備URL。OrcaRouterキーはWorker Secretだけに登録済みであること
- OrcaRouterの実応答を許可した検証用アカウント
- `QA_APP_URL`: 配備済みアプリのHTTPS URL
- `QA_WORKER_URL`: 配備済みWorkerのHTTPS URL（キーやquery tokenを含めない）
- 検証専用の架空データ。実在人物の氏名・連絡先・住所・医療情報は禁止
- 任意の写真・動画fixtureは、権利処理済みかつ人物・音声・位置情報を含まない検証専用品

実サービスへの配備、プラン変更、課金設定、Secret登録はこの手順では行わない。実行前に担当者が配備状態と外部送信承認を確認する。

## 実行コマンド

静的・ローカルpreflight（既存のdirty worktree自体は失敗にしない）:

```powershell
node scripts/qa-preflight.mjs
```

このスクリプトはtypecheck、application test、build、worker test、`git diff --check`、秘密情報候補、Firebase / Cloudflare構成を順番に確認する。検出した秘密値自体は表示しない。R2 bindingは警告にし、受入条件との確認を必須にする。

非PIIテキストだけの実ネットワークprobe:

```powershell
$env:QA_APP_URL = "https://<hosting-host>"
$env:QA_WORKER_URL = "https://<worker-host>"
node e2e/live-pipeline.mjs
```

環境変数が不足する場合は非破壊でスキップし、終了コード2を返す。ローカル配備を試す場合だけ `QA_ALLOW_HTTP_LOCALHOST=true` を指定できる。

画像・動画を送る場合は、外部送信の明示承認後にfixtureを明示し、さらに送信フラグを設定する。fixture指定だけでは送信しない。

```powershell
$env:QA_PHOTO_FIXTURE = "C:\qa-fixtures\dog-no-person-no-exif.jpg"
$env:QA_VIDEO_FIXTURE = "C:\qa-fixtures\dog-silent-short.mp4"
$env:QA_SEND_MEDIA = "true"
node e2e/live-pipeline.mjs
```

## 実E2E手順と残す証跡

1. ブラウザのNetworkログを保存開始し、飼い主フォームへ架空の飼い主情報と非PIIの行動文を入力する。画像・動画は承認済みfixtureだけを選ぶ。音声トラックを含む動画は使用しない。
2. 送信時のWorker request bodyを確認し、`prompt` と承認済みmedia以外に飼い主名、連絡先、住所、音声がないことを記録する。`Authorization` やOrcaRouterキーがブラウザ側にないことも確認する。
3. Workerの実応答で `ok=true`、`model`、`analysis`、`matchingProfile`、`requestId` を確認する。`e2e/live-pipeline.mjs` の構造検証も成功させる。応答本文は個人情報や秘密値を含まない範囲だけ保存する。
4. Firebaseコンソールで新規 `demoIntakes` を確認し、同じ `requestId` またはテスト用相関ID、AI分析、matching profile、`status=ready` が保存されていることを記録する。管理画面スクリーンショットにはプロジェクトIDやPIIを写さない。
5. スタッフ画面で対象ペットが追加され、ペット数 `n` に対してペア結果が `n(n-1)/2` 件あることを確認する。同室禁止を含む全ペアの記録と提案snapshot IDを保存する。
6. 部屋定員・全頭配置・同室禁止を確認し、AI由来matching profileがペア得点と部屋割りへ反映されたことを、入力値、該当ペア結果、部屋の3点で追跡する。
7. 「この部屋割りで確定」を実行し、画面の確定表示とFirestoreの `status=confirmed` を同じsnapshot IDで確認する。再読込後も確定状態が保持されることを確認する。
8. 証跡一覧にUTC/JST時刻、Hosting URLのhost部分、Worker host、request ID、intake ID、snapshot ID、ペア件数、結果、スクリーンショット名を記録する。Secret、完全なProject ID、飼い主情報は記録しない。

## AI失敗時のno fallback検証

OrcaRouter障害を再現できる検証環境で、Workerが401/429/5xxまたは不正構造応答を受ける条件を作る。UIが明示的な失敗・再試行を表示し、Firestoreに `ready`、matching profile、成功snapshotを新規保存しないことを確認する。ローカル推定値、固定デモ値、前回成功値で処理を継続した場合は不合格とする。Worker Secretを削除・変更する操作は本手順から行わず、環境管理者が用意した失敗用Workerを使う。

## Firestore Rules否定テスト

Firebase Emulatorまたは検証専用Sparkプロジェクトから、未認証クライアント相当で次を実行する。

- `demoIntakes/{id}` のcreateはschema準拠時だけ成功する。
- `get`、`list`、`update`、`delete` はすべてpermission deniedになる。
- `demoPets` やsnapshotへowner、contact、email、phone等の余分なキーを含むwriteは拒否される。
- snapshot / observationの無制限list、update、deleteは拒否される。

Rulesの静的確認だけでは十分でない。SDKまたはRules unit testing環境による否定テスト結果を証跡として保存する。

## 無償枠・秘密情報・PII監査

- Firebase BillingがSparkであること、配備対象が `firestore:rules,hosting` だけであることをコンソールと設定で確認する。
- Cloudflare WorkerのusageがWorkers Free制限内であることを確認する。実配備設定にR2 binding、R2 bucket、KV、D1、Queues等がこのデモWorkerにないことを確認する。`wrangler.toml.example` は参考設定として警告対象だが、実配備の `wrangler.toml` にR2 bindingがあれば不合格とする。
- DevTools Networkでブラウザからの送信先を列挙し、Hosting、Firestore、対象Worker以外がないことを確認する。OrcaRouterへの直接通信は不合格。
- Workerログはstatus、request ID、イベント名だけで、prompt、media、飼い主情報、Authorization値がないことを確認する。
- `node scripts/qa-preflight.mjs` のsecret scanを通し、追加で配備成果物を検索する。値を画面・報告書へコピーしない。

## Visual QA

同じテストデータで以下を確認し、viewport全体と重要状態のスクリーンショットを残す。

| viewport | 対象 | 確認項目 |
| --- | --- | --- |
| mobile 390 × 844 | 飼い主フォーム、送信中、AI失敗、成功 | 横スクロールなし、ラベル可読、選択fixture明示、ボタン操作可能、エラーが隠れない |
| desktop 1280 × 800 | スタッフ一覧、全ペア結果、部屋割り、確定 | 表・カード欠けなし、全頭追跡可能、禁止理由・score可読、確定状態明示 |

キーボードだけで主要操作ができ、フォーカス表示、フォームラベル、エラー通知が認識できることも確認する。

## 未統合時のブロッカー判定

次のいずれかがある場合、実E2Eを成功扱いにせず「依存未統合」と報告する。

- UIがWorkerを呼ばない、またはAI失敗後にローカル変換で登録を続ける。
- AI分析またはmatching profileがFirestoreに保存されない。
- 全ペア結果とAI入力値を対応付けられない、確定snapshotが永続化されない。
- Firebase / Workerの配備URL、ログイン、OrcaRouter Secret登録済み環境、外部送信承認がない。
- Rules否定テスト環境がない。
- R2 bindingが残る、またはFirebase Functions / Storageを使用する。

ブロッカー時もpreflight、構造probe、秘密情報監査、Visual QA可能範囲は実施し、未実施項目と理由を分けて記録する。
