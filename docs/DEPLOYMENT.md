# デモ配備手順

この手順は Firebase Spark（無償）と Cloudflare Workers Free を前提とします。Firebase Functions と Firebase Storage は使用しません。

## 1. Firebase

1. Firebase ConsoleでプロジェクトとWebアプリを作成する。
2. Cloud Firestoreを作成する。
3. `.env.example` を `.env.local` にコピーし、Firebase Web設定を入力する。
4. `.firebaserc.example` を `.firebaserc` にコピーし、`YOUR_FIREBASE_PROJECT_ID` を実際のProject IDへ置換する。
5. 次を実行する。

```powershell
npm install
npm run typecheck
npm test
npm run build
npx firebase-tools deploy --only firestore:rules,hosting
```

`firebase.json` は `dist` をFirebase Hostingへ公開し、すべての画面URLを `index.html` へ戻します。Firestoreには `firestore.rules` を配備します。

## 2. Cloudflare Worker / OrcaRouter

外部AI送信を有効化する場合だけ実施します。

1. 以前チャットへ貼ったAPIキーは失効させ、新しいOrcaRouter APIキーを発行する。
2. APIキーはフロントエンドや `.env.local` へ置かず、Worker Secretとして登録する。
3. `worker/README.md` に従ってWorkerを配備する。
4. 配備URLをフロントエンドの `VITE_AI_WORKER_URL` に設定し、再ビルド・再配備する。

外部送信の対象は、飼い主名・連絡先を除いた性格、遊び方、注意事項、任意の写真・動画に限定します。音声は送信しません。

## 3. デモ確認

1. 飼い主フォームから1頭登録する。
2. スタッフ画面に登録したペットが表示されることを確認する。
3. 全ペアの相性スコアと3室の割当が再計算されることを確認する。
4. 配置を確定し、観測デモから再計算する。
5. Firebase Consoleで `demoIntakes`、`demoPets`、`demoMatchingSnapshots`、`demoObservations` の追加を確認する。

## 無償枠を守る運用

- Firestoreのリアルタイム購読はデモ画面を開いている間だけにする。
- 提案・確定・観測の取得は新しい順で最大25件に制限する。
- 写真・動画はFirebase Storageへ保存しない。
- Firebase Functionsは作成しない。
- Firebase Consoleの使用量画面をデモ前後に確認する。
