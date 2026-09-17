import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type View = 'study' | 'words' | 'stats'
type Rating = 'again' | 'hard' | 'good' | 'easy'

type Word = {
  id: string
  word: string
  phonetic: string
  meaning: string
  example: string
  exampleMeaning: string
  interval: number
  due: string
  reviews: number
}

type DailyRecord = { date: string; reviewed: number }

const DAY = 86_400_000
const today = () => new Date().toISOString().slice(0, 10)

const addDays = (days: number) => {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const starterWords: Word[] = [
  { id: 'serendipity', word: 'serendipity', phonetic: '/ˌserənˈdɪpəti/', meaning: 'n. 意外发现美好事物的运气', example: 'We met by pure serendipity.', exampleMeaning: '我们的相遇纯属美好的偶然。', interval: 0, due: today(), reviews: 0 },
  { id: 'resilient', word: 'resilient', phonetic: '/rɪˈzɪliənt/', meaning: 'adj. 有韧性的；能迅速恢复的', example: 'Children are often remarkably resilient.', exampleMeaning: '孩子往往有着惊人的适应力。', interval: 0, due: today(), reviews: 0 },
  { id: 'eloquent', word: 'eloquent', phonetic: '/ˈeləkwənt/', meaning: 'adj. 雄辩的；有说服力的', example: 'She gave an eloquent speech.', exampleMeaning: '她发表了一场富有说服力的演讲。', interval: 0, due: today(), reviews: 0 },
  { id: 'meticulous', word: 'meticulous', phonetic: '/məˈtɪkjələs/', meaning: 'adj. 一丝不苟的；细致的', example: 'He kept meticulous records.', exampleMeaning: '他保存了十分细致的记录。', interval: 0, due: today(), reviews: 0 },
  { id: 'ambiguous', word: 'ambiguous', phonetic: '/æmˈbɪɡjuəs/', meaning: 'adj. 模棱两可的；含糊的', example: 'The ending of the story is ambiguous.', exampleMeaning: '这个故事的结局模棱两可。', interval: 0, due: today(), reviews: 0 },
  { id: 'pragmatic', word: 'pragmatic', phonetic: '/præɡˈmætɪk/', meaning: 'adj. 务实的；讲求实效的', example: 'We need a pragmatic solution.', exampleMeaning: '我们需要一个务实的解决方案。', interval: 0, due: today(), reviews: 0 },
  { id: 'ubiquitous', word: 'ubiquitous', phonetic: '/juːˈbɪkwɪtəs/', meaning: 'adj. 无处不在的', example: 'Smartphones have become ubiquitous.', exampleMeaning: '智能手机已经无处不在。', interval: 0, due: today(), reviews: 0 },
  { id: 'concise', word: 'concise', phonetic: '/kənˈsaɪs/', meaning: 'adj. 简明的；简洁的', example: 'Keep your answer clear and concise.', exampleMeaning: '让你的回答清楚而简洁。', interval: 0, due: today(), reviews: 0 },
  { id: 'intricate', word: 'intricate', phonetic: '/ˈɪntrɪkət/', meaning: 'adj. 错综复杂的；精细的', example: 'The watch has an intricate mechanism.', exampleMeaning: '这块手表有精密复杂的机械结构。', interval: 0, due: today(), reviews: 0 },
  { id: 'tranquil', word: 'tranquil', phonetic: '/ˈtræŋkwɪl/', meaning: 'adj. 宁静的；平静的', example: 'The garden was quiet and tranquil.', exampleMeaning: '花园安静而宁谧。', interval: 0, due: today(), reviews: 0 },
]

const loadWords = (): Word[] => {
  try {
    const saved = localStorage.getItem('mora-words')
    return saved ? JSON.parse(saved) : starterWords
  } catch { return starterWords }
}

const loadHistory = (): DailyRecord[] => {
  try { return JSON.parse(localStorage.getItem('mora-history') || '[]') }
  catch { return [] }
}

const Icon = ({ name }: { name: 'home' | 'book' | 'chart' | 'plus' | 'volume' | 'sun' }) => {
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/></>,
    book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v16H7.5A3.5 3.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 6h8M8 10h7"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    volume: <><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></>,
  }
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function App() {
  const [words, setWords] = useState<Word[]>(loadWords)
  const [history, setHistory] = useState<DailyRecord[]>(loadHistory)
  const [view, setView] = useState<View>('study')
  const [showAnswer, setShowAnswer] = useState(false)
  const [queue, setQueue] = useState<string[]>(() => loadWords().filter((word) => word.due <= today()).slice(0, 10).map((word) => word.id))
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('mora-theme') === 'dark')

  useEffect(() => localStorage.setItem('mora-words', JSON.stringify(words)), [words])
  useEffect(() => localStorage.setItem('mora-history', JSON.stringify(history)), [history])
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('mora-theme', dark ? 'dark' : 'light')
  }, [dark])

  const currentWord = words.find((word) => word.id === queue[0])
  const reviewedToday = history.find((item) => item.date === today())?.reviewed || 0
  const dueCount = words.filter((word) => word.due <= today()).length
  const learnedCount = words.filter((word) => word.reviews > 0).length
  const masteredCount = words.filter((word) => word.interval >= 14).length
  const progress = Math.min(100, Math.round((reviewedToday / 10) * 100))

  const filteredWords = useMemo(() => {
    const query = search.trim().toLowerCase()
    return words.filter((word) => !query || word.word.toLowerCase().includes(query) || word.meaning.includes(query))
  }, [words, search])

  const speak = (text: string) => {
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.82
    speechSynthesis.speak(utterance)
  }

  const rateWord = (rating: Rating) => {
    if (!currentWord) return
    const previous = currentWord.interval
    const intervals: Record<Rating, number> = {
      again: 0,
      hard: 1,
      good: previous === 0 ? 2 : Math.max(2, Math.round(previous * 2.2)),
      easy: previous === 0 ? 4 : Math.max(4, Math.round(previous * 3.2)),
    }
    const nextInterval = intervals[rating]
    setWords((items) => items.map((word) => word.id === currentWord.id
      ? { ...word, interval: nextInterval, due: addDays(nextInterval), reviews: word.reviews + 1 }
      : word))
    setHistory((items) => {
      const existing = items.find((item) => item.date === today())
      return existing
        ? items.map((item) => item.date === today() ? { ...item, reviewed: item.reviewed + 1 } : item)
        : [...items, { date: today(), reviewed: 1 }]
    })
    setQueue((items) => rating === 'again' ? [...items.slice(1), items[0]] : items.slice(1))
    setShowAnswer(false)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (view !== 'study' || !currentWord || event.target instanceof HTMLInputElement) return
      if (event.code === 'Space') {
        event.preventDefault()
        setShowAnswer((value) => !value)
      }
      if (showAnswer) {
        const keys: Record<string, Rating> = { Digit1: 'again', Digit2: 'hard', Digit3: 'good', Digit4: 'easy' }
        if (keys[event.code]) rateWord(keys[event.code])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const addWord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const wordText = String(data.get('word') || '').trim()
    const meaning = String(data.get('meaning') || '').trim()
    if (!wordText || !meaning) return
    const newWord: Word = {
      id: `${wordText.toLowerCase()}-${Date.now()}`,
      word: wordText,
      phonetic: String(data.get('phonetic') || ''),
      meaning,
      example: String(data.get('example') || ''),
      exampleMeaning: '', interval: 0, due: today(), reviews: 0,
    }
    setWords((items) => [newWord, ...items])
    setQueue((items) => [newWord.id, ...items])
    setAdding(false)
  }

  const startMore = () => {
    setQueue(words.filter((word) => word.due <= today()).slice(0, 10).map((word) => word.id))
    setShowAnswer(false)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">m</span><span>默记</span></div>
        <nav>
          <button className={view === 'study' ? 'active' : ''} onClick={() => setView('study')}><Icon name="home" />今日学习</button>
          <button className={view === 'words' ? 'active' : ''} onClick={() => setView('words')}><Icon name="book" />我的词库<span className="nav-count">{words.length}</span></button>
          <button className={view === 'stats' ? 'active' : ''} onClick={() => setView('stats')}><Icon name="chart" />学习统计</button>
        </nav>
        <div className="sidebar-card">
          <span>今日目标</span><strong>{reviewedToday}<small> / 10</small></strong>
          <div className="mini-progress"><i style={{ width: `${progress}%` }} /></div>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setDark((value) => !value)}><Icon name="sun" />{dark ? '浅色模式' : '深色模式'}</button>
          <div className="profile"><span>W</span><div><b>学习者</b><small>坚持积累</small></div></div>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <p>{view === 'study' ? 'TODAY' : view === 'words' ? 'VOCABULARY' : 'PROGRESS'}</p>
            <h1>{view === 'study' ? '今日学习' : view === 'words' ? '我的词库' : '学习统计'}</h1>
          </div>
          <div className="header-date">{new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())}</div>
        </header>

        {view === 'study' && (
          <section className="study-view">
            <div className="session-line">
              <span>今日进度</span><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><b>{reviewedToday} / 10</b>
            </div>
            {currentWord ? (
              <div className={`flashcard ${showAnswer ? 'revealed' : ''}`}>
                <div className="card-top"><span>{currentWord.reviews === 0 ? '新词' : `复习 · 第 ${currentWord.reviews + 1} 次`}</span><span>剩余 {queue.length}</span></div>
                <div className="word-area">
                  <button className="sound-button" onClick={() => speak(currentWord.word)} aria-label="播放发音"><Icon name="volume" /></button>
                  <h2>{currentWord.word}</h2><p>{currentWord.phonetic}</p>
                </div>
                {!showAnswer ? (
                  <button className="reveal-button" onClick={() => setShowAnswer(true)}>显示答案 <kbd>Space</kbd></button>
                ) : (
                  <div className="answer-area">
                    <div className="divider"><span>释义</span></div>
                    <h3>{currentWord.meaning}</h3>
                    {currentWord.example && <blockquote><p>{currentWord.example}</p><small>{currentWord.exampleMeaning}</small></blockquote>}
                    <p className="rating-label">你记得怎么样？</p>
                    <div className="rating-buttons">
                      <button className="again" onClick={() => rateWord('again')}><b>忘记了</b><span>稍后</span><kbd>1</kbd></button>
                      <button onClick={() => rateWord('hard')}><b>有点难</b><span>1 天</span><kbd>2</kbd></button>
                      <button className="good" onClick={() => rateWord('good')}><b>记住了</b><span>{currentWord.interval === 0 ? 2 : Math.max(2, Math.round(currentWord.interval * 2.2))} 天</span><kbd>3</kbd></button>
                      <button onClick={() => rateWord('easy')}><b>很简单</b><span>{currentWord.interval === 0 ? 4 : Math.max(4, Math.round(currentWord.interval * 3.2))} 天</span><kbd>4</kbd></button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <span className="done-mark">✓</span><h2>今天完成了</h2><p>做得不错，让记忆休息一下吧。</p>
                {dueCount > 0 && <button className="primary-button" onClick={startMore}>再学一组</button>}
              </div>
            )}
            <p className="keyboard-tip">按 <kbd>Space</kbd> 查看答案，使用 <kbd>1</kbd> — <kbd>4</kbd> 选择记忆程度</p>
          </section>
        )}

        {view === 'words' && (
          <section className="words-view">
            <div className="toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索单词或释义…" /><button className="primary-button" onClick={() => setAdding(true)}><Icon name="plus" />添加单词</button></div>
            <div className="word-table">
              <div className="table-row table-head"><span>单词</span><span>释义</span><span>下次复习</span><span>次数</span></div>
              {filteredWords.map((word) => <div className="table-row" key={word.id}><span><b>{word.word}</b><small>{word.phonetic}</small></span><span>{word.meaning}</span><span>{word.due <= today() ? '今天' : word.due}</span><span>{word.reviews}</span></div>)}
            </div>
          </section>
        )}

        {view === 'stats' && (
          <section className="stats-view">
            <div className="stat-grid">
              <div><span>词库总量</span><strong>{words.length}</strong><small>个单词</small></div><div><span>已经学习</span><strong>{learnedCount}</strong><small>个单词</small></div><div><span>熟练掌握</span><strong>{masteredCount}</strong><small>间隔 ≥ 14 天</small></div><div><span>累计复习</span><strong>{history.reduce((sum, item) => sum + item.reviewed, 0)}</strong><small>次回忆</small></div>
            </div>
            <div className="activity-card"><div><h2>最近学习</h2><p>每一次主动回忆都在加深记忆。</p></div><div className="activity-bars">
              {Array.from({ length: 14 }).map((_, index) => { const date = new Date(new Date(`${today()}T12:00:00`).getTime() - (13 - index) * DAY).toISOString().slice(0, 10); const count = history.find((item) => item.date === date)?.reviewed || 0; return <i key={date} title={`${date}: ${count} 次`} style={{ height: `${Math.max(8, Math.min(100, count * 9))}%` }} /> })}
            </div></div>
          </section>
        )}
      </main>

      {adding && <div className="modal-backdrop" onMouseDown={() => setAdding(false)}><form className="modal" onSubmit={addWord} onMouseDown={(event) => event.stopPropagation()}>
        <div><p>NEW WORD</p><h2>添加单词</h2></div><label>单词<input name="word" autoFocus required placeholder="例如：deliberate" /></label><label>音标<input name="phonetic" placeholder="/dɪˈlɪbərət/" /></label><label>释义<input name="meaning" required placeholder="adj. 深思熟虑的" /></label><label>例句<input name="example" placeholder="输入一个简短例句" /></label><div className="modal-actions"><button type="button" onClick={() => setAdding(false)}>取消</button><button className="primary-button" type="submit">保存单词</button></div>
      </form></div>}
    </div>
  )
}

export default App
