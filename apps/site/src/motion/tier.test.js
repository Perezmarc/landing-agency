import { describe, it, expect } from 'vitest'
import { selectTier } from './tier.js'

describe('the motion tier', () => {
  it('turns motion and media off for reduced motion', () => {
    expect(selectTier({ reducedMotion: true, memory: 16 })).toEqual({ motion: false, media: false })
  })
  it('keeps motion but requests no media on Save-Data or 2g', () => {
    expect(selectTier({ saveData: true, memory: 16 })).toEqual({ motion: true, media: false })
    expect(selectTier({ effectiveType: '2g', memory: 8 })).toEqual({ motion: true, media: false })
    expect(selectTier({ effectiveType: 'slow-2g' })).toEqual({ motion: true, media: false })
  })
  it('plays the clips when the browser reports no memory (Safari, Firefox: an iPhone)', () => {
    expect(selectTier({})).toEqual({ motion: true, media: true })
    expect(selectTier({ memory: undefined, effectiveType: '4g' })).toEqual({ motion: true, media: true })
  })
  it('plays the clips on a device that reports enough memory', () => {
    expect(selectTier({ memory: 4 })).toEqual({ motion: true, media: true })
    expect(selectTier({ memory: 8, effectiveType: '3g' })).toEqual({ motion: true, media: true })
  })
  it('keeps a device that reports under 4 GB on posters', () => {
    expect(selectTier({ memory: 2 })).toEqual({ motion: true, media: false })
    expect(selectTier({ memory: 0.5 })).toEqual({ motion: true, media: false })
  })
})
