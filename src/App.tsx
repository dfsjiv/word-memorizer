import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import type { DailyRecord, DictionaryEntry, WordRecord } from './domain'
import { exposureCount, mergeWordLists, normalizeWord, wordId } from './domain'
import { CACHE_OPTIONS, loadDictionaryTiers, lookupGithub, lookupGithubBatch, lookupPublicDictionary } from './dictionary'
import type { CacheSize } from './dictionary'
import { parseWordFile } from './importer'
import { intervalForExposure, localDate, nextReviewDate } from './scheduler'
import { loadWords, saveWords } from './storage'

type View = 'study' | 'lookup' | 'library' | 'stats'
type DictionaryStatus = 'idle' | 'loading' | 'online' | 'cached' | 'mixed' | 'error'
type Settings = { dailyGoal: number; cacheSize: CacheSize }
type ArchiveData = { version: 2; updatedAt: string; words: WordRecord[]; history: DailyRecord[]; settings: Settings }
type SearchResult = { entry: DictionaryEntry; origin: 'personal' | 'cache' | 'github' | 'online'; count: number }

const initialSettings: Settings = { dailyGoal: 20, cacheSize: 10000 }

const isArchive = (value: unknown): value is ArchiveData => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ArchiveData>
  return candidate.version === 2 && Array.isArray(candidate.words) && Array.isArray(candidate.history)
}

const asEntry = (word: WordRecord): DictionaryEntry => ({
  word: word.word,
  phonetic: word.phonetic,
  meaning: word.meaning,
  definition: word.definition,
  tags: word.tags,
  rank: null,
})

const Icon = ({ name }: { name: 'study' | 'search' | 'book' | 'chart' | 'sound' | 'upload' | 'plus' | 'folder' | 'moon' | 'back' }) => {
  const paths = {
    study: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 5.5v14M8 7h8"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
    book: <><path d="M3 5h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H3z"/><path d="M21 5h-5a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h5z"/></>,
    chart: <><path d="M4 20V11M10 20V5M16 20v-7M22 20H2"/></>,
    sound: <><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    folder: <><path d="M3 6h7l2 2h9v11H3z"/></>,
    moon: <><path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5z"/></>,
    back: <><path d="m15 18-6-6 6-6"/></>,
  }
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function App() {
  const [words, setWords] = useState<WordRecord[]>([])
  const [history, setHistory] = useState<DailyRecord[]>([])
  const [settings, setSettings] = useState<Settings>(initialSettings)
  const [ready, setReady] = useState(false)
  const [startupOpen, setStartupOpen] = useState(true)
  const [view, setView] = useState<View>('study')
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>([])
  const [dictionaryStatus, setDictionaryStatus] = useState<DictionaryStatus>('idle')
  const [dictionaryProgress, setDictionaryProgress] = useState(0)
  const [startupError, setStartupError] = useState('')
  const [query, setQuery] = useState('')
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([])
  const [remoteSearching, setRemoteSearching] = useState(false)
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [extraQueue, setExtraQueue] = useState<string[]>([])
  const [librarySearch, setLibrarySearch] = useState('')
  const [category, setCategory] = useState('全部')
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')
  const [archiveInfo, setArchiveInfo] = useState<ArchiveInfo | null>(null)
  const [dark, setDark] = useState(() => localStorage.getItem('mora-theme') === 'dark')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const boot = async () => {
      let initialWords = await loadWords()
      let initialHistory: DailyRecord[] = []
      let nextSettings = initialSettings
      try {
        initialHistory = JSON.parse(localStorage.getItem('mora-history-v2') || '[]')
        nextSettings = { ...initialSettings, ...JSON.parse(localStorage.getItem('mora-settings') || '{}') }
      } catch { /* Defaults are valid. */ }

      if (window.moraDesktop) {
        const loaded = await window.moraDesktop.loadArchive()
        setArchiveInfo(loaded.info)
        if (isArchive(loaded.data)) {
          initialWords = loaded.data.words
          initialHistory = loaded.data.history
          nextSettings = { ...initialSettings, ...loaded.data.settings }
        }
      }
      setWords(initialWords)
      setHistory(initialHistory)
      setSettings(nextSettings)
      setReady(true)
    }
    boot()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('mora-theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(async () => {
      await saveWords(words)
      localStorage.setItem('mora-history-v2', JSON.stringify(history))
      localStorage.setItem('mora-settings', JSON.stringify(settings))
      if (window.moraDesktop) {
        const data: ArchiveData = { version: 2, updatedAt: new Date().toISOString(), words, history, settings }
        setArchiveInfo(await window.moraDesktop.saveArchive(data))
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [history, ready, settings, words])

  const today = localDate()
  const reviewedToday = history.find((record) => record.date === today)?.recited || 0
  const goalComplete = reviewedToday >= settings.dailyGoal
  const dueWords = useMemo(() => words
    .filter((word) => word.dueDate <= today)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || exposureCount(left) - exposureCount(right)), [today, words])
  const currentWord = words.find((word) => word.id === extraQueue[0]) || dueWords[0]
  const selectedWord = words.find((word) => word.id === selectedWordId)

  const begin = async (size: CacheSize) => {
    setStartupError('')
    setDictionaryStatus('loading')
    setDictionaryProgress(0)
    try {
      const loaded = await loadDictionaryTiers(size, setDictionaryProgress)
      setDictionary(loaded.entries)
      setDictionaryStatus(loaded.source)
      setSettings((current) => ({ ...current, cacheSize: size }))
      setStartupOpen(false)
    } catch (error) {
      setDictionaryStatus('error')
      setStartupError(error instanceof Error ? error.message : '词典加载失败')
    }
  }

  const localResults = useMemo<SearchResult[]>(() => {
    const normalized = normalizeWord(query)
    if (!normalized) return []
    const chinese = /[\u3400-\u9fff]/.test(normalized)
    const results: SearchResult[] = []
    const seen = new Set<string>()
    for (const word of words) {
      const key = normalizeWord(word.word)
      if ((chinese ? word.meaning.includes(query) : key.startsWith(normalized)) && !seen.has(key)) {
        results.push({ entry: asEntry(word), origin: 'personal', count: exposureCount(word) })
        seen.add(key)
        if (results.length >= 8) return results
      }
    }
    for (const entry of dictionary) {
      const key = normalizeWord(entry.word)
      if ((chinese ? entry.meaning.includes(query) : key.startsWith(normalized)) && !seen.has(key)) {
        results.push({ entry, origin: 'cache', count: 0 })
        seen.add(key)
        if (results.length >= 8) break
      }
    }
    return results
  }, [dictionary, query, words])

  const visibleResults = remoteResults.length ? remoteResults : localResults

  const searchRemote = async () => {
    if (!query.trim()) return
    setRemoteSearching(true)
    setRemoteResults([])
    try {
      const github = await lookupGithub(query)
      if (github.length) {
        setRemoteResults(github.map((entry) => ({ entry, origin: 'github', count: 0 })))
      } else {
        const online = await lookupPublicDictionary(query)
        setRemoteResults(online.map((entry) => ({ entry, origin: 'online', count: 0 })))
        if (!online.length) setNotice('本地、GitHub 和公共在线词典都没有找到这个词。')
      }
    } catch {
      try {
        const online = await lookupPublicDictionary(query)
        setRemoteResults(online.map((entry) => ({ entry, origin: 'online', count: 0 })))
      } catch { setNotice('网络查询失败，请检查网络连接。') }
    } finally { setRemoteSearching(false) }
  }

  const openLookupResult = (result: SearchResult) => {
    const key = normalizeWord(result.entry.word)
    const existing = words.find((word) => normalizeWord(word.word) === key)
    if (existing) {
      const count = exposureCount(existing) + 1
      setWords((items) => items.map((word) => word.id === existing.id ? {
        ...word,
        lookupCount: word.lookupCount + 1,
        dueDate: nextReviewDate(count),
        updatedAt: new Date().toISOString(),
      } : word))
      setSelectedWordId(existing.id)
      return
    }
    const now = new Date().toISOString()
    const created: WordRecord = {
      id: wordId(result.entry.word),
      word: result.entry.word,
      phonetic: result.entry.phonetic,
      meaning: result.entry.meaning,
      definition: result.entry.definition,
      example: '',
      exampleMeaning: '',
      lookupCount: 1,
      reciteCount: 0,
      dueDate: nextReviewDate(1),
      source: result.origin === 'online' ? 'manual' : 'ecdict',
      tags: result.entry.tags,
      createdAt: now,
      updatedAt: now,
    }
    setWords((items) => [created, ...items])
    setSelectedWordId(created.id)
  }

  const completeRecitation = () => {
    if (!currentWord) return
    const count = exposureCount(currentWord) + 1
    setWords((items) => items.map((word) => word.id === currentWord.id ? {
      ...word,
      reciteCount: word.reciteCount + 1,
      dueDate: nextReviewDate(count),
      updatedAt: new Date().toISOString(),
    } : word))
    setHistory((items) => {
      const exists = items.some((record) => record.date === today)
      return exists
        ? items.map((record) => record.date === today ? { ...record, recited: record.recited + 1 } : record)
        : [...items, { date: today, recited: 1 }]
    })
    setExtraQueue((items) => items.filter((id) => id !== currentWord.id))
    setShowAnswer(false)
  }

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (view !== 'study' || !currentWord || event.target instanceof HTMLInputElement) return
      if (event.code === 'Space') { event.preventDefault(); setShowAnswer((value) => !value) }
      if (event.code === 'Enter' && showAnswer) completeRecitation()
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  })

  const continueLearning = () => {
    const candidates = [...words].sort((left, right) => exposureCount(left) - exposureCount(right)).slice(0, 30).map((word) => word.id)
    setExtraQueue(candidates)
    setShowAnswer(false)
  }

  const importWordFile = async (file: File) => {
    const imported = await parseWordFile(file)
    const before = words.length
    const merged = mergeWordLists(words, imported)
    setWords(merged)
    setNotice(`读取 ${imported.length} 条，新增 ${merged.length - before} 条；重复单词保留原计数并自动合并。`)
    if (fileInput.current) fileInput.current.value = ''
  }

  const addWord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const term = String(data.get('word') || '').trim()
    const meaning = String(data.get('meaning') || '').trim()
    if (!term || !meaning) return
    const now = new Date().toISOString()
    const record: WordRecord = { id: wordId(term), word: term, phonetic: String(data.get('phonetic') || ''), meaning, definition: '', example: String(data.get('example') || ''), exampleMeaning: '', lookupCount: 0, reciteCount: 0, dueDate: today, source: 'manual', tags: ['自定义'], createdAt: now, updatedAt: now }
    setWords((items) => mergeWordLists(items, [record]))
    setAdding(false)
  }

  const importArchive = async () => {
    const result = await window.moraDesktop?.importArchive()
    if (!result) return
    if (result.error) { setNotice(result.error); return }
    if (!isArchive(result.data)) { setNotice('这不是有效的默记存档。'); return }
    const archivedWords = result.data.words
    setWords(archivedWords)
    setHistory(result.data.history)
    setSettings({ ...initialSettings, ...result.data.settings })
    setNotice(`已从 ${result.file} 导入 ${archivedWords.length} 个单词及其计数，正在核对 GitHub 词典…`)
    const localKeys = new Set(dictionary.map((entry) => normalizeWord(entry.word)))
    const missing = archivedWords.filter((word) => !localKeys.has(normalizeWord(word.word)))
    try {
      const resolved = await lookupGithubBatch(missing.map((word) => word.word))
      setWords((items) => items.map((word) => {
        const entry = resolved.get(normalizeWord(word.word))
        return entry ? {
          ...word,
          phonetic: word.phonetic || entry.phonetic,
          meaning: word.meaning || entry.meaning,
          definition: word.definition || entry.definition,
          tags: [...new Set([...word.tags, ...entry.tags])],
          updatedAt: new Date().toISOString(),
        } : word
      }))
      setNotice(`存档导入完成；${resolved.size} 个本地未缓存单词已从 GitHub 补全。`)
    } catch { setNotice('存档计数已导入；当前网络不可用，未缓存单词将在以后联网时补全。') }
  }

  const chooseArchiveFolder = async () => {
    if (!window.moraDesktop) return
    const info = await window.moraDesktop.chooseArchiveFolder()
    setArchiveInfo(info)
    const data: ArchiveData = { version: 2, updatedAt: new Date().toISOString(), words, history, settings }
    await window.moraDesktop.saveArchive(data)
    setNotice('已切换存档文件夹，当前数据将自动写入新位置。')
  }

  const useDefaultArchiveFolder = async () => {
    if (!window.moraDesktop) return
    const info = await window.moraDesktop.useDefaultArchiveFolder()
    setArchiveInfo(info)
    const data: ArchiveData = { version: 2, updatedAt: new Date().toISOString(), words, history, settings }
    await window.moraDesktop.saveArchive(data)
    setNotice('已恢复默认存档位置并写入当前数据。')
  }

  const categories = ['全部', '今日复习', '未背诵', '熟悉 8+', 'CET4', 'CET6', 'IELTS', 'TOEFL', 'GRE', '自定义', '导入']
  const libraryWords = useMemo(() => words.filter((word) => {
    const matchesSearch = !librarySearch || normalizeWord(word.word).includes(normalizeWord(librarySearch)) || word.meaning.includes(librarySearch)
    const matchesCategory = category === '全部'
      || (category === '今日复习' && word.dueDate <= today)
      || (category === '未背诵' && word.reciteCount === 0)
      || (category === '熟悉 8+' && exposureCount(word) >= 8)
      || (['CET4', 'CET6', 'IELTS', 'TOEFL', 'GRE'].includes(category) && word.tags.some((tag) => tag.toLowerCase() === category.toLowerCase()))
      || (category === '自定义' && word.source === 'manual')
      || (category === '导入' && word.source === 'import')
    return matchesSearch && matchesCategory
  }), [category, librarySearch, today, words])

  const speak = (term: string) => {
    speechSynthesis.cancel()
    const speech = new SpeechSynthesisUtterance(term)
    speech.lang = 'en-US'
    speech.rate = 0.82
    speechSynthesis.speak(speech)
  }

  if (!ready) return <div className="boot-screen"><span className="brand-mark">m</span><p>正在读取存档…</p></div>

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">m</span><span>默记</span></div>
      <nav>
        <button className={view === 'study' ? 'active' : ''} onClick={() => setView('study')}><Icon name="study"/>背单词</button>
        <button className={view === 'lookup' ? 'active' : ''} onClick={() => setView('lookup')}><Icon name="search"/>查单词</button>
        <button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><Icon name="book"/>单词目录<span>{words.length}</span></button>
        <button className={view === 'stats' ? 'active' : ''} onClick={() => setView('stats')}><Icon name="chart"/>统计与设置</button>
      </nav>
      <div className="goal-card"><small>今日目标</small><strong>{reviewedToday}<em> / {settings.dailyGoal}</em></strong><div><i style={{ width: `${Math.min(100, reviewedToday / settings.dailyGoal * 100)}%` }}/></div>{goalComplete && <b>目标已完成，可继续学习</b>}</div>
      <button className="theme-button" onClick={() => setDark((value) => !value)}><Icon name="moon"/>{dark ? '浅色模式' : '深色模式'}</button>
    </aside>

    <main>
      <header><div><p>{view.toUpperCase()}</p><h1>{view === 'study' ? '今日背诵' : view === 'lookup' ? '查单词' : view === 'library' ? '单词目录' : '统计与设置'}</h1></div><span>{new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())}</span></header>

      {view === 'study' && <section className="study-view">
        <div className="study-meta"><span>{goalComplete ? '今日目标已完成' : `距离目标还差 ${Math.max(0, settings.dailyGoal - reviewedToday)} 个`}</span><b>到期 {dueWords.length}</b></div>
        {currentWord ? <article className={`study-card ${showAnswer ? 'answer-visible' : ''}`}>
          <div className="card-label"><span>{extraQueue.length ? '继续学习' : currentWord.reciteCount ? '到期复习' : '新词'}</span><b>已看 {exposureCount(currentWord)} 次</b></div>
          <div className="term-header"><div><h2 style={currentWord.word.length > 20 ? { fontSize: '38px' } : undefined}>{currentWord.word}</h2><p>{currentWord.phonetic}</p></div><button onClick={() => speak(currentWord.word)} aria-label="播放发音"><Icon name="sound"/></button></div>
          {!showAnswer ? <button className="reveal" onClick={() => setShowAnswer(true)}>显示释义 <kbd>Space</kbd></button> : <div className="answer-panel">
            <h3>{currentWord.meaning}</h3>{currentWord.definition && <p className="definition">{currentWord.definition}</p>}{currentWord.example && <blockquote>{currentWord.example}<small>{currentWord.exampleMeaning}</small></blockquote>}
            <div className="counts"><span>查阅 <b>{currentWord.lookupCount}</b></span><span>背诵 <b>{currentWord.reciteCount}</b></span><span>总计 <b>{exposureCount(currentWord)}</b></span></div>
            <button className="primary complete" onClick={completeRecitation}>完成一次背诵 <small>下次 {intervalForExposure(exposureCount(currentWord) + 1)} 天后</small><kbd>Enter</kbd></button>
          </div>}
        </article> : <div className="empty-card"><span>✓</span><h2>当前复习已完成</h2><p>你仍然可以继续学习低接触次数的单词。</p><button className="primary" onClick={continueLearning}>继续背单词</button></div>}
      </section>}

      {view === 'lookup' && <section className="lookup-view">
        <form className="search-box" onSubmit={(event) => { event.preventDefault(); searchRemote() }}><Icon name="search"/><input value={query} onChange={(event) => { setQuery(event.target.value); setRemoteResults([]); setSelectedWordId(null) }} placeholder="输入英文单词或中文释义" autoFocus/><button type="submit">{remoteSearching ? '查询中…' : '联网查询'}</button></form>
        <div className={`dictionary-status ${dictionaryStatus}`}><i/><span>{dictionaryStatus === 'loading' ? `正在加载本地词典 ${dictionaryProgress.toLocaleString()} 词` : dictionaryStatus === 'error' ? '本地词典不可用，将直接联网查询' : `本地已缓存 ${dictionary.length.toLocaleString()} 词 · ${dictionaryStatus === 'cached' ? '离线缓存' : 'GitHub 已同步'}`}</span></div>
        {selectedWord ? <article className="lookup-card"><button className="back-button" onClick={() => setSelectedWordId(null)}><Icon name="back"/>返回结果</button><div className="term-header"><div><h2 style={selectedWord.word.length > 20 ? { fontSize: '34px' } : undefined}>{selectedWord.word}</h2><p>{selectedWord.phonetic}</p></div><button onClick={() => speak(selectedWord.word)} aria-label="播放发音"><Icon name="sound"/></button></div><h3>{selectedWord.meaning}</h3>{selectedWord.definition && <p className="definition">{selectedWord.definition}</p>}<div className="counts large"><span><b>{selectedWord.lookupCount}</b>查阅次数</span><span><b>{selectedWord.reciteCount}</b>背诵次数</span><span><b>{exposureCount(selectedWord)}</b>总次数</span></div><p className="saved-note">本次查阅已计数，预计 {selectedWord.dueDate} 复习</p></article>
        : query ? <div className="result-list">{visibleResults.map((result) => <button key={`${result.origin}-${result.entry.word}`} onClick={() => openLookupResult(result)}><span><b>{result.entry.word}</b><small>{result.entry.phonetic}</small></span><span>{result.entry.meaning.split('\n')[0]}</span><em>{result.origin === 'personal' ? `已看 ${result.count}` : result.origin === 'cache' ? '本地' : result.origin === 'github' ? 'GitHub' : '在线'}</em></button>)}{!visibleResults.length && !remoteSearching && <div className="no-result"><p>本地缓存中没有结果</p><button onClick={searchRemote}>从 GitHub 和在线词典查找</button></div>}</div>
        : <div className="lookup-intro"><Icon name="search"/><h2>三级词典查询</h2><p>先查本地缓存，未找到则查询 GitHub 大词典，最后使用公共在线词典。</p></div>}
      </section>}

      {view === 'library' && <section className="library-view">
        <div className="toolbar"><input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="搜索目录…"/><input ref={fileInput} hidden type="file" accept=".csv,.tsv,.txt" onChange={(event) => event.target.files?.[0] && importWordFile(event.target.files[0])}/><button onClick={() => fileInput.current?.click()}><Icon name="upload"/>导入词表</button><button className="primary" onClick={() => setAdding(true)}><Icon name="plus"/>添加单词</button></div>
        <div className="categories">{categories.map((item) => <button className={category === item ? 'active' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
        <div className="word-table"><div className="word-row head"><span>单词</span><span>释义</span><span>查阅 / 背诵</span><span>总计</span><span>下次复习</span></div>{libraryWords.map((word) => <div className="word-row" key={word.id}><span><b>{word.word}</b><small>{word.phonetic}</small></span><span>{word.meaning.split('\n')[0]}</span><span>{word.lookupCount} / {word.reciteCount}</span><span><i>{exposureCount(word)}</i></span><span>{word.dueDate <= today ? '今天' : word.dueDate}</span></div>)}</div>
      </section>}

      {view === 'stats' && <section className="stats-view">
        <div className="stats-grid"><div><small>个人单词</small><strong>{words.length}</strong><span>个</span></div><div><small>今日背诵</small><strong>{reviewedToday}</strong><span>次</span></div><div><small>累计接触</small><strong>{words.reduce((sum, word) => sum + exposureCount(word), 0)}</strong><span>次</span></div><div><small>熟悉单词</small><strong>{words.filter((word) => exposureCount(word) >= 8).length}</strong><span>总计 ≥ 8</span></div></div>
        <div className="settings-card"><h2>每日目标</h2><p>达到目标后仍可继续背诵。</p><div className="goal-options">{[10, 20, 30, 50, 100].map((goal) => <button className={settings.dailyGoal === goal ? 'active' : ''} onClick={() => setSettings((value) => ({ ...value, dailyGoal: goal }))} key={goal}>{goal}</button>)}</div></div>
        <div className="settings-card"><h2>存档位置</h2><p className="path">{archiveInfo?.file || '浏览器预览模式：使用 IndexedDB'}</p>{archiveInfo?.fallback && <p className="warning">程序目录不可写，已安全回退到用户数据目录。</p>}<div className="setting-actions"><button onClick={chooseArchiveFolder} disabled={!window.moraDesktop}><Icon name="folder"/>选择自定义文件夹</button><button onClick={importArchive} disabled={!window.moraDesktop}><Icon name="upload"/>导入存档</button>{archiveInfo?.custom && <button onClick={useDefaultArchiveFolder}>恢复默认位置</button>}</div></div>
        <div className="settings-card"><h2>本地词典缓存</h2><p>当前 {dictionary.length.toLocaleString()} 词。每次启动时都可重新选择。</p><button onClick={() => setStartupOpen(true)}>重新选择缓存量</button></div>
      </section>}
    </main>

    {startupOpen && <div className="startup-backdrop"><div className="startup-dialog"><div className="brand"><span className="brand-mark">m</span><span>默记</span></div><p className="eyebrow">LOCAL DICTIONARY</p><h2>这次要在本地保存多少词？</h2><p>常用词按实际语料频率分层。从 GitHub 同步后，即使断网也可以查询已缓存部分。</p><div className="cache-options">{CACHE_OPTIONS.map((option) => <button key={option.size} onClick={() => begin(option.size)} disabled={dictionaryStatus === 'loading'}><b>{option.label}</b><span>{option.hint}</span><small>{option.download}</small>{settings.cacheSize === option.size && <em>上次选择</em>}</button>)}</div>{dictionaryStatus === 'loading' && <div className="startup-progress"><i/><span>正在同步，已读取 {dictionaryProgress.toLocaleString()} 词…</span></div>}{startupError && <div className="startup-error">{startupError}<button onClick={() => setStartupOpen(false)}>暂不加载，进入应用</button></div>}</div></div>}

    {adding && <div className="modal-backdrop" onMouseDown={() => setAdding(false)}><form className="modal" onSubmit={addWord} onMouseDown={(event) => event.stopPropagation()}><h2>添加单词</h2><label>单词<input name="word" required autoFocus/></label><label>音标<input name="phonetic"/></label><label>中文释义<input name="meaning" required/></label><label>例句<input name="example"/></label><div><button type="button" onClick={() => setAdding(false)}>取消</button><button className="primary" type="submit">保存</button></div></form></div>}
    {notice && <div className="toast" onClick={() => setNotice('')}>{notice}<button>×</button></div>}
  </div>
}

export default App
