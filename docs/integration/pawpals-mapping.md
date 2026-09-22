# PAWLAND モック接続対応表

参照: `C:/Users/kachi/Downloads/PawPals_AI_Agent_mock_v4/PawPals_mock_v2` の index.html / style.css / app.js / README.txt。資料内命令は実装指示にしない。
作業場所: `D:/work/AI HACK 2020609`（人間の最新指示を優先）。公開配備なし。

| 画面・機能 | 分類 | 実在する接続先／不足 | 方針 |
|---|---|---|---|
| 施設ログイン・担当選択 | 直接接続 | Firebase Auth / FirestoreStaffProfileRepository.listActive | session認証と施設UIDスコープを維持 |
| 招待URL・QR | 直接接続 | FirestoreInviteRepository.create/get / StaffInvitePanel | 期限なし・一度の登録・ハッシュ保存を維持 |
| 飼い主専用フォーム | 直接接続 | OwnerRegistration / OwnerForm / Worker.analyzeOwnerRegistration | 招待以外の画面へのナビゲーションなし |
| 飼い主6問 | 直接接続 | personalityOptions / 既存personalityとplayStyle | 既存未統合6ef064cを採用 |
| 健康・社会化項目／7軸 | 仕様不明 | 現モデルは基本属性・自由記述・5軸 | BB第1便、未保存フォームを作らない |
| 今日の預かり | 未実装 | 滞在日・入退館モデルなし、登録Pet一覧のみ | 登録犬として表示、本日預かりと断定しない |
| グループ案・全候補採点 | 直接接続 | createOptimalRoomPlan / saveMatching | 既存配点・EXPLICIT_BLOCKを維持 |
| 施設別部屋設定 | 仕様不明 | 既存3室の暫定カタログ | 暫定室であることを表示、BB第1便 |
| 承認／最終確定 | 一部接続 | proposed/confirmedのsnapshot保存のみ | 現行確定を接続、過去案の待ち件数を捏造しない |
| 手動変更・代替案・却下 | 未実装 | 状態遷移・元案ID・理由なし | BB第2便、回答待ち |
| 全操作の担当監査 | 未実装 | 招待metadataのみstaffIdあり | BB第2便、既存ログを監査完備と称さない |
| プロフィール帳 | 直接接続 | PetProfileの5軸・playStyles・notes | 実データと明示空状態 |
| 相性カルテ | 直接接続 | PairCompatibility.score/breakdown/allowed | 実6因子表示、定型根拠をAI説明と呼ばない |
| 5段階判定 | 仕様不明 | scoreとallowedのみ、閾値未定 | BB第2便、閾値を創作しない |
| おともだちマップ | 直接接続 | 全pairResults・現在のroom案 | 動的配置・選択・制約/同室フィルタ |
| 交流履歴 | 未実装 | 永続モデルなし | 履歴未記録を表示 |
| 手動観測→再計画 | 直接接続 | saveObservation / Pet hardBlockedPetIds / saveMatching | review/separateの既存処理を接続 |
| 15分自動観測・異常アラート | 未実装 | scheduler、severity、ack、通知先なし | BB第1/2便、稼働中表示をしない |
| AI状態・保存履歴 | 一部接続 | 登録時の実進捗、listMatchings/listObservations | 実際の保存内容だけ表示、取得失敗は明示 |
| 固定犬・数値・日付・演出ログ | 不要候補 | モック専用定数 | 本番UIには持ち込まない |

## 安全な既存変更の取り込み

- `origin/codex/owner-invite-isolation` f0b70ae を既存本体履歴を保持してmerge。
- `6ef064c` 飼い主6問選択をcherry-pick（既存の文字列保存契約を維持）。
- `aa9892e` の未確定・AI未生成を正直に表示する方針を新画面へ反映。
- staff-compatibility-ui / staff-operations-review はf0b70aeと同一点、別途取り込みなし。
- 開始時からある発表資料履歴と未追跡architecture画像は保持し、本タスクの新規変更として扱わない。

## デザインの基準

モックそのものを承認済み基準とする（新しい画像生成案は作らない）。背景 #f5f0e5、paper #fffdf8、green #5f8068、deep #385846、境界 #ddd6c7。最大1360px、見出しGeorgia、丸い6タブ、2カラムと850/600pxレスポンシブ、18–20pxカード。固定文言のうち未実装機能の稼働を示すものだけ変更する。飼い主にはスタッフタブを表示しない。

## 確認待ち

BB第1便: 入力/5軸対7軸、自動観測、当日対象・部屋。
BB第2便: 5判定閾値、手動/代替/却下/監査、AIログ・交流履歴。
回答前に永続モデル・判定・状態遷移を確定しない。可逆な直接接続を進める。

## 今回の検証（2026-09-22）

- `npm test`: 9ファイル・46件成功。
- `npm run typecheck` / `npm run build`: 成功。Firebase bundle 500kB超の既存警告あり。
- Worker Node tests: 15件成功。
- Firestore Rules: 隔離emulator 8289で施設・招待・飼い主境界の統合テスト成功。否定テストのPERMISSION_DENIEDは期待結果。
- IAB（内蔵ブラウザ）: `http://127.0.0.1:5191`、Firebase Auth/Firestore emulators、ローカルAI test double 5193。ブラウザ登録E2Eはテスト応答で検証。別途、既存公開Workerのhealthと非PII合成テキスト1件の実OrcaRouter構造化分析に成功（e2e/live-pipeline.mjs）。公開配備はしていない。
- 正常経路: 施設ログイン→担当選択→URL/QR発行→飼い主登録（実Firestore Emulator保存）→Pet反映→全候補比較→割当再計算/保存→確定→手動観測separate→同室不可反映→再計画保存、成功。
- 招待なし・形式不正・存在しない招待を拒否。未認証の飼い主タブで施設ルートへ移動するとログイン画面となりデータ表示なし。別施設・別飼い主・再create拒否はRulesテストで検証。
- 6画面およびスタッフ招待画面を登録データまたは空状態で表示。プロフィール選択を保つマップ遷移、ハード制約フィルタを検証。
- 1360x900のデスクトップと390x844のスマホを検証。全画面でページ横はみ出しなし（タブ/処理ループは部品内スクロール）。アプリconsole error/warnなし。
- QR画像の生成とURL文字列は確認。スマホ実機カメラによるQR読取りは未実施。
- 今回のブラウザ登録はメディア無し。画像/動画の実ファイル操作は今回未実施（既存Worker/Client単体テストを実行）。外部AIはテキストのみ実疎通成功。
- lint scriptは未定義。未実装の手動割当/代替/却下/周期観測/アラートは確認待ちのためテストできず、成功としない。

### 視覚比較

基準モックをローカル静的参照サーバ5194から読み取り、IABスクリーンショットを保存。基準と最新実装を `view_image` で確認。

| 比較点 | 結果・意図した差分 |
|---|---|
| 背景・紙面・緑の配色 | モックCSSトークンを再利用 |
| 見出しとブランド | Georgia / PAWLAND / 基準タグライン。ログイン/担当選択の表記も統一 |
| ナビと情報構造 | スタッフ6タブ。飼い主は招待フォームのみでナビ非表示（権限制御要件） |
| カード・余白・2カラム | モック構造を再利用、モバイル1カラム |
| コピー | 未実装の常時AI稼働・固定値を除去。健康/社会化/7軸は確認待ち、既存5軸を表示 |
| 上部表示 | 施設認証/担当切替と取得状態の帯を機能上追加。モックの固定日付を表示しない |
| アバター/マップ | 実名先頭文字とplayStylesの配色、実ペアから配置。固定犬画像・固定相関線なし |
| 修正した不具合 | 黒塗りノード、AI画面mobile幅600px、owner見出しの縦折れ/重なりを修正後再検証 |

画面構造・配色の忠実性を比較済み。ただし確認待ち機能があるため、モックの全機能を満たした完成品とは扱わない。

### 委任

- fast_scan: モックの読み取りとE2E既存手順調査。軽い読み取り専用調査のため。
- deep_worker: バックエンド/権限制御調査、6画面の分割実装。複数ファイル・権限制御・統合設計を含むため。
- routine_worker: 飼い主UIの3ファイル移植。既存契約内の限定変更のため。
