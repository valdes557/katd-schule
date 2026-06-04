const { buildSchoolPrefix } = require('../utils/matricule')

describe('buildSchoolPrefix', () => {
  it('uses slug when available, uppercased and truncated to 4 chars', () => {
    expect(buildSchoolPrefix({ slug: 'ecole-soleil', name: 'Ecole du Soleil' })).toBe('ECOL')
  })

  it('falls back to name when slug is missing', () => {
    expect(buildSchoolPrefix({ name: 'Brilliance Academy' })).toBe('BRIL')
  })

  it('strips non-alphanumeric characters', () => {
    expect(buildSchoolPrefix({ slug: 'a-b-c' })).toBe('ABC')
  })

  it('returns "STU" when both slug and name are falsy', () => {
    expect(buildSchoolPrefix({})).toBe('STU')
    expect(buildSchoolPrefix(null)).toBe('STU')
    expect(buildSchoolPrefix(undefined)).toBe('STU')
  })

  it('handles short slugs without padding', () => {
    expect(buildSchoolPrefix({ slug: 'ab' })).toBe('AB')
  })

  it('handles numeric slugs', () => {
    expect(buildSchoolPrefix({ slug: '1234school' })).toBe('1234')
  })

  it('handles slug with all special characters falling back to STU', () => {
    expect(buildSchoolPrefix({ slug: '---' })).toBe('STU')
  })
})
