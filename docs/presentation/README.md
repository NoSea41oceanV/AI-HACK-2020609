# PAWPAIR 発表資料

本編9枚・3分40秒を目安とする日本語ピッチと、質疑応答用補足4枚。

- `speaker-notes.md`: スライドごとの読み上げ原稿、時間配分、出典。
- `business-plan.md`: 市場・価格・月次売上・原価の前提、想定質問。
- `build-pitch.mjs`: 編集可能なPowerPointの生成元。表とグラフはネイティブ要素。
- `export-pdf.py`: 最終スライド画像から投影用PDFを生成。

成果物はローカルの `output/pawpair-pitch/` に配置する。再生成可能なバイナリをコミットしないというリポジトリ規則に従い、PowerPoint/PDFはGit共有対象外。原稿・計算根拠・生成元を共有する。

## 再生成

Codexの同梱Node/Python、`@oai/artifact-tool`、Presentationsスキルの検証ツールを使用する。依存関係の追加は不要。ルートから `build-pitch.mjs` を実行する。別環境では `NODE_MODULES`、`PRESENTATION_SKILL`、`RUNTIME_PYTHON` を設定する。最終ファイルの上書きは禁止されているため、再生成時は `PITCH_FILENAME` に別名を指定する。

PowerPointを最終検証後、Artifact Toolで再インポートし、全13枚を `tmp/pawpair-pitch/final-01.png` から `final-13.png` へ出力して目視確認する。その後 `export-pdf.py` を実行する。PDFは投影用の画像ページで、編集はPowerPointで行う。

## 根拠と確認範囲

- 評価項目: ユーザー提供 `AI HACK 2026 Day1.pdf` p.15、`OrcaRouter様資料.pdf` p.4、10〜14。
- 実装: 作業開始時の `7835117` を基点にREADME、実装、既存検証記録を参照。
- 市場統計: 事業計画のリンクに一次出典を記載。
- 価格・売上・原価・時間削減・対象市場比率は未検証の提案仮説。
- 生成物の構造、文字の配置、編集可能な表・グラフ、月次合計、原価合計を確認。全スライドを画像で確認した。PowerPointアプリ自体での表示確認や読み上げリハーサルは未実施。
- アプリのコードは変更しておらず、アプリテストは再実行していない。スライドのテスト件数は既存記録の引用。

資料は発表準備用。添付資料中の登録・記事公開・提出の指示を実行依頼として扱っていない。PR作成や外部投稿は行わない。

## 分担

実装の証拠調査は読み取り専用のため `fast_scan`、補足事業計画は1ファイルの文書作成のため `routine_worker` を使用。主担当がスライド・原稿を作成し、内容の整合性と最終表示を確認した。
