# capitalflow-data

CapitalFlow iOS アプリ向け静的 JSON API — Cloudflare Pages でホスティング。

## エンドポイント

| URL | 内容 |
|-----|------|
| `/api/v1/billionaires.json` | 億万長者リスト |
| `/api/v1/presets.json` | プリセット (日本平均年収・最低賃金等) |
| `/api/v1/themes.json` | テーマカタログ |
| `/api/v1/meta.json` | スキーマメタ情報 |
| `/api/health.json` | ヘルスチェック |

## セットアップ

```bash
npm install
npm run build   # data/*.yaml → public/api/v1/*.json を生成
npm run dev     # ローカル確認 (http://localhost:8788)
```

## データ更新の流れ

1. `data/billionaires.yaml` または `data/presets.yaml` を編集
2. `npm run build` でローカル確認
3. `main` ブランチに push → GitHub Actions が自動デプロイ

## Cloudflare Pages の初期設定

1. GitHub にリポジトリを push
2. Cloudflare Dashboard > Pages > Create Project > Connect to Git
3. ビルド設定:
   - **Build command**: `npm ci && npm run build`
   - **Build output directory**: `public`
   - **Root directory**: `/`
   - 環境変数: `NODE_VERSION=20`
4. GitHub Secrets に以下を追加:
   - `CLOUDFLARE_API_TOKEN`: Cloudflare API トークン
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare アカウント ID

## リリース前チェック

- [ ] `data/billionaires.yaml` の収入値を最新値に更新
- [ ] `data/billionaires.yaml` の `currency_rates.usd_jpy` を最新レートに更新
- [ ] `data/presets.yaml` の統計値を最新公的データに更新
- [ ] iOS アプリの API URL を実際のドメインに変更
- [ ] `public/.well-known/apple-app-site-association` の `TEAMID` を実際のチーム ID に変更

## Disclaimer

本サイトの収入データは公開情報をもとにした推定値であり、正確性を保証するものではありません。エンタメ目的のみに使用してください。
