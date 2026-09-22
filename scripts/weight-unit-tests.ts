import { importCsvText } from '../src/utils/io'
import { formatWeightKg, getWeightKg, normalizeWeightRecord, toWeightKg } from '../src/utils/helpers'
import { normalizeAppData } from '../src/utils/storage'
import type { AppData } from '../src/data/types'

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`)
  console.log(`PASS ${label}: ${actual}`)
}

const base: AppData = {
  version: 1,
  projects: [],
  records: [],
  settings: { defaultUnit: 'kg' },
}

assertEqual(toWeightKg(1180, 'g'), 1.18, '1180g canonicalizes')
assertEqual(formatWeightKg(normalizeWeightRecord({ weightValue: 1180, weightUnit: 'g' })), '1.180 kg', '1180g displays')
assertEqual(formatWeightKg(normalizeWeightRecord({ weightValue: 158.9, weightUnit: 'g' })), '0.159 kg', '158.9g displays')
assertEqual(formatWeightKg(normalizeWeightRecord({ weightValue: 8.66, weightUnit: 'kg' })), '8.660 kg', '8.66kg displays')
assertEqual(formatWeightKg(normalizeWeightRecord({ weightValue: 22.1, weightUnit: 'g' })), '0.022 kg', '22.1g displays')

const legacy = normalizeAppData({
  ...base,
  records: [{ id: 'legacy', projectId: 'p', projectCode: 'P', level: 'Part', description: 'Legacy', weightValue: 1180, weightUnit: 'g', source: 'Unknown', status: 'Measured', createdAt: '', updatedAt: '' }],
})
assertEqual(legacy.records[0].weight_kg, 1.18, 'legacy weight/unit normalizes on read')
assertEqual('weightKg' in legacy.records[0], false, 'legacy camelCase is not persisted after normalization')

const edited = normalizeWeightRecord({ ...legacy.records[0], weightValue: 8.66, weightUnit: 'kg' })
assertEqual(edited.weight_kg, 8.66, 'edit saves kg canonical value')
const duplicate = normalizeWeightRecord({ ...legacy.records[0], id: 'copy' })
assertEqual(getWeightKg(duplicate), 1.18, 'duplicate does not double-convert')

const imported = importCsvText(
  ['Level,Project,Description,Weight,Unit', 'Part,P1,Separate unit,1180,g', 'Rack,P1,Explicit text,1.18 kg,', 'Part,P1,Gram text,158.9 g,'].join('\n'),
  base,
).data.records
assertEqual(imported.length, 3, 'CSV imports all rows')
assertEqual(imported[0].weight_kg, 1.18, 'CSV numeric plus unit normalizes')
assertEqual(imported[1].weight_kg, 1.18, 'CSV kg string normalizes')
assertEqual(imported[2].weight_kg, 0.1589, 'CSV g string normalizes')

console.log('Weight unit verification complete.')
