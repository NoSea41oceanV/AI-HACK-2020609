# PAWPAIR AI Worker

Cloudflare Workers Free を想定した、OrcaRouter とブラウザの間の小さなプロキシです。API キーをブラウザへ配らず、ペットの性格・遊び方・注意事項と、任意の写真・短い動画だけを分析へ送ります。飼い主名・連絡先・音声は拒否します。

写真・動画は `/api/analyze` のリクエスト中だけ扱います。Worker、R2、KV、Firestoreへの保存は行わず、OrcaRouterの構造化分析結果だけを応答します。

## API

- `GET /health`: OrcaRouter Secret の設定有無を返します。互換フィールド `mediaStorageConfigured` は常に `false` です。
- `POST /api/analyze`: 性格・遊び方・注意事項と、任意の画像・動画を許可済みモデルへ転送します。
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

既存クライアントとの互換用に `prompt` も受け付けますが、その内容もペットの性格・遊び方・注意事項だけにしてください。メディアは `dataUrl` または公開HTTPS `url` で指定します。動画は1件、全メディアは0〜3件です。`mediaId` は利用できません。

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

1. `wrangler.toml.example` を `wrangler.toml` としてコピーし、`name` と `CORS_ORIGINS` を環境に合わせます。
2. API キーはファイルへ書かず、`npx wrangler secret put ORCA_ROUTER_API_KEY` でSecretとして登録します。
3. R2、KV、D1などのストレージBindingは設定しません。

環境変数:

- `ORCA_ROUTER_BASE_URL`: 既定は `https://api.orcarouter.ai/v1`
- `ORCA_ALLOWED_MODELS`: カンマ区切りの許可リスト。既定は `google/gemini-2.5-flash` だけです。
- `ORCA_ROUTER_TIMEOUT_MS`: 1,000〜30,000ミリ秒。既定は25,000です。
- `CORS_ORIGINS`: カンマ区切りの完全一致。既定は `http://localhost:5173` だけです。

## 安全制限

- 画像: 1ファイル 5 MiB、JPEG/PNG/WebPのみ
- 動画: 1ファイル 20 MiB、MP4/WebM/MOVのみ
- 分析JSON全体: 28 MiB
- 1分あたり: 分析10回（IP単位・同一isolate内の簡易制限）
- Content-Typeだけでなく先頭シグネチャも確認
- モデルallowlist、CORS完全一致、公開HTTPS URL制限、上流25秒タイムアウト
- 上流応答: 最大1 MiB
- APIキー、入力テキスト、写真・動画はログへ出力しない

Workerのメモリ内レート制限は絶対的な課金防止ではありません。CloudflareとOrcaRouter双方の利用量を確認し、デモ終了後はWorkerを無効化してください。

## テスト

依存パッケージはありません。Node.js 22.6以降で実行します。

```sh
cd worker
npm test
```

テスト用Secretはモックにだけ渡し、ファイルやログへ保存しません。
