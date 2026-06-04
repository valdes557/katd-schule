import { describe, it, expect } from 'vitest'
import { cn, formatNumber, formatCurrency, formatDate, getInitials } from './utils'

// ── cn (className merger) ────────────────────────────────────────────
describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('handles conditional classes via clsx syntax', () => {
    expect(cn('base', false && 'hidden', 'extra')).toBe('base extra')
  })

  it('deduplicates conflicting tailwind classes', () => {
    const result = cn('px-2', 'px-4')
    expect(result).toBe('px-4')
  })

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('')
  })
})

// ── formatNumber ─────────────────────────────────────────────────────
describe('formatNumber', () => {
  it('returns plain string for numbers < 1000', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(999)).toBe('999')
  })

  it('formats thousands with "K" suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K')
    expect(formatNumber(1500)).toBe('1.5K')
    expect(formatNumber(999999)).toBe('1000.0K')
  })

  it('formats millions with "M" suffix', () => {
    expect(formatNumber(1000000)).toBe('1.0M')
    expect(formatNumber(2500000)).toBe('2.5M')
  })
})

// ── formatCurrency ───────────────────────────────────────────────────
describe('formatCurrency', () => {
  it('formats with F CFA suffix', () => {
    const result = formatCurrency(50000)
    expect(result).toContain('F CFA')
  })

  it('uses French locale formatting (dot or space as thousands separator)', () => {
    const result = formatCurrency(1234567)
    // French locale uses various non-breaking spaces; just check digits are grouped
    expect(result).toMatch(/1.*234.*567/)
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toContain('0')
    expect(formatCurrency(0)).toContain('F CFA')
  })
})

// ── formatDate ───────────────────────────────────────────────────────
describe('formatDate', () => {
  it('formats an ISO date to French locale', () => {
    const result = formatDate('2024-03-15')
    // Should contain "mars" (French for March) and "2024"
    expect(result).toMatch(/mars/i)
    expect(result).toContain('2024')
  })

  it('formats a different date correctly', () => {
    const result = formatDate('2023-12-25')
    expect(result).toMatch(/décembre/i)
    expect(result).toContain('2023')
  })
})

// ── getInitials ──────────────────────────────────────────────────────
describe('getInitials', () => {
  it('returns first two initials uppercased', () => {
    expect(getInitials('Jean Dupont')).toBe('JD')
  })

  it('handles single-word names', () => {
    expect(getInitials('Alice')).toBe('A')
  })

  it('truncates to 2 characters for long names', () => {
    expect(getInitials('Jean Pierre Dupont')).toBe('JP')
  })

  it('handles lowercase input', () => {
    expect(getInitials('marie claire')).toBe('MC')
  })
})
