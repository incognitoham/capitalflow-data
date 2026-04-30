/**
 * validate.mjs — 既存の public/api/v1/*.json をスキーマでバリデーションのみ行う
 * 使用法: node scripts/validate.mjs
 */

import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

async function main() {
  const ajv = new Ajv({ allErrors: true })
  addFormats(ajv)

  const checks = [
    {
      schema: 'schemas/billionaires.schema.json',
      data:   'public/api/v1/billionaires.json',
      label:  'billionaires.json',
    },
    {
      schema: 'schemas/presets.schema.json',
      data:   'public/api/v1/presets.json',
      label:  'presets.json',
    },
  ]

  let allPassed = true

  for (const { schema: schemaPath, data: dataPath, label } of checks) {
    const schema = JSON.parse(await readFile(join(ROOT, schemaPath), 'utf-8'))
    const data   = JSON.parse(await readFile(join(ROOT, dataPath),   'utf-8'))
    const validate = ajv.compile(schema)

    if (validate(data)) {
      console.log(`✅ ${label} — OK`)
    } else {
      console.error(`❌ ${label} — FAIL`)
      for (const err of validate.errors ?? []) {
        console.error(`   ${err.instancePath || '(root)'}: ${err.message}`)
      }
      allPassed = false
    }
  }

  if (!allPassed) process.exit(1)
  console.log('\n✨ 全バリデーション通過')
}

main().catch(err => {
  console.error('💥 エラー:', err.message)
  process.exit(1)
})
