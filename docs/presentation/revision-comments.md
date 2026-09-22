# PAWLAND ストーリー改訂版：注釈対応

2026-09-22。既存7枚版への18コメントを受け、7枚（本編6枚・補足1枚）に再構成。

| コメント | 対応先・変更 |
|---|---|
| 1 | 表紙を「ワンちゃんが過ごしやすい空間へ」に変更 |
| 2 | 大切な家族を安心して預けたい、という飼い主の気持ちを冒頭に |
| 3 | 表紙の処理フローを削除。AIの役割は3ページへ |
| 4 | 画面の括弧付き注記を表紙から削除。撮影元・サンプル条件はノートに保存 |
| 5 | 観測に基づく更新は表紙から削除し、将来構想へ |
| 6 | 過去E2Eの細かな記録を表紙から削除 |
| 7 | 評価表を具体的な設計・実装の説明に変更。コスト設計と価格根拠を連続して説明 |
| 8 | メディア非保存をセキュリティの説明に統合 |
| 9 | 時間価値、月額価格、原価、導入支援の順で価格根拠を説明 |
| 10 | 販売開始から有料導入する目標計画を再計算。原価・固定費を含めた黒字計画を提示 |
| 11 | 実証ロードマップを削除。発売後の販売想定へ変更 |
| 12 | 将来構想を独立1ページに。ほかのペット、飼い主の遊び相手探しを追加 |
| 13 | 旧ロードマップの下部注記を削除 |
| 14 | 月次計画を再計算 |
| 15 | 弱気・基本・強気の3シナリオ表を削除 |
| 16 | 原価は価格ページ、年間費用は年間収支ページに統合し再計算 |
| 17 | 過去のテスト数・検証範囲の説明を削除 |
| 18 | AIの使い方・工夫を3ページ、飼い主とシッターのストーリー画像をタイトル直後に追加。市場・支出の一次資料を参照 |

## 収支の計算前提

発売月から12か月。有料稼働施設数は5,8,12,17,22,28,35,42,50,58,68,80。月初契約・当月満額、解約ゼロを置く目標シナリオで、受注実績や保証ではない。

- 425施設月 × 月額10,000円 = 4,250,000円
- 80新規施設 × 初期導入30,000円 = 2,400,000円
- 年間売上 = 6,650,000円
- 月次原価：AI1,000円＋インフラ500円＋サポート2,000円＋決済350円 = 3,850円
- 425施設月 × 3,850円 = 1,636,250円
- 導入対応原価80施設 × 10,000円 = 800,000円
- 年間固定費：開発運営2,400,000円＋営業1,200,000円 = 3,600,000円
- 年間費用 = 6,036,250円、営業利益 = 613,750円

従来と同じ価格・単位原価・固定費を保ち、販売開始時期と獲得ペースを変更。金額は税別、利益は税引前の計画。消費税・法人税・資金調達費用を含まない。固定費は小規模な創業チーム運営予算であり、常勤複数名の市場給与を賄うものではない。

時間価値は30分/日×26日×1,800円/時間=23,400円/月の仮定。実測効果・支払い意思ではない。月額10,000円は時間価値の約43%かつ変動原価控除後6,150円が残る価格案。初期費用は導入対応5時間×2,000円=10,000円の原価に設定・準備の価値20,000円を加えた提案。

## 一次資料

- 矢野経済研究所、2026-09-01：2025年度ペット関連総市場1兆9,504億円見込み。ペットの家族化、1頭あたり支出増が背景。https://www.yano.co.jp/press-release/show/press_id/4169
- アニコム損保、2026-03-11：同社保険契約者5,494名の2025年支出調査。犬1頭の年間支出413,416円。全飼い主を代表する統計や、PAWLANDへの支払い意思ではない。https://www.anicom-sompo.co.jp/news-release/2025/20260311/
- 環境省：2025-04-01時点の保管業登録32,576。サロン等を含み、ホテル専業の施設数とは異なる。対象を約20%の6,500とするのは事業仮説。https://www.env.go.jp/nature/dobutsu/aigo/2_data/statistics/files/r07/2_1_1.pdf

## 画像

実システム画面は従来の公開デモキャプチャを維持。ストーリー挿絵は実顧客の記録ではなく画像生成によるイメージ。保存先：`assets/owner-sitter-story.png`。

Built-in image_gen、生成プロンプト：

> Create a wide landscape editorial illustration for a Japanese presentation about dog compatibility at a pet daycare. Two scenes side by side, no text anywhere: left a worried Japanese adult dog owner crouching beside their beloved small toy poodle, thinking about leaving their family member at daycare; right a concerned professional pet sitter wearing an apron in a clean warm indoor dog daycare, keeping a lively shiba inu and a timid small poodle comfortably separated, dogs displaying incompatible energy levels, no biting, no violence. Warm empathetic refined hand-painted illustration, natural anatomy, understated sage green and warm cream palette, expressive yet restrained, suitable for a polished business pitch. Clear visual storytelling with generous space, horizontal 16:9 composition. No labels, no UI, no charts, no logos.

## 分担

一次資料の読み取り調査は `fast_scan`、範囲を確定した3ファイルの資料生成は `routine_worker` に委任。親担当は構成・試算・画像・注釈対応・最終表示確認・共有を担当。

## 成果物と再生成

`output/pawpair-pitch/` の `PAWLAND_発表資料_ストーリー改訂版.pptx`、同名PDF、`PAWLAND_発表原稿_ストーリー改訂版.md` が今回の成果物。旧7枚版は参照用に保持する。

`build-story-pitch.mjs` は同梱NodeとArtifact Toolを利用し、編集可能なテキスト・表を作成、構造・配置・月次合計を検査してPNGへ再描画。`export-story-pdf.py` はその画像から投影用PDFを生成する。市場の根拠と計画前提は発表者ノートにも保存。

アプリのコード変更・デプロイは対象外。PowerPointアプリでの表示と実際の読み上げリハーサルは未実施。
