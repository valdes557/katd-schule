const { weightedAverage, appreciationFor, behaviorFor } = require('../utils/gradeHelpers')

// ── weightedAverage ──────────────────────────────────────────────────
describe('weightedAverage', () => {
  it('computes a simple unweighted average when all coefficients are 1', () => {
    const items = [
      { value: 10, coefficient: 1 },
      { value: 20, coefficient: 1 },
    ]
    expect(weightedAverage(items)).toBe(15)
  })

  it('computes a weighted average correctly', () => {
    const items = [
      { value: 10, coefficient: 2 },
      { value: 20, coefficient: 3 },
    ]
    // (10*2 + 20*3) / (2+3) = 80/5 = 16
    expect(weightedAverage(items)).toBe(16)
  })

  it('defaults coefficient to 1 when missing', () => {
    const items = [{ value: 8 }, { value: 12 }]
    expect(weightedAverage(items)).toBe(10)
  })

  it('returns 0 for an empty array', () => {
    expect(weightedAverage([])).toBe(0)
  })

  it('handles a single item', () => {
    expect(weightedAverage([{ value: 17, coefficient: 3 }])).toBe(17)
  })

  it('treats zero coefficients as 1 (falsy fallback)', () => {
    const items = [
      { value: 10, coefficient: 0 },
      { value: 20, coefficient: 0 },
    ]
    // coefficient 0 is falsy → defaults to 1, so result is (10+20)/2
    expect(weightedAverage(items)).toBe(15)
  })
})

// ── appreciationFor ──────────────────────────────────────────────────
describe('appreciationFor', () => {
  it('returns "Excellent" for avg >= 18', () => {
    expect(appreciationFor(18)).toMatch(/Excellent/)
    expect(appreciationFor(20)).toMatch(/Excellent/)
  })

  it('returns "Très bonne" for avg >= 16 and < 18', () => {
    expect(appreciationFor(16)).toMatch(/Très bonne/)
    expect(appreciationFor(17.9)).toMatch(/Très bonne/)
  })

  it('returns "Bon travail" for avg >= 14 and < 16', () => {
    expect(appreciationFor(14)).toMatch(/Bon travail/)
    expect(appreciationFor(15.9)).toMatch(/Bon travail/)
  })

  it('returns "encourageants" for avg >= 12 and < 14', () => {
    expect(appreciationFor(12)).toMatch(/encourageants/)
  })

  it('returns "moyen" for avg >= 10 and < 12', () => {
    expect(appreciationFor(10)).toMatch(/moyen/)
  })

  it('returns "insuffisants" for avg >= 8 and < 10', () => {
    expect(appreciationFor(8)).toMatch(/insuffisants/)
  })

  it('returns "préoccupant" for avg < 8', () => {
    expect(appreciationFor(7)).toMatch(/préoccupant/)
    expect(appreciationFor(0)).toMatch(/préoccupant/)
  })
})

// ── behaviorFor ──────────────────────────────────────────────────────
describe('behaviorFor', () => {
  it('returns "Très bien" for rate >= 95', () => {
    expect(behaviorFor(95)).toBe('Très bien')
    expect(behaviorFor(100)).toBe('Très bien')
  })

  it('returns "Bien" for rate >= 85 and < 95', () => {
    expect(behaviorFor(85)).toBe('Bien')
    expect(behaviorFor(94)).toBe('Bien')
  })

  it('returns "Assez bien" for rate >= 70 and < 85', () => {
    expect(behaviorFor(70)).toBe('Assez bien')
    expect(behaviorFor(84)).toBe('Assez bien')
  })

  it('returns "À améliorer" for rate < 70', () => {
    expect(behaviorFor(69)).toBe('À améliorer')
    expect(behaviorFor(0)).toBe('À améliorer')
  })
})
