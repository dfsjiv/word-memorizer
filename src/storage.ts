import type { DictionaryPayload, WordRecord } from './domain'
import { mergeWordLists, wordId } from './domain'
import { localDate } from './scheduler'
import { starterWords } from './starterWords'

const DATABASE = 'mora-client'
const WORDS = 'words'
const ASSETS = 'assets'

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DATABASE, 1)
  request.onupgradeneeded = () => {
    const database = request.result
    if (!database.objectStoreNames.contains(WORDS)) database.createObjectStore(WORDS, { keyPath: 'id' })
    if (!database.objectStoreNames.contains(ASSETS)) database.createObjectStore(ASSETS)
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const requestValue = <T,>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const migrateLegacyWords = (): WordRecord[] => {
  try {
    const raw = localStorage.getItem('mora-words')
    if (!raw) return starterWords
    const legacy = JSON.parse(raw) as Array<Record<string, unknown>>
    const now = new Date().toISOString()
    return mergeWordLists([], legacy.map((item) => ({
      id: wordId(String(item.word || '')),
      word: String(item.word || ''),
      phonetic: String(item.phonetic || ''),
      meaning: String(item.meaning || ''),
      definition: '',
      example: String(item.example || ''),
      exampleMeaning: String(item.exampleMeaning || ''),
      lookupCount: Number(item.lookupCount || 0),
      reciteCount: Number(item.reciteCount ?? item.reviews ?? 0),
      dueDate: String(item.due || localDate()),
      source: 'starter' as const,
      tags: [],
      createdAt: now,
      updatedAt: now,
    })).filter((item) => item.word))
  } catch {
    return starterWords
  }
}

export const loadWords = async () => {
  const database = await openDatabase()
  const words = await requestValue(database.transaction(WORDS).objectStore(WORDS).getAll()) as WordRecord[]
  if (words.length) return words
  const migrated = migrateLegacyWords()
  await saveWords(migrated)
  return migrated
}

export const saveWords = async (words: WordRecord[]) => {
  const database = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WORDS, 'readwrite')
    const store = transaction.objectStore(WORDS)
    store.clear()
    words.forEach((word) => store.put(word))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export const loadAsset = async <T,>(key: string) => {
  const database = await openDatabase()
  return requestValue(database.transaction(ASSETS).objectStore(ASSETS).get(key)) as Promise<T | undefined>
}

export const saveAsset = async (key: string, payload: DictionaryPayload | unknown) => {
  const database = await openDatabase()
  await requestValue(database.transaction(ASSETS, 'readwrite').objectStore(ASSETS).put(payload, key))
}
