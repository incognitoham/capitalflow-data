/**
 * build.mjs — YAML → JSON 変換 + スキーマバリデーション
 * 使用法: node scripts/build.mjs
 *
 * 責務:
 *   1. data/*.yaml を読み込む
 *   2. USD → JPY 換算 (Math.round で整数化)
 *   3. JSON Schema でバリデーション
 *   4. updated_at を現在時刻で埋める
 *   5. public/api/v1/*.json に書き出す
 *   6. バリデーション失敗時は exit 1
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parse as parseYaml } from 'yaml'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'public/api/v1')

// ─── ユーティリティ ─────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString().split('.')[0] + 'Z'
}

function validateOrFail(ajv, schema, data, label) {
  const validate = ajv.compile(schema)
  if (!validate(data)) {
    console.error(`\n❌ バリデーション失敗: ${label}`)
    for (const err of validate.errors ?? []) {
      console.error(`   ${err.instancePath || '(root)'}: ${err.message}`)
    }
    process.exit(1)
  }
}

function assertUniqueIds(people, label) {
  const seen = new Set()
  for (const p of people) {
    if (seen.has(p.id)) {
      console.error(`\n❌ 重複 ID: "${p.id}" (${label})`)
      process.exit(1)
    }
    seen.add(p.id)
  }
}

// ─── 変換ロジック ────────────────────────────────────────────────

function buildBillionaires(yaml, updatedAt) {
  const rate = yaml.currency_rates.usd_jpy

  const people = yaml.people.map(p => {
    const income = { ...p.annual_income }

    if (income.source_currency === 'usd') {
      if (income.amount_usd == null) {
        console.error(`❌ ${p.id}: source_currency=usd なのに amount_usd がありません`)
        process.exit(1)
      }
      income.amount_jpy = Math.round(income.amount_usd * rate)
    } else if (income.source_currency === 'jpy') {
      if (income.amount_jpy == null) {
        console.error(`❌ ${p.id}: source_currency=jpy なのに amount_jpy がありません`)
        process.exit(1)
      }
    } else {
      console.error(`❌ ${p.id}: 不明な source_currency: ${income.source_currency}`)
      process.exit(1)
    }

    return { ...p, annual_income: income }
  })

  assertUniqueIds(people, 'billionaires')

  return {
    version: 1,
    updated_at: updatedAt,
    currency_rates: yaml.currency_rates,
    people,
  }
}

function buildPresets(yaml, updatedAt) {
  const presets = (yaml.presets ?? []).map(p => {
    const income = { ...p.annual_income }
    if (income.source_currency === 'usd') {
      console.error(`❌ presets に USD ソースは未対応です (${p.id})`)
      process.exit(1)
    }
    return { ...p, annual_income: income }
  })

  assertUniqueIds(presets, 'presets')

  return {
    version: 1,
    updated_at: updatedAt,
    presets,
  }
}

function buildThemes(updatedAt) {
  return {
    version: 1,
    updated_at: updatedAt,
    themes: [
      {
        id: 'default',
        display_name: { ja: '標準', en: 'Default' },
        is_premium: false,
        bill_asset_name: 'bill_default',
        background_colors: ['#0B0F1A', '#14182A'],
      },
      {
        id: 'gold_rain',
        display_name: { ja: 'ゴールドレイン', en: 'Gold Rain' },
        is_premium: false,
        bill_asset_name: 'bill_gold',
        background_colors: ['#1A1200', '#2A2000'],
      },
      {
        id: 'neon',
        display_name: { ja: 'ネオン', en: 'Neon' },
        is_premium: true,
        bill_asset_name: 'bill_neon',
        background_colors: ['#0A000A', '#1A001A'],
      },
      {
        id: 'crypto',
        display_name: { ja: 'クリプト', en: 'Crypto' },
        is_premium: true,
        bill_asset_name: 'bill_crypto',
        background_colors: ['#000814', '#001A2E'],
      },
    ],
  }
}

function buildMeta(updatedAt) {
  return {
    schema_version: 1,
    min_supported_app_version: '1.0.0',
    endpoints: {
      billionaires: '/api/v1/billionaires.json',
      presets: '/api/v1/presets.json',
      themes: '/api/v1/themes.json',
    },
    generated_at: updatedAt,
  }
}

// ─── メイン ──────────────────────────────────────────────────────

async function main() {
  const ajv = new Ajv({ allErrors: true })
  addFormats(ajv)

  console.log('📦 capitalflow-data ビルド開始...\n')

  // スキーマ読み込み
  const billSchema   = JSON.parse(await readFile(join(ROOT, 'schemas/billionaires.schema.json'), 'utf-8'))
  const presetsSchema = JSON.parse(await readFile(join(ROOT, 'schemas/presets.schema.json'),    'utf-8'))

  // ソース YAML 読み込み
  const billYaml    = parseYaml(await readFile(join(ROOT, 'data/billionaires.yaml'), 'utf-8'))
  const presetsYaml = parseYaml(await readFile(join(ROOT, 'data/presets.yaml'),     'utf-8'))

  const updatedAt = nowIso()

  // 変換
  const billJson    = buildBillionaires(billYaml, updatedAt)
  const presetsJson = buildPresets(presetsYaml, updatedAt)
  const themesJson  = buildThemes(updatedAt)
  const metaJson    = buildMeta(updatedAt)

  // バリデーション
  validateOrFail(ajv, billSchema,    billJson,    'billionaires.json')
  validateOrFail(ajv, presetsSchema, presetsJson, 'presets.json')

  // 出力ディレクトリ作成
  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(join(ROOT, 'public/api'), { recursive: true })

  // JSON 書き出し (2スペースインデント + 末尾改行)
  const write = async (path, data) => {
    await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    const size = (JSON.stringify(data).length / 1024).toFixed(1)
    console.log(`   ✅ ${path.replace(ROOT + '/', '')} (${size} KB)`)
  }

  await write(join(OUT_DIR, 'billionaires.json'), billJson)
  await write(join(OUT_DIR, 'presets.json'),      presetsJson)
  await write(join(OUT_DIR, 'themes.json'),       themesJson)
  await write(join(OUT_DIR, 'meta.json'),         metaJson)
  await write(join(ROOT, 'public/api/health.json'), { ok: true })

  console.log(`\n✨ ビルド完了 (updated_at: ${updatedAt})`)

  // 人数サマリー
  const rate = billYaml.currency_rates.usd_jpy
  console.log(`\n📊 生成サマリー:`)
  console.log(`   億万長者: ${billJson.people.length} 人`)
  console.log(`   プリセット: ${presetsJson.presets.length} 人`)
  console.log(`   テーマ: ${themesJson.themes.length} 種`)
  console.log(`   為替レート: 1 USD = ¥${rate}`)
}

main().catch(err => {
  console.error('\n💥 ビルドエラー:', err.message)
  process.exit(1)
})
