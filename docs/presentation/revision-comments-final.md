# 利用フロー改訂版の変更記録

対象：2026-09-22の23件のコメント。古い添付画像より、最新コメントの本文と対応画像を優先。

|コメント|対応|
|---|---|
|1|説明・原稿の部屋割りをグループ分けへ変更。実画面内のUIは改変しない|
|2|表紙を公開デモのおともだちマップ実画面へ変更|
|3|最終確定を次行へ|
|4|ペット同士の相性を施設のグループ分けへつなぐ独創性を説明|
|5・6|AI送信項目と静止画枚数の説明を本編から削除|
|7|HTTPS、スタッフ認証、施設別アクセス制御を説明|
|8|AI判断と登録済み禁忌事項（オプトアウトによる同群除外）を説明|
|9|AI項目の欠落・範囲外、禁忌・定員を満たせない場合を明示|
|10|安心を価値の中心に、判断時間の削減を補助として提示|
|11|初期費用の旧説明を削除|
|12・13|市場背景を大きく上部へ、原価を補足へ|
|14|タイトルをビジネスプランへ|
|15・16|販売方法、接触・デモ等の年間目標欄を削除|
|17|将来構想の後にPAWLANDを中央配置した締めを追加|
|18|月次計画、原価、システム構成・技術、安全設計を補足に追加。質問文は掲載しない|
|19|初期費用を3万円から5千円の案へ変更|
|20|右側のスタッフだけ男性に変更した生成イラストへ|
|21|初めての子の相性が分からない、検討に時間がかかるという台詞へ|
|22|表紙にteamHHHを記載|
|23|利用者・タイミング・機能と実画面を横方向の時系列で説明|

## 事実関係

犬同士の相性を扱う既存サービスがあるため、「これまでなかった」「世界初」とは記載しない。

- Dogmate公式App Store：https://apps.apple.com/jp/app/dogmate-%E6%84%9B%E7%8A%AC%E5%AE%B6%E5%B0%82%E7%94%A8%E3%82%A2%E3%83%97%E3%83%AA/id6739194707
- La Vie公式：https://lavie-app.com/

実装確認基準：origin/feat/public-demo-admin、ce036a4。Firebase AuthとFirestore Rulesによる施設別制限は実装済み。WorkerのAI APIにはFirebase IDトークン検証がないため、全APIがログイン認証済みとは表現しない。CORSは認証の代替ではない。禁忌はhardBlockedPetIdsに登録された同群禁止設定で、飼い主フォーム上の設定UIとは主張しない。相性スコアは事故防止の保証や医学的評価ではない。

## 価格改定と計画の前提

税別の計画値：月額10,000円、初期5,000円、月次変動費3,850円。初期対応費はセルフ設定と1時間の支援を想定し2,000円と置く。固定費360万円は従来通り。

新しい販売計画：有料施設5、10、18、28、40、50、60、68、76、84、92、100。631施設月、月額売上631万円、導入売上50万円、合計681万円。変動費242.935万円、導入対応費20万円、固定費360万円、営業利益58.065万円。

従来の年末80施設・425施設月のペースに同じ値下げと費用仮定を適用すると、売上465万円、営業損益−74.625万円。黒字は販売計画の達成を前提とする試算で、実績ではない。月初契約、当月満額、解約なし、値引きなしを仮定。

## 画像

画面は公開デモ https://pawpair-ai-hack-2026.web.app/demo の架空データ。2026-09-22撮影。余白やナビゲーションの切り抜きのみで、画面内容は改変していない。

男性スタッフ画像の編集プロンプト：

> Edit this illustration: change ONLY the pet sitter on the RIGHT half to an adult Japanese MAN with short dark hair, masculine face, same caring slightly concerned expression, same cream shirt and sage apron and position/pose. Preserve the woman owner on the left, both dogs and all other pets, setting, objects, lighting, palette, painterly style, composition and dimensions exactly. Do not add text. The right pet sitter must clearly look male. Keep all faces fully visible.

元画像はassets/owner-sitter-story.png、編集結果はassets/owner-male-sitter-story.png。

## 作業分担

- routine_worker：範囲を3つの資料生成・原稿ファイルに限定した通常の資料編集。
- fast_scan：実装と競合の読み取り専用調査。
- 親：画面取得、数値検算、全ページの表示確認、納品とGit共有。

資料のみの変更のためアプリのビルド・テストは対象外。資料の生成、配置・表の検証、画像表示を確認する。
PRは明示依頼の範囲に限るというAGENTS.mdを優先し、CLAUDE.mdの一般的なPR作成記述を適用しない。
