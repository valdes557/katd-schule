const jwt = require('jsonwebtoken')
const { protect, authorize } = require('../middleware/auth')

// ── Mock User model ──────────────────────────────────────────────────
jest.mock('../models/User', () => {
  const findById = jest.fn()
  return { findById }
})
const User = require('../models/User')

// ── Helpers ──────────────────────────────────────────────────────────
const SECRET = 'test-secret'
beforeAll(() => { process.env.JWT_SECRET = SECRET })

function mockRes() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (data) => { res.body = data; return res }
  return res
}

// ── protect ──────────────────────────────────────────────────────────
describe('protect middleware', () => {
  it('rejects when no Authorization header is present', async () => {
    const req = { headers: {} }
    const res = mockRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res.body.message).toMatch(/token manquant/i)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects an invalid / expired token', async () => {
    const req = { headers: { authorization: 'Bearer bad.token.here' } }
    const res = mockRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res.body.message).toMatch(/invalide|expiré/i)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects when user is not found in DB', async () => {
    const token = jwt.sign({ id: 'abc123' }, SECRET)
    const selectMock = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) })
    User.findById.mockReturnValue({ select: selectMock })

    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = mockRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res.body.message).toMatch(/non trouvé/i)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects when user account is inactive', async () => {
    const token = jwt.sign({ id: 'abc123' }, SECRET)
    const fakeUser = { _id: 'abc123', name: 'Test', isActive: false }
    const selectMock = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(fakeUser) })
    User.findById.mockReturnValue({ select: selectMock })

    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = mockRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(res.statusCode).toBe(403)
    expect(res.body.message).toMatch(/bloqué/i)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() and sets req.user for a valid, active user', async () => {
    const token = jwt.sign({ id: 'abc123' }, SECRET)
    const fakeUser = { _id: 'abc123', name: 'Test', isActive: true }
    const selectMock = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(fakeUser) })
    User.findById.mockReturnValue({ select: selectMock })

    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = mockRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.user).toBe(fakeUser)
  })
})

// ── authorize ────────────────────────────────────────────────────────
describe('authorize middleware', () => {
  it('calls next() when user role is in allowed list', () => {
    const middleware = authorize('directeur', 'super_admin')
    const req = { user: { role: 'directeur' } }
    const res = mockRes()
    const next = jest.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('rejects when user role is not in allowed list', () => {
    const middleware = authorize('directeur', 'super_admin')
    const req = { user: { role: 'eleve' } }
    const res = mockRes()
    const next = jest.fn()

    middleware(req, res, next)

    expect(res.statusCode).toBe(403)
    expect(res.body.message).toMatch(/accès refusé/i)
    expect(next).not.toHaveBeenCalled()
  })

  it('works with a single allowed role', () => {
    const middleware = authorize('super_admin')
    const req = { user: { role: 'super_admin' } }
    const res = mockRes()
    const next = jest.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })
})
