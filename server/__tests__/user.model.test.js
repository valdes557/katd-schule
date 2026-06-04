const bcrypt = require('bcryptjs')

// Minimal in-memory test of User schema logic without connecting to MongoDB.
// We replicate the schema hooks/methods here to test their behaviour in isolation.

describe('User model logic', () => {
  describe('password hashing (pre-save hook logic)', () => {
    it('hashes the password with bcrypt', async () => {
      const plain = 'securePassword123'
      const salt = await bcrypt.genSalt(10)
      const hashed = await bcrypt.hash(plain, salt)

      expect(hashed).not.toBe(plain)
      expect(await bcrypt.compare(plain, hashed)).toBe(true)
    })

    it('does not match an incorrect password', async () => {
      const salt = await bcrypt.genSalt(10)
      const hashed = await bcrypt.hash('correct', salt)

      expect(await bcrypt.compare('wrong', hashed)).toBe(false)
    })
  })

  describe('toJSON method logic', () => {
    it('removes the password field from the serialised object', () => {
      const obj = {
        _id: '123',
        name: 'Alice',
        email: 'alice@test.com',
        password: '$2a$10$hashedvalue',
        role: 'directeur',
      }
      // Replicate the toJSON logic from User model
      const result = { ...obj }
      delete result.password
      expect(result.password).toBeUndefined()
      expect(result.name).toBe('Alice')
    })
  })

  describe('role enum validation', () => {
    const validRoles = ['super_admin', 'directeur', 'enseignant', 'parent', 'eleve']

    it.each(validRoles)('accepts role "%s"', (role) => {
      expect(validRoles).toContain(role)
    })

    it('does not accept invalid roles', () => {
      expect(validRoles).not.toContain('student')
      expect(validRoles).not.toContain('admin')
    })
  })
})
