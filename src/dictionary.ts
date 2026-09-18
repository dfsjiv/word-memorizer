import type { DictionaryEntry } from './domain'
import { loadAsset, saveAsset } from './storage'

const RAW_BASE = 'https://raw.githubusercontent.com/dfsjiv/word-memorizer/main/dictionary'
const TIER_FILES: Record<number, number[]> = {
  3000: [3000],
  10000: [3000, 10000],
  30000: [3000, 10000, 30000],
  100000: [3000, 10000, 30000, 100000],
}

type TierPayload = { from: number; to: number; entries: DictionaryEntry[] }
type ShardPayload = { letter: string; entries: DictionaryEntry[] }

export const CACHE_OPTIONS = [
  { size: 3000, label: '核心 3,000', hint: '日常交流与基础阅读', download: '约 0.9 MB' },
  { size: 10000, label: '常用 10,000', hint: '大学英语与一般阅读', download: '约 2.6 MB' },
  { size: 30000, label: '进阶 30,000', hint: '专业阅读与考试词汇', download: '约 6.8 MB' },
  { size: 100000, label: '扩展 100,000', hint: '更广泛的专业词汇', download: '约 17.5 MB' },
] as const

export type CacheSize = keyof typeof TIER_FILES
export type DictionaryLoad = { entries: DictionaryEntry[]; source: 'online' | 'cached' | 'mixed'; loaded: number }

export const loadDictionaryTiers = async (size: CacheSize, onProgress?: (loaded: number) => void): Promise<DictionaryLoad> => {
  const entries: DictionaryEntry[] = []
  let onlineCount = 0
  let cachedCount = 0
  for (const tier of TIER_FILES[size]) {
    const key = `ecdict-tier-${tier}-v1`
    let payload = await loadAsset<TierPayload>(key)
    if (payload) {
      cachedCount += payload.entries.length
    } else {
      try {
        const response = await fetch(`${RAW_BASE}/tier-${tier}.json`)
        if (!response.ok) throw new Error(String(response.status))
        payload = await response.json() as TierPayload
        await saveAsset(key, payload).catch(() => undefined)
        onlineCount += payload.entries.length
      } catch {
        // A missing tier can be skipped when lower cached tiers still exist.
      }
    }
    if (payload) entries.push(...payload.entries)
    onProgress?.(entries.length)
  }
  if (!entries.length) throw new Error('词典未缓存且当前无法连接 GitHub')
  return { entries, loaded: entries.length, source: onlineCount && cachedCount ? 'mixed' : onlineCount ? 'online' : 'cached' }
}

const memoryShards = new Map<string, DictionaryEntry[]>()

const gunzipJson = async (response: Response) => {
  if (!response.body) throw new Error('Empty dictionary response')
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).json() as Promise<ShardPayload>
}

const loadShard = async (letter: string) => {
  if (!letter || !/[a-z]/.test(letter)) return []
  let entries = memoryShards.get(letter)
  if (!entries) {
    const key = `ecdict-shard-${letter}-v1`
    const cached = await loadAsset<ShardPayload>(key)
    if (cached) {
      entries = cached.entries
      memoryShards.set(letter, entries)
      return entries
    }
    const response = await fetch(`${RAW_BASE}/shards/${letter}.json.gz`, { cache: 'force-cache' })
    if (!response.ok) throw new Error(`GitHub dictionary request failed: ${response.status}`)
    const payload = await gunzipJson(response)
    entries = payload.entries
    await saveAsset(key, payload).catch(() => undefined)
    memoryShards.set(letter, entries)
  }
  return entries
}

export const lookupGithub = async (query: string) => {
  const normalized = query.trim().toLocaleLowerCase('en-US')
  const entries = await loadShard(normalized[0])
  const exact = entries.filter((entry) => entry.word.toLocaleLowerCase('en-US') === normalized)
  if (exact.length) return exact.slice(0, 8)
  return entries.filter((entry) => entry.word.toLocaleLowerCase('en-US').startsWith(normalized)).slice(0, 8)
}

export const lookupGithubBatch = async (terms: string[]) => {
  const groups = new Map<string, Set<string>>()
  for (const term of terms) {
    const normalized = term.trim().toLocaleLowerCase('en-US')
    const letter = normalized[0]
    if (!letter || !/[a-z]/.test(letter)) continue
    if (!groups.has(letter)) groups.set(letter, new Set())
    groups.get(letter)?.add(normalized)
  }
  const found = new Map<string, DictionaryEntry>()
  for (const [letter, wanted] of groups) {
    const entries = await loadShard(letter)
    for (const entry of entries) {
      const key = entry.word.toLocaleLowerCase('en-US')
      if (wanted.has(key)) found.set(key, entry)
    }
  }
  return found
}

export const lookupPublicDictionary = async (query: string): Promise<DictionaryEntry[]> => {
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query.trim())}`)
  if (!response.ok) return []
  const data = await response.json() as Array<{
    word: string
    phonetic?: string
    phonetics?: Array<{ text?: string }>
    meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string }> }>
  }>
  return data.slice(0, 3).map((item) => {
    const meanings = (item.meanings || []).flatMap((meaning) => (meaning.definitions || []).slice(0, 2).map((definition) => `${meaning.partOfSpeech || ''}. ${definition.definition || ''}`.trim()))
    return {
      word: item.word,
      phonetic: item.phonetic || item.phonetics?.find((value) => value.text)?.text || '',
      meaning: meanings.join('\n') || '在线词典暂无释义',
      definition: meanings.join('\n'),
      tags: ['在线'],
      rank: null,
    }
  })
}
