export const GAME_SOUND_SOURCES = {
  tap: '/audio/ui-tap.wav',
  confirm: '/audio/action-confirm.wav',
  time: '/audio/time-shift.wav',
  brief: '/audio/world-brief.wav',
  alert: '/audio/critical-alert.wav',
} as const

export type GameSound = keyof typeof GAME_SOUND_SOURCES

type AudioLike = {
  currentTime: number
  preload: string
  volume: number
  play: () => Promise<unknown> | unknown
}

type AudioFactory = (source: string) => AudioLike | null

const VOLUME: Record<GameSound, number> = {
  tap: .18,
  confirm: .28,
  time: .2,
  brief: .25,
  alert: .3,
}

const THROTTLE_MS: Record<GameSound, number> = {
  tap: 45,
  confirm: 180,
  time: 80,
  brief: 450,
  alert: 600,
}

const browserAudioFactory: AudioFactory = (source) => {
  if (typeof Audio === 'undefined') return null
  return new Audio(source)
}

/** Small, failure-tolerant game audio bus. Browser autoplay rejection never blocks gameplay. */
export class GameAudio {
  private readonly audio = new Map<GameSound, AudioLike>()
  private readonly lastPlayedAt = new Map<GameSound, number>()
  private enabled = true

  constructor(
    private readonly factory: AudioFactory = browserAudioFactory,
    private readonly now: () => number = () => Date.now(),
  ) {}

  preload() {
    for (const sound of Object.keys(GAME_SOUND_SOURCES) as GameSound[]) this.get(sound)
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  isEnabled() {
    return this.enabled
  }

  play(sound: GameSound) {
    if (!this.enabled) return false
    const now = this.now()
    const lastPlayedAt = this.lastPlayedAt.get(sound) ?? -Infinity
    if (now - lastPlayedAt < THROTTLE_MS[sound]) return false
    const audio = this.get(sound)
    if (!audio) return false
    this.lastPlayedAt.set(sound, now)
    audio.currentTime = 0
    const result = audio.play()
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      void (result as Promise<unknown>).catch(() => undefined)
    }
    return true
  }

  private get(sound: GameSound) {
    const cached = this.audio.get(sound)
    if (cached) return cached
    const audio = this.factory(GAME_SOUND_SOURCES[sound])
    if (!audio) return null
    audio.preload = 'auto'
    audio.volume = VOLUME[sound]
    this.audio.set(sound, audio)
    return audio
  }
}
