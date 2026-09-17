const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const settingsFile = () => path.join(app.getPath('userData'), 'archive-settings.json')

const readSettings = () => {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }
  catch { return {} }
}

const writeSettings = (settings) => {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true })
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), 'utf8')
}

const writableDefaultFolder = () => {
  const besideApp = path.join(path.dirname(app.getPath('exe')), 'data')
  try {
    fs.mkdirSync(besideApp, { recursive: true })
    fs.accessSync(besideApp, fs.constants.W_OK)
    return { folder: besideApp, fallback: false }
  } catch {
    const fallback = path.join(app.getPath('userData'), 'data')
    fs.mkdirSync(fallback, { recursive: true })
    return { folder: fallback, fallback: true }
  }
}

const archiveInfo = () => {
  const customFolder = readSettings().archiveFolder
  const selected = customFolder ? { folder: customFolder, fallback: false } : writableDefaultFolder()
  return { ...selected, custom: Boolean(customFolder), file: path.join(selected.folder, 'mora-archive.json') }
}

const registerArchiveHandlers = () => {
  ipcMain.handle('archive:info', () => archiveInfo())
  ipcMain.handle('archive:load', () => {
    const info = archiveInfo()
    try { return { data: JSON.parse(fs.readFileSync(info.file, 'utf8')), info } }
    catch { return { data: null, info } }
  })
  ipcMain.handle('archive:save', (_event, data) => {
    const info = archiveInfo()
    fs.mkdirSync(info.folder, { recursive: true })
    const temporary = `${info.file}.tmp`
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), 'utf8')
    fs.renameSync(temporary, info.file)
    return info
  })
  ipcMain.handle('archive:choose-folder', async () => {
    const selection = await dialog.showOpenDialog({ title: '选择默记存档文件夹', properties: ['openDirectory', 'createDirectory'] })
    if (selection.canceled || !selection.filePaths[0]) return archiveInfo()
    writeSettings({ ...readSettings(), archiveFolder: selection.filePaths[0] })
    return archiveInfo()
  })
  ipcMain.handle('archive:use-default', () => {
    const settings = readSettings()
    delete settings.archiveFolder
    writeSettings(settings)
    return archiveInfo()
  })
  ipcMain.handle('archive:import', async () => {
    const selection = await dialog.showOpenDialog({ title: '导入默记存档', properties: ['openFile'], filters: [{ name: '默记存档', extensions: ['json'] }] })
    if (selection.canceled || !selection.filePaths[0]) return null
    try { return { data: JSON.parse(fs.readFileSync(selection.filePaths[0], 'utf8')), file: selection.filePaths[0] } }
    catch { return { error: '无法读取这个存档文件。' } }
  })
}

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#f4f1eb',
    title: '默记',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  registerArchiveHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
