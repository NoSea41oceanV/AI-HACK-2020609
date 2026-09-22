# PAWLAND AI Worker

Cloudflare Workers Free を想定した、OrcaRouter とブラウザの間の小さなプロキシです。API キーをブラウザへ配らず、ペットの性格・遊び方・注意事項と、任意の写真・動画からブラウザ内で抽出した静止画像だけを分析へ送ります。飼い主名・連絡先・音声・動画そのものは拒否します。

写真・動画フレーム画像は `/api/analyze` のリクエスト中だけ扱います。Worker、R2、KV、Firestoreへの保存は行わず、OrcaRouterの構造化分析結果だけを応答します。

## API

- `GET /health`: OrcaRouter Secret の設定有無を返します。互換フィールド `mediaStorageConfigured` は常に `false` です。
- `POST /api/analyze`: 性格・遊び方・注意事項と、任意の写真・動画から抽出した静止画像を許可済みモデルへ転送します。
- `POST /api/media`: 永続保存を防ぐため `410 media_storage_disabled` を返します。

推奨リクエスト:

```json
{
  "profile": {
    "personality": "初対面の犬には慎重です",
    "playStyle": "ボール遊びと穏やかな追いかけっこを好みます",
    "precautions": "食事中は距離を取ります"
  },
  "media": {
    "type": "image",
    "dataUrl": "data:image/jpeg;base64,..."
  }
}
```

`profile` は `personality` と `playStyle` が必須かつ空文字不可、`precautions` は空文字を許可し、各項目は1000文字以下です。3項目以外のキーや旧 `prompt` は拒否します。メディアは画像の `dataUrl` または公開HTTPS `url` で指定し、0〜3件です。動画ファイルや動画URL、`mediaId` は利用できません。Owner UIで動画を選んだ場合は、ブラウザ内で音声を含まないJPEGフレームを最大2枚抽出して送信します。

成功時の `analysis.matchingProfile` は次の形式です。

```json
{
  "energyLevel": 3,
  "sociability": 4,
  "anxietyLevel": 2,
  "assertiveness": 2,
  "resourceGuarding": 1,
  "playStyles": ["gentle", "fetch"]
}
```

前4項目は1〜5、`resourceGuarding` は0〜5の整数です。`playStyles` は `chase`、`wrestle`、`tug`、`fetch`、`gentle`、`solo` の重複なし配列です。範囲外・欠落を含むAI応答は `502 invalid_model_response` として拒否します。

## 設定

1. `wrangler.toml.example` を `wrangler.toml` としてコピーします。既存Workerへ配備するため、`name = "pet-hotel-agent-api"` は変更せず、`CORS_ORIGINS` だけを環境に合わせます。
2. API キーはファイルへ書かず、`npx wrangler secret put ORCAROUTER_API_KEY` でSecretとして登録します。
3. R2、KV、D1などのストレージBindingは設定しません。

環境変数:

- `ORCA_ROUTER_BASE_URL`: 既定は `https://api.orcarouter.ai/v1`
- `ORCA_ALLOWED_MODELS`: カンマ区切りの許可リスト。既定は `google/gemini-2.5-flash` だけです。
- `ORCA_ROUTER_TIMEOUT_MS`: 1,000〜30,000ミリ秒。既定は25,000です。
- `CORS_ORIGINS`: カンマ区切りの完全一致。既定は `http://localhost:5173` だけです。

## 安全制限

- 画像: 1ファイル 5 MiB、JPEG/PNG/WebPのみ
- Owner UIの動画選択: 1ファイル 20 MiB、MP4/WebM/MOVのみ。ブラウザ内で静止画へ変換し、動画自体はWorkerへ送信しない
- 分析JSON全体: 28 MiB
- 1分あたり: 分析10回（IP単位・同一isolate内の簡易制限）
- Content-Typeだけでなく先頭シグネチャも確認
- モデルallowlist、CORS完全一致、公開HTTPS URL制限、上流25秒タイムアウト
- 上流応答: 最大1 MiB
- APIキー、入力テキスト、写真・動画フレーム画像はログへ出力しない

Workerのメモリ内レート制限は絶対的な課金防止ではありません。CloudflareとOrcaRouter双方の利用量を確認し、デモ終了後はWorkerを無効化してください。

## テスト

依存パッケージはありません。Node.js 22.6以降で実行します。

```sh
cd worker
npm test
```

テスト用Secretはモックにだけ渡し、ファイルやログへ保存しません。
