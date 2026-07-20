import { describe, expect, it, vi } from 'vitest'
import { GAME_SOUND_SOURCES, GameAudio } from './sound'

const createAudioHarness = () => {
  const instances: Array<{ source: string; currentTime: number; preload: string; volume: number; play: ReturnType<typeof vi.fn> }> = []
  const factory = (source: string) => {
    const audio = { source, currentTime: 17, preload: '', volume: 1, play: vi.fn(() => Promise.resolve()) }
    instances.push(audio)
    return audio
  }
  return { factory, instances }
}

describe('GameAudio', () => {
  it('preloads every licensed cue and plays the requested cue from the beginning', () => {
    const { factory, instances } = createAudioHarness()
    const audio = new GameAudio(factory, () => 1_000)
    audio.preload()

    expect(instances).toHaveLength(Object.keys(GAME_SOUND_SOURCES).length)
    expect(audio.play('confirm')).toBe(true)
    const confirm = instances.find((instance) => instance.source === GAME_SOUND_SOURCES.confirm)!
    expect(confirm.preload).toBe('auto')
    expect(confirm.currentTime).toBe(0)
    expect(confirm.volume).toBeLessThan(.4)
    expect(confirm.play).toHaveBeenCalledOnce()
  })

  it('respects mute and throttles repeated cues', () => {
    const { factory, instances } = createAudioHarness()
    let now = 2_000
    const audio = new GameAudio(factory, () => now)

    expect(audio.play('tap')).toBe(true)
    expect(audio.play('tap')).toBe(false)
    now += 50
    expect(audio.play('tap')).toBe(true)
    audio.setEnabled(false)
    expect(audio.play('time')).toBe(false)
    expect(instances.find((instance) => instance.source === GAME_SOUND_SOURCES.tap)?.play).toHaveBeenCalledTimes(2)
  })

  it('does nothing outside a browser when no audio factory is available', () => {
    const audio = new GameAudio(() => null)
    expect(audio.play('alert')).toBe(false)
  })
})
