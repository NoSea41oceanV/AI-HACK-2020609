# PawPals 確定要件・受入条件・検証証拠対応表

更新日: 2026-09-22。文書調査基点 `6609e685eee3126a5f19f6a59d123f450747a306`。
仕様出典はBB最新ユーザー決定の担当割当連絡。backend実装branchは `origin/feat/pawpals-data-contracts`。A/B/Cの3コミットと検証結果を2026-09-22に受領し、リモート上の変更範囲を照合した。公開配備は未実施。

この表は `gpt-5.6-sol / high` による最終全体レビューの入力資料とする。コードの存在、単体検証、ローカル統合、公開配備を別々に判断する。

## 証拠IDと現在の範囲

| 証拠ID | 出典・版 | 読み取れること | 読み取れないこと |
|---|---|---|---|
| B01 | `6609e68` のApp、domain/data、Rules | 施設認証/スタッフ/招待隔離、既存5軸と6問文字列化、全ペア、2状態snapshot、手動観測のコードがある | 新しい7軸・日付・監査等の受入完了 |
| B02 | [モック統合記録](pawpals-mapping.md#今回の検証2026-09-22) | アプリ46件/Worker15件、型/build、Rules emulatorとローカルブラウザE2Eの担当報告 | 最新仕様の公開配備、実媒体、実機QRの検証 |
| B03 | 旧TASKSにあった2026-09-22公開E2E記録 | 旧構成の架空2頭登録〜確定、アプリ34/Worker15の履歴 | 施設認証版や今回要件の検証 |
| C01 | backend A先行確定連絡 | 構造化18キー、同意、7軸整数0〜100、旧5軸互換の契約 | 実装commit/テスト成功 |
| C02 | backend B/C先行確定連絡 | 当日対象/部屋/提案/監査の保存契約、手動観測、camera unsupported IF | 実装commit/テスト成功 |
| D01 | `3048cc6` | 構造化18項目、同意、AI 7軸、Rules/validation/Workerを実装 | backend検証済み。UI/App統合・実サービスE2E・配備は別 |
| D02 | `48e0e02` | 日付付き対象、施設別部屋、4状態案、revision/transaction/監査、indexesを実装 | backend検証済み。UI/App統合・配備は別 |
| D03 | `d6431c9` | 手動観測Repository、施設/スタッフ/犬境界、ingestion IFとcamera unsupportedを実装 | backend検証済み。UI/App統合・配備は別 |
| D04 | backend完了報告 | アプリ89件、Worker 18件、typecheck/build、Rules実emulator成功 | 担当報告。文書タスクではテストを再実行していない |
| I01 | 統合branchの `d12a381` / `3350193` / `373f39e` | backend A/B/Cを `feat/pawpals-local-integration` へ順序どおり統合 | 変更範囲をGitで照合。App/UI接続・配備は別 |
| U01 | UI commit `87ad6c0` | 構造化受付、7軸表示、当日対象/部屋/監査表示、観測UIとUIテスト | push済み。App統合と統合画面E2Eは別 |
| I02 | 統合途中の担当報告 | アプリ18ファイル114件、Worker 18件成功 | typecheckはApp旧props接続1件が残存。build/公開E2E/配備完了ではない |
| M01 | 実モックindex.html / app.js / README.txt | 質問と7軸の名称、画面構造 | 固定数値を実分析として使う根拠、7軸算出式 |

B02/B03は過去の担当検証記録であり、この文書タスクで再実行したものではない。今回の追加要件に対する検証証拠は次表の欄へ記録する。

## 要件と受入証拠

| ID | 確定要件・受入条件 | 担当 | 現在状態 | 基点/契約の根拠 | 今回実装SHA・検証証拠 |
|---|---|---|---|---|---|
| R01 | モック構造/配色/操作感を活用。実データまたは明示空状態を表示し、未対応/IFを区別 | UI・[09] | 進行中 | B02/M01 | 未受領。6画面・モバイルで固定犬/固定数値/架空ログがないこと |
| R02 | 構造化18キーをフォーム→AI→保存→読み戻しまで保持。選択肢/自由記述上限を両端/Rulesで検証 | backend・UI・[09] | backend検証済み・統合進行中 | C01/D01/D04/M01 | backendで正常/拒否系を検証。UI→App→実保存の統合証拠待ち |
| R03 | structured新受付に同意必須。旧自由記述受付は読み取り可能。未回答を自動補完しない | backend・UI・[09] | backend検証済み・統合進行中 | C01/D01/D04 | backend互換・Rules検証済み。画面同意と実送信の統合証拠待ち |
| R04 | 7軸が整数0〜100。構造化分析時必須、AI/プロフィール間同値伝搬。旧5軸と互換 | backend・UI・[09] | backend検証済み・統合進行中 | C01/D01/D04 | 型/Worker検証済み。実生成値read-back・旧表示の統合証拠待ち |
| R05 | 施設・対象日・明示選択犬を保存し、当日計算は選択犬だけ | backend・UI・[09] | backend検証済み・統合進行中 | C02/D02/D04 | Rules/Repository検証済み。UI再読込と計算対象の統合証拠待ち |
| R06 | 施設別部屋設定を保存・読み戻しし、定員等を計算へ反映 | backend・UI・[09] | backend検証済み・統合進行中 | C02/D02/D04 | 10部屋・revision/施設境界を検証。UI計算反映の証拠待ち |
| R07 | 全n(n-1)/2ペア→最適化。hard制約を維持。score%表示、未確定5分類追加なし | UI・[09] | 進行中 | B01/確定仕様 | 未受領。選択頭数とペア件数、EXPLICIT_BLOCK、同室禁止、解なし、画面表示 |
| R08 | 最新proposedだけ選択中スタッフが承認/却下できる。date/dayRevision/roomsRevision一致 | backend・UI・[09] | backend検証済み・統合進行中 | C02/D02/D04 | 古い案・偽装確定・確定済み再操作をbackendで拒否確認。UI/App証拠待ち |
| R09 | 再計算で旧proposedをsuperseded化し、元案参照を持つ新案保存。待ち件数は最新未確定案のみ | backend・UI・[09] | backend検証済み・統合進行中 | C02/D02/D04 | 旧案失効をbackendで確認。UI再読込・件数表示の証拠待ち |
| R10 | day_saved/rooms_saved/recalculated/confirmed/rejectedをappend-only監査。担当/日時/対象/理由/元案を追跡 | backend・[09] | backend検証済み・統合進行中 | C02/D02/D04 | transaction/Rules/施設境界を確認。App操作からの監査証拠待ち |
| R11 | 招待発行の施設/スタッフ契約を維持。期限なし・一度登録・hash保持・アクセス分離 | backend・UI・[09] | 進行中（今回回帰待ち） | B01/B02 | 未受領。別施設/別飼い主/再create拒否、発行者metadata保存 |
| R12 | 手動観測を保存・表示・再計算へ接続。source/scenarioIdをmanual固定、legacy read互換 | backend・UI・[09] | backend検証済み・統合進行中 | B01/C02/D03/D04 | 冪等性、JST日付/未来、施設境界をbackendで確認。表示・再計算統合待ち |
| R13 | 将来ingestionは入力源/型/adapter/テストのみ。cameraはunsupported | backend | 検証済み（backend範囲） | C02/D03/D04 | 型/adapterテスト成功。cameraはunsupported、実接続・監視なし |
| R14 | 実在する観測/snapshotsのみ表示。severity/ack/交流実績/AI説明を捏造しない | UI・[09] | 進行中 | 確定仕様 | 未受領。空状態、定型根拠と実AI根拠の表示、未対応ラベル |
| R15 | AI/保存/認証失敗と無料枠到達を明示。媒体・PII・Secret境界を維持 | backend・UI・[09] | 進行中（今回回帰待ち） | B01/B02/C01 | 未受領。拡張payload、Worker拒否/失敗、保存失敗、ログ境界 |
| R16 | 今回変更の全体統合と最終レビュー | [09]・レビュー担当 | 進行中 | R01〜R15 | 統合SHA・`gpt-5.6-sol / high` レビュー結果・未解決事項を記録する |
| R17 | 公開配備と実環境の保存・AI・認証・当日運用 | 配備担当 | 未着手（証拠未受領） | R16完了後、依頼範囲内 | 未受領。Hosting/Rules/Workerの版・環境・実read-back |

各「今回証拠」には次を記載する: 対象commit SHA、実行日、環境（emulator/test double/実サービス）、コマンドまたは操作、期待結果、実結果、ログ/画面/報告への参照、未実施の範囲。コードだけで検証済みにせず、検証だけで配備済みにしない。

## モック項目と出典

実モック: `C:/Users/kachi/Downloads/PawPals_AI_Agent_mock_v4/PawPals_mock_v2/`。
この絶対パスは担当が照合した元資料の所在であり、リポジトリ同梱ファイルではない。選択肢を以下へ転記し、他環境でも契約レビュー可能にする。

| 保存キー（C01） | ラベル・選択肢（M01） | index.html行 |
|---|---|---|
| neuter | 避妊・去勢: 済み / 未実施 | 50 |
| heat | ヒート中: いいえ / はい | 51 |
| mixedVaccine | 混合ワクチン証明: 提出済み・有効 / 未提出 / 期限切れ | 56 |
| rabiesVaccine | 狂犬病ワクチン: 提出済み・有効 / 未提出 / 期限切れ | 57 |
| fleaTickPrevention | ノミ・ダニ予防: 実施済み / 未実施 | 58 |
| foodAllergy | 食物アレルギー: なし / あり | 59 |
| medicalHistory | 既往症・服薬: 自由記述（契約上1000文字以下） | 60 |
| sensoryJointConcerns | 関節・視覚・聴覚など気になること: 自由記述（1000文字以下） | 61 |
| multiDogExperience | 多頭飼い経験: なし / 現在もあり / 過去にあり | 66 |
| facilityExperience | ドッグラン・保育園: 月に数回 / 週に数回 / ほぼ利用なし | 67 |
| puppySocialization | 子犬期の社会化: 十分経験あり / 少なめ / 不明 | 68 |
| troubleHistory | 過去のトラブル歴: 自由記述（1000文字以下） | 69 |
| firstMeeting | 初めて会う犬には？: 少し離れて様子を見る / 様子を見てから近づく / すぐ近づいて遊びたがる / 苦手そうにする / 分からない | 74 |
| playPreference | 他の犬との遊び方は？: 追いかけたり追いかけられたり / 追いかけるのが好き / 体を使って遊ぶのが好き / おもちゃで遊ぶのが好き / あまり遊ばず見ている / 分からない | 75 |
| resourceReaction | おもちゃやごはんを他の犬が近づいてきたら？: 気にしない / 少し気にすることがある / 取られそうだと嫌がる / 守ろうとすることがある / そういう場面がない / 分からない | 76 |
| excitement | 楽しくなったときは？: ゆっくりテンションが上がる / 少しずつ盛り上がる / すぐに走り回るほど元気になる / 吠えることがある / 分からない | 77 |
| recovery | 興奮したあと、落ち着くまで？: すぐ落ち着く / 少し時間がかかる / かなり時間がかかる / 状況による / 分からない | 78 |
| stressResponse | 苦手なことがあったときは？: すぐ切り替えられる / 少し離れると落ち着く / 長く気にする / 吠えたり逃げたりする / 分からない | 79 |

旧自由記述「うちの子の性格」はindex.html:82–83。既存personality/playStyle/concernsの互換を維持し、自由記述から新選択肢を推測して埋めない。

| 7軸 | C01の保存キー |
|---|---|
| 外向性 | extraversion |
| 社交性 | sociability |
| 神経質性 | neuroticism |
| 訓練性 | trainability |
| 資源防衛（表示名: 資源への反応） | resourceGuarding |
| 自己主張 | assertiveness |
| 回復力 | resilience |

軸名称の出典はREADME.txt:8、app.js:43–49、表示名の揺れはapp.js:112。整数0〜100の正規スケールはモックからの推測ではなくC01で確定した契約である。モックはAI APIを呼ばず（index.html:87）、app.js:18–55の結果は固定演出。数値・分析文を実装の実AI結果や受入証拠へ流用しない。

## 今回対象外・未確定・残る確認

- 手動部屋編集は今回対象外。既存再計算・確定を維持して今回状態管理へ接続する。
- GOOD/OK/CAUTION/AVOID/INCOMPATIBLEの5分類は未確定で追加禁止。
- カメラ接続、15分監視、映像保持、通知実送信、架空アラート、severity/ack/交流実績の捏造は対象外。
- backend先行契約のfactory最終export、手動観測petIds上限2、minOccupancy省略を0に正規化する予定は実装報告時に照合する。
- 文書の生成済み旧PNGは今回仕様の検証対象ではない。接続の正本は [アーキテクチャ](../アーキテクチャ図.md)。
