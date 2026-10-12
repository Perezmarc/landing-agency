import { describe, it, expect } from 'vitest'
import { selectTier } from './tier.js'

describe('the motion tier', () => {
  it('turns motion and media off for reduced motion', () => {
    expect(selectTier({ reducedMotion: true, finePointer: true, cores: 16 })).toEqual({ motion: false, media: false })
  })
  it('keeps motion but requests no media on Save-Data or 2g', () => {
    expect(selectTier({ saveData: true, cores: 16, finePointer: true })).toEqual({ motion: true, media: false })
    expect(selectTier({ effectiveType: '2g', cores: 8 })).toEqual({ motion: true, media: false })
  })
  it('plays the clips on a capable device', () => {
    expect(selectTier({ finePointer: true, cores: 8, memory: 2 })).toEqual({ motion: true, media: true })
    expect(selectTier({ cores: 4, memory: 4 })).toEqual({ motion: true, media: true })
  })
  it('keeps a weak device on posters', () => {
    expect(selectTier({ cores: 2, memory: 2 })).toEqual({ motion: true, media: false })
  })
})
