import type { WordRecord } from './domain'
import { localDate } from './scheduler'

const now = new Date().toISOString()

const data = [
  ['resilient', '/rɪˈzɪliənt/', 'adj. 有韧性的；能迅速恢复的', 'Children are often remarkably resilient.', '孩子往往有着惊人的适应力。'],
  ['eloquent', '/ˈeləkwənt/', 'adj. 雄辩的；有说服力的', 'She gave an eloquent speech.', '她发表了一场富有说服力的演讲。'],
  ['meticulous', '/məˈtɪkjələs/', 'adj. 一丝不苟的；细致的', 'He kept meticulous records.', '他保存了十分细致的记录。'],
  ['ambiguous', '/æmˈbɪɡjuəs/', 'adj. 模棱两可的；含糊的', 'The ending of the story is ambiguous.', '这个故事的结局模棱两可。'],
  ['pragmatic', '/præɡˈmætɪk/', 'adj. 务实的；讲求实效的', 'We need a pragmatic solution.', '我们需要一个务实的解决方案。'],
] as const

export const starterWords: WordRecord[] = data.map(([word, phonetic, meaning, example, exampleMeaning]) => ({
  id: `word:${word}`,
  word,
  phonetic,
  meaning,
  definition: '',
  example,
  exampleMeaning,
  lookupCount: 0,
  reciteCount: 0,
  dueDate: localDate(),
  source: 'starter',
  tags: ['核心'],
  createdAt: now,
  updatedAt: now,
}))
