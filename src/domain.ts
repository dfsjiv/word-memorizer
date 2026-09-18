export type WordSource = 'starter' | 'manual' | 'import' | 'ecdict'

export type WordRecord = {
  id: string
  word: string
  phonetic: string
  meaning: string
  definition: string
  example: string
  exampleMeaning: string
  lookupCount: number
  reciteCount: number
  dueDate: string
  source: WordSource
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type DictionaryEntry = {
  word: string
  phonetic: string
  meaning: string
  definition: string
  tags: string[]
  rank: number | null
}

export type DictionaryPayload = {
  name: string
  source: string
  license: string
  entryCount: number
  entries: DictionaryEntry[]
}

export type DailyRecord = { date: string; recited: number; wordIds?: string[]; uniqueWords?: number }

export const normalizeWord = (word: string) => word.trim().normalize('NFKC').toLocaleLowerCase('en-US')
export const wordId = (word: string) => `word:${encodeURIComponent(normalizeWord(word))}`
export const exposureCount = (word: WordRecord) => word.lookupCount + word.reciteCount

export const mergeWordLists = (current: WordRecord[], incoming: WordRecord[]) => {
  const records = new Map<string, WordRecord>()
  for (const word of current) records.set(normalizeWord(word.word), word)
  for (const word of incoming) {
    const key = normalizeWord(word.word)
    const existing = records.get(key)
    if (!existing) {
      records.set(key, word)
      continue
    }
    records.set(key, {
      ...existing,
      phonetic: existing.phonetic || word.phonetic,
      meaning: existing.meaning || word.meaning,
      definition: existing.definition || word.definition,
      example: existing.example || word.example,
      exampleMeaning: existing.exampleMeaning || word.exampleMeaning,
      tags: [...new Set([...existing.tags, ...word.tags])],
      updatedAt: new Date().toISOString(),
    })
  }
  return [...records.values()]
}
