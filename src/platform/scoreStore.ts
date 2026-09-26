const KEY = 'nai-run-save-v1'

interface SaveData {
  version: 1
  bestScore: number
  muted: boolean
}

const fallback: SaveData = { version: 1, bestScore: 0, muted: false }

function read(): SaveData {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SaveData> | null
    if (saved?.version === 1 && Number.isFinite(saved.bestScore)) {
      return {
        version: 1,
        bestScore: Math.max(0, Math.floor(saved.bestScore ?? 0)),
        muted: Boolean(saved.muted),
      }
    }
  } catch {
    // Private browsing and disabled storage should not prevent a run.
  }
  return { ...fallback }
}

function write(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Keeping the current session playable matters more than persistence.
  }
}

export const scoreStore = {
  best(): number {
    return read().bestScore
  },
  record(score: number): number {
    const data = read()
    if (score > data.bestScore) {
      data.bestScore = Math.floor(score)
      write(data)
    }
    return data.bestScore
  },
  muted(): boolean {
    return read().muted
  },
  setMuted(muted: boolean): void {
    write({ ...read(), muted })
  },
}
