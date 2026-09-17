# 默记 · Word Memorizer

一个专注、纯粹的背单词应用。当前版本是可在电脑浏览器中运行的 MVP，支持闪卡学习、间隔复习、本地词库和学习统计。

## 功能

- 单词闪卡与中英文例句
- 按“查阅次数 + 背诵次数”记录每个单词的接触次数
- 根据接触次数自动安排由密到疏的复习间隔
- 独立查词页，打开查询结果即自动计数
- TXT、CSV、TSV 词库导入
- 空格翻面、回车完成背诵
- 添加、搜索和浏览单词
- 本地持久化学习记录
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

React、TypeScript、Vite、Electron。

## 导入格式

每行一个单词，字段使用逗号或 Tab 分隔：

```text
word,中文释义,音标,英文例句
```

## License

MIT
