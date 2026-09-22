# デモ配備手順

この手順は Firebase Spark（無償）と Cloudflare Workers Free を前提とします。Firebase Functions と Firebase Storage は使用しません。

## 現在の配備状態

- Firebase: `pawpair-ai-hack-2026`、Web App設定、Spark、Firestore `asia-northeast1`、Hosting / Rules配備、実read-backを確認済み。Hosting URLは `https://pawpair-ai-hack-2026.web.app`。
- Cloudflare: `pet-hotel-agent-api` をWorkers Freeへ配備済み。URLは `https://pet-hotel-agent-api.nosea41oceanv.workers.dev`。health、OrcaRouter実構造化分析、media storage無効を確認済み。

## 1. Firebaseを再配備する

リポジトリの `.firebaserc` は実Project IDを設定済みです。`.firebaserc.example` などのサンプルで上書きしないでください。

次の手順は初回配備ではなく、更新時の再配備手順です。

1. `.env.local` がない開発環境だけ、`.env.example` を `.env.local` にコピーする。
2. `.env.local` にFirebase公開Web設定4項目と、配備済みWorkerの `VITE_AI_WORKER_URL` を設定する。Secretは書かない。
3. 下記「施設アカウントとスタッフプロフィール」をFirebase Consoleで設定する。
4. Firebase CLIへ本人認証し、対象Projectを確認する。
5. 検証・ビルド後、Firestore RulesとHostingだけを同じリリースで配備する。

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm install
npm run typecheck
npm test
npm run build
npx --yes firebase-tools login
npx --yes firebase-tools projects:list
npx --yes firebase-tools deploy --only firestore:rules,hosting --project pawpair-ai-hack-2026
```

### 施設アカウントとスタッフプロフィール

この設定はFirebase Spark内で完結します。請求先登録、電話番号認証、Cloud Functions、個別スタッフPINは使用しません。

1. Firebase Consoleの「Authentication」→「Sign-in method」で「メール/パスワード」を有効にする。「メールリンク」は不要。
2. 「Authentication」→「Users」で施設用ユーザーを1件追加し、そのUIDを控える。実在スタッフ個人ではなく施設管理のメールアドレスを使用する。
3. Firestore Consoleで `facilities/{UID}` を作成し、`active`（boolean）を `true`、`name`（string）を施設名にする。
4. その施設ドキュメント配下に `staffProfiles` サブコレクションを作り、担当スタッフごとにドキュメントを追加する。ドキュメントIDは英数字・`_`・`-`の80文字以内とし、`active`（boolean）=`true`、`name`（string）=画面表示名、`createdAt`（timestamp）を設定する。
5. 施設アカウントでログインし、担当スタッフ名を選択して招待URLを発行する。発行者IDは施設配下の非公開メタデータへ記録される。

招待URLの生トークンはURL fragmentにだけ置かれ、FirestoreにはSHA-256ハッシュだけを保存します。招待に期限フィールドはありません。同じ招待からの受付は決定的なドキュメントIDを使うため1回だけ作成でき、再登録はRulesで拒否されます。

既存のトップレベル `demoPets` 等は新しい施設スコープから読みません。旧公開Rulesから新Rulesへ切り替える際は、認証設定と施設ドキュメントを先に用意し、新しいフロントエンドとRulesを同じ作業で配備してください。

### ローカル認証・Rules検証

Java 18環境との互換性を固定するため、emulator起動にはFirebase CLI 13.35.1を使用します。

```powershell
npm run test:rules
npm run emulators:start
# 別ターミナルで合成施設・スタッフfixtureを追加（既存データのresetや削除はしない）
npm run emulators:seed
```

UI E2Eでは `VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099`、`VITE_FIRESTORE_EMULATOR_URL=http://127.0.0.1:8189`、Project ID `demo-pawpair` を使用します。これらのemulator変数は配備ビルドには設定しません。

ブラウザ認証だけで完了扱いにせず、`projects:list` で `pawpair-ai-hack-2026` が見えることを確認してから配備します。`firebase.json` は `dist` をFirebase Hostingへ公開し、すべての画面URLを `index.html` へ戻します。Firestoreには `firestore.rules` だけを配備し、Functions / Storageを追加しません。

## 2. Cloudflare Worker / OrcaRouter

現行Workerは配備済みです。再配備する場合だけ、次を実施します。

1. 以前チャットへ貼ったAPIキーは失効させ、新しいOrcaRouter APIキーを発行する。
2. APIキーはフロントエンドや `.env.local` へ置かず、Worker Secretとして登録する。
3. `wrangler.toml` のWorker名が `pet-hotel-agent-api`、Workers Free、R2/KV/D1/Queuesなしであることを確認する。
4. `worker/README.md` に従ってWorkerを配備する。
5. 配備URLをフロントエンドの `VITE_AI_WORKER_URL` に設定し、再ビルド・Firebaseへ再配備する。

```powershell
npx --yes wrangler whoami
npx --yes wrangler deploy
Invoke-RestMethod https://pet-hotel-agent-api.nosea41oceanv.workers.dev/health
```

外部送信の対象は、性格、遊び方、注意事項と、任意の写真・動画由来JPEGフレームに限定します。動画はブラウザで25%・75%地点から最大2枚のJPEGフレームに変換し、元動画と動画内音声は送信しません。飼い主名・連絡先・音声・request bodyは送信・ログ出力しません。Workerは3項目以外のprofile key、旧`prompt`、raw動画、音声を拒否します。

## 3. デモ確認

1. 飼い主フォームから1頭登録する。
2. スタッフ画面に登録したペットが表示されることを確認する。
3. 対象頭数の全ペア相性スコアと部屋割当が再計算されることを確認する。
4. 配置を確定し、観測デモから再計算する。
5. Firebase Consoleで `demoIntakes`、`demoPets`、`demoMatchingSnapshots`、`demoObservations` の追加を確認する。

2026-09-22に、架空2頭の登録、Worker / OrcaRouter実分析、Firestore受付保存、非PIIプロフィール保存/read-back、全1ペア採点、1部屋最適化、当日観測保存と再計算、施設オペレーター最終確定まで成功しました。ブラウザconsole error/warnは0件、OwnerIntakeのlocalStorage keyはnull、390 × 844のモバイル表示も成功しています。再配備時は同じ手順を回帰確認します。

## 無償枠を守る運用

- Firestoreのリアルタイム購読はデモ画面を開いている間だけにする。
- 提案・確定・観測の取得は新しい順で最大25件に制限する。
- 写真・動画はFirebase Storageへ保存しない。
- Firebase Functionsは作成しない。
- Firebase Consoleの使用量画面をデモ前後に確認する。
- 公開Rulesは認証を省いたハッカソン限定構成であり、匿名第三者の書込みによる無料枠消費リスクがある。デモ後は配備停止またはRules閉鎖を検討し、本番運用へ流用しない。
