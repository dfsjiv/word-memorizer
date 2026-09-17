# 默记 · Word Memorizer

一个专注、纯粹的 Windows 背单词应用。个人学习记录与词典数据分离，支持分层离线词典、三级联网查词和可迁移存档。

## 功能

- 单词闪卡与中英文例句
- 按“查阅次数 + 背诵次数”记录每个单词的接触次数
- 根据接触次数自动安排由密到疏的复习间隔
- 独立查词页，打开查询结果即自动计数
- 按频率选择本地缓存 3,000 / 10,000 / 30,000 / 100,000 词
- 本地缓存 → GitHub ECDICT 大词典 → 公共在线词典三级查询
- GitHub 字母分片覆盖约 76 万条英中词条
- TXT、CSV、TSV 词库导入
- 重复导入按标准化拼写合并，已有计数不会重置
- 空格翻面、回车完成背诵
- 添加、搜索和浏览单词
- 可调整每日目标，完成后仍可继续学习
- 按复习状态、熟悉度和 CET4/CET6/IELTS/TOEFL/GRE 分类
- 自动 JSON 存档、自定义存档文件夹及存档导入
- 学习统计与深色模式

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

启动桌面版：

```bash
npm run desktop
```

生成 Windows 安装程序：

```bash
npm run package:win
```

## 技术栈

React、TypeScript、Vite、Electron、IndexedDB。

## 词典数据

英中词典数据来自 [ECDICT](https://github.com/skywind3000/ECDICT)，按 MIT License 使用。仓库中的 `dictionary/` 包含频率分层文件、远程查询分片、来源说明和上游许可证。

公共在线兜底查询使用 [Free Dictionary API](https://dictionaryapi.dev/)，该层主要提供英文释义。

## 导入格式

支持带表头的 CSV/TSV，也支持每行一个单词的简易格式：

```text
word,中文释义,音标,英文例句
```

同一个单词重复出现时只保留一条个人记录，查阅次数和背诵次数不会因导入而增加或重置。

## 存档

桌面版默认尝试在程序所在目录的 `data/mora-archive.json` 保存存档；如果目录不可写，会回退到 Electron 用户数据目录。可在“统计与设置”中选择自定义文件夹或导入已有 JSON 存档。

## License

MIT
