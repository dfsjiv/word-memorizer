import Papa from 'papaparse'
import type { WordRecord } from './domain'
import { wordId } from './domain'
import { localDate } from './scheduler'

const columnIndex = (header: string[], names: string[]) => header.findIndex((cell) => names.includes(cell.trim().toLowerCase()))

export const parseWordFile = async (file: File): Promise<WordRecord[]> => {
  const text = await file.text()
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' })
  const rows = parsed.data
  if (!rows.length) return []

  const header = rows[0]
  const wordColumn = columnIndex(header, ['word', 'term', '单词'])
  const meaningColumn = columnIndex(header, ['meaning', 'translation', '释义', '中文释义'])
  const phoneticColumn = columnIndex(header, ['phonetic', '音标'])
  const exampleColumn = columnIndex(header, ['example', '例句'])
  const hasHeader = wordColumn >= 0
  const now = new Date().toISOString()

  return rows.slice(hasHeader ? 1 : 0).reduce<WordRecord[]>((words, row) => {
    const word = (row[hasHeader ? wordColumn : 0] || '').trim()
    const meaning = (row[hasHeader && meaningColumn >= 0 ? meaningColumn : 1] || '').trim()
    if (!word || !meaning) return words
    words.push({
      id: wordId(word),
      word,
      phonetic: (row[hasHeader && phoneticColumn >= 0 ? phoneticColumn : 2] || '').trim(),
      meaning,
      definition: '',
      example: (row[hasHeader && exampleColumn >= 0 ? exampleColumn : 3] || '').trim(),
      exampleMeaning: '',
      lookupCount: 0,
      reciteCount: 0,
      dueDate: localDate(),
      source: 'import' as const,
      tags: ['导入'],
      createdAt: now,
      updatedAt: now,
    })
    return words
  }, [])
}
