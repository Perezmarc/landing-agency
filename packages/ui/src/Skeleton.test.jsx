import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Skeleton, { SkeletonText, SkeletonCircle, SkeletonButton, SkeletonGroup } from './Skeleton'

describe('Skeleton', () => {
  it('renders a block with the base class, hidden from assistive tech', () => {
    const { container } = render(<Skeleton />)
    const block = container.querySelector('.sk')
    expect(block).toBeInTheDocument()
    // Blocks are decorative; <SkeletonGroup> does the announcing.
    expect(block).toHaveAttribute('aria-hidden', 'true')
  })

  it('passes numeric dimensions through as px custom properties', () => {
    const { container } = render(<Skeleton w={120} h={14} radius={4} />)
    const block = container.querySelector('.sk')
    expect(block.style.getPropertyValue('--sk-w')).toBe('120px')
    expect(block.style.getPropertyValue('--sk-h')).toBe('14px')
    expect(block.style.getPropertyValue('--sk-r')).toBe('4px')
  })

  it('passes CSS length strings through untouched', () => {
    const { container } = render(<Skeleton w="60%" h="2rem" />)
    const block = container.querySelector('.sk')
    expect(block.style.getPropertyValue('--sk-w')).toBe('60%')
    expect(block.style.getPropertyValue('--sk-h')).toBe('2rem')
  })

  it('omits a custom property that was not given', () => {
    const { container } = render(<Skeleton h={10} />)
    expect(container.querySelector('.sk').style.getPropertyValue('--sk-w')).toBe('')
  })

  it('applies shape, tone and grow modifiers', () => {
    const { container } = render(<Skeleton shape="pill" tone="ink" grow />)
    expect(container.querySelector('.sk')).toHaveClass('sk--pill', 'sk--ink', 'sk--grow')
  })

  it('shortens the last line of a paragraph so it reads as prose', () => {
    const { container } = render(<SkeletonText lines={3} lastW="40%" />)
    const blocks = container.querySelectorAll('.sk')
    expect(blocks).toHaveLength(3)
    expect(blocks[2].style.getPropertyValue('--sk-w')).toBe('40%')
    expect(blocks[0].style.getPropertyValue('--sk-w')).toBe('100%')
  })

  it('does not shorten a single-line paragraph', () => {
    const { container } = render(<SkeletonText lines={1} />)
    expect(container.querySelector('.sk').style.getPropertyValue('--sk-w')).toBe('100%')
  })

  it('sizes a circle equally on both axes', () => {
    const { container } = render(<SkeletonCircle size={40} />)
    const block = container.querySelector('.sk')
    expect(block).toHaveClass('sk--circle')
    expect(block.style.getPropertyValue('--sk-w')).toBe('40px')
    expect(block.style.getPropertyValue('--sk-h')).toBe('40px')
  })

  it('renders a button-shaped block', () => {
    const { container } = render(<SkeletonButton />)
    expect(container.querySelector('.sk')).toHaveClass('sk--strong')
  })

  it('announces a loading region once, with a label', () => {
    render(<SkeletonGroup label="Loading projects"><Skeleton /></SkeletonGroup>)
    const region = screen.getByRole('status', { name: 'Loading projects' })
    expect(region).toHaveAttribute('aria-busy', 'true')
  })
})
