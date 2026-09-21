# AI HACK 2020609

このフォルダー内の作業内容をGitで履歴管理するための準備です。
製品の仕様、言語、フレームワーク、依存関係、ビルド・実行・テスト方法は未決定です。
技術構成が決まった時点で、実際の手順と必要な除外ルールを追記します。

## 管理するファイル

初回コミットの候補は `README.md` と `.gitignore` の2ファイルです。
今後のソースコード、共有設定、文書は内容を確認して追加します。
既存ファイルやブランチが追加されていた場合は保持し、コミット対象はアプリで個別に確認します。

## 機密情報・生成物の除外方針

以下は `.gitignore` で除外する保存場所・名前の規約です。特定の技術構成の採用を意味しません。

| 対象 | 除外するパス・パターン |
| --- | --- |
| 実際の環境変数・ローカル設定 | 各階層の `.env`、`.env.*` |
| 秘密情報・認証情報の保存先 | 各階層の `secrets/`、`credentials/` |
| 秘密鍵・証明書バンドル | 各階層の `*.key`、`*.p12`、`*.pfx` |
| 再生成できる成果物 | ルート直下の `build/`、`dist/`、`coverage/` |
| キャッシュ・一時ファイル | ルート直下の `.cache/`、`tmp/` |
| 実行ログ | 各階層の `*.log` |
| OSが作成する補助ファイル | 各階層の `.DS_Store`、`Thumbs.db`、`Desktop.ini` |

`.env.example` は共有用の例として除外しません。作成する場合はダミー値だけを記載します。
上記パターン以外に書かれた秘密情報は自動では除外されないため、追加するファイルの内容を確認します。
すでに追跡されているファイルには `.gitignore` が効かないため、既存の管理対象も確認します。
技術固有の依存物や生成物は、構成が決まり次第、実際のパスを確認して除外します。

## アプリでの初期化・初回コミット候補の確認

1. アプリで対象フォルダー `D:\work\AI HACK 2020609` を選び、レビュー済みGit操作で初期化します。すでにリポジトリであれば再初期化しません。
2. 対象フォルダー内で、以下の読み取り専用コマンドを実行します。

   ```powershell
   git rev-parse --show-toplevel
   git status --short --untracked-files=all
   git check-ignore -v -- .env .env.local secrets/probe.txt credentials/probe.json private.key bundle.p12 bundle.pfx build/probe.txt dist/probe.txt coverage/probe.txt .cache/probe.txt tmp/probe.txt run.log .DS_Store Thumbs.db Desktop.ini
   git check-ignore -v -- README.md .gitignore .env.example
   ```

3. ルートが `D:/work/AI HACK 2020609`（区切り文字の違いは許容）と一致することを確認します。一致しなければコミットに進みません。
4. 新たなファイルが追加されていなければ、statusの候補が `?? .gitignore` と `?? README.md` の2件だけであることを確認します。
5. 最初のcheck-ignoreで全パスの除外ルールが表示されることを確認します。検証用パスは実在する必要がありません。最後のcheck-ignoreは出力なし・終了コード1が期待値です。共有する3ファイルが除外されないことを示します。
6. アプリで2ファイルの内容と初回コミット候補を確認します。初回コミットもアプリのレビュー済み操作で行います。

初回コミットメッセージ案: `docs: add repository overview and ignore policy`

この手順は実行済みの記録ではありません。初期化・コミットのGit変更コマンドは実行せず、アプリ上で確認します。
リモート作成、push、PR、認証設定、課金、権限変更はこの作業の対象外です。
