# 機能紹介改訂版の変更記録

2026-09-22の追加9コメントに対応。前版の料金と販売計画は維持。

|コメント|変更|
|---|---|
|1|表紙の実画面を楽しそうな犬たちの生成イラストへ変更|
|2|表紙の「施設の」を削除|
|3|独創性の「ペット同士」を大きさと色で強調|
|4|将来構想をアイボリー背景にし、ペットカメラの観察データを用いた分析の高度化を追加|
|5|相性評価の仕組み、画像・動画の扱い、検証状況・導入時の確認に関する補足を追加|
|6|飼い主の交流から、離れた場所に暮らすペット同士の交流へ修正|
|7|使用フローを招待、登録、AI整理、相性確認、当日設定、提案確定の6ステップへ|
|8・9|登録で画像・動画も使えることを明記|

## 実装根拠

origin/feat/public-demo-adminの実装を読み取り確認。過去のテスト通過数は今回の実行結果ではないため掲載しない。

- 写真と動画は任意。写真1枚に加え、動画の25%/75%位置からブラウザで最大2枚の静止画を抽出し、最大3画像を解析に送る。元動画と音声をそのまま送る方式ではない。src/lib/workerClient.ts、OwnerForm.tsx。
- 媒体本体の永続保存は行わない。ファイル名、形式、サイズ、状態のメタデータは保存する。OwnerRegistration.tsx、worker/README.md。
- 6つの基本因子とAIの7軸を計算に使用。禁忌hardBlockedPetIdsは点数と独立した制約で、片側の設定でも同じ群から除外。compatibility.ts、matching.ts。
- 提案の承認・却下にはスタッフが理由を記入し履歴を残す。公開デモは架空データで保存しない。TodayScreen.tsx、App.tsx。
- 実施設における事故低減、精度、時間短縮は未実証。提案修正率、スタッフ判断との一致、運用時間、継続利用等を検証予定と区別する。
- ペットカメラと施設外のペット交流は将来構想。継続的な動画解析を現在の登録機能と混同しない。

## 表紙画像の生成プロンプト

Create a refined warm editorial illustration for a Japanese pet-care presentation cover. Landscape 4:3 composition. Three happy relaxed dogs, a small apricot toy poodle, a friendly Shiba Inu and a cream retriever, enjoying a spacious sunny indoor dog daycare with pale natural wood, ivory walls, sage green plants and a glimpse of a garden. One dog makes a playful bow, another gently trots, all expressive and comfortable, appropriate natural canine behavior, no aggressive contact. Beautiful softly painted storybook realism with subtle watercolor texture, warm daylight, sophisticated restrained ivory and sage palette to harmonize with a dark forest-green slide. Focus dogs in central foreground, all heads and paws visible, balanced negative space around them. No people, no words, no lettering, no logos, no UI, no diagrams. High quality anatomically coherent dogs, joyful and reassuring atmosphere.

## 分担と検証

routine_workerに3ファイルの通常資料編集、fast_scanに媒体・利用順・相性計算の読み取り調査を委任。親が画像生成、全ページ表示確認、最終書き出し、Git共有を実施。

アプリ変更を伴わないためアプリのテストは実行対象外。資料生成、表の計算、ページ数、全ページ表示を検証する。PRは明示依頼の範囲に限るAGENTS.mdを優先し、新規作成しない。
