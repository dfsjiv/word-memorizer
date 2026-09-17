type ArchiveInfo = { folder: string; file: string; custom: boolean; fallback: boolean }

interface Window {
  moraDesktop?: {
    archiveInfo: () => Promise<ArchiveInfo>
    loadArchive: () => Promise<{ data: unknown; info: ArchiveInfo }>
    saveArchive: (data: unknown) => Promise<ArchiveInfo>
    chooseArchiveFolder: () => Promise<ArchiveInfo>
    useDefaultArchiveFolder: () => Promise<ArchiveInfo>
    importArchive: () => Promise<{ data?: unknown; file?: string; error?: string } | null>
  }
}
