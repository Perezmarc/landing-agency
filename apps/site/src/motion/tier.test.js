import { describe, it, expect } from 'vitest'
import { selectTier } from './tier.js'

describe('the motion tier', () => {
  it('turns everything off for reduced motion', () => {
    expect(selectTier({ reducedMotion: true, webgl2: true, finePointer: true, cores: 16 })).toMatchObject({ motion: false, media: false, particles: 0 })
  })
  it('keeps motion but requests no media on Save-Data or 2g', () => {
    expect(selectTier({ saveData: true, webgl2: true, cores: 16, finePointer: true })).toMatchObject({ motion: true, media: false, particles: 0 })
    expect(selectTier({ effectiveType: '2g', webgl2: true, cores: 8 })).toMatchObject({ media: false, particles: 0 })
  })
  it('gives a fine-pointer desktop 8k particles at DPR 2', () => {
    expect(selectTier({ webgl2: true, finePointer: true, cores: 8 })).toMatchObject({ media: true, particles: 8000, dpr: 2 })
  })
  it('gives a mid device 3k particles at DPR 1.5', () => {
    expect(selectTier({ webgl2: true, cores: 4, memory: 4 })).toMatchObject({ media: true, particles: 3000, dpr: 1.5 })
  })
  it('runs videos with no particles without WebGL2', () => {
    expect(selectTier({ webgl2: false, finePointer: true, cores: 8 })).toMatchObject({ media: true, particles: 0 })
  })
  it('keeps a weak device on posters', () => {
    expect(selectTier({ webgl2: true, cores: 2, memory: 2 })).toMatchObject({ media: false, particles: 0 })
  })
})
