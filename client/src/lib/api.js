const API_URL = import.meta.env.VITE_API_URL || '/api'

async function request(path, options = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.message || `Erreur HTTP ${res.status}`)
  }
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
}

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (payload) => api.post('/auth/register', payload),
  me: () => api.get('/auth/me'),
}

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
}

export const studentsApi = {
  list: (params = '') => api.get(`/students?${params}`),
  get: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  remove: (id) => api.del(`/students/${id}`),
}

export const teachersApi = {
  list: (params = '') => api.get(`/teachers?${params}`),
  get: (id) => api.get(`/teachers/${id}`),
  create: (data) => api.post('/teachers', data),
  update: (id, data) => api.put(`/teachers/${id}`, data),
  remove: (id) => api.del(`/teachers/${id}`),
}

export const classesApi = {
  list: (params = '') => api.get(`/classes?${params}`),
  get: (id) => api.get(`/classes/${id}`),
  create: (data) => api.post('/classes', data),
  update: (id, data) => api.put(`/classes/${id}`, data),
  remove: (id) => api.del(`/classes/${id}`),
}

export const gradesApi = {
  list: (params = '') => api.get(`/grades?${params}`),
  stats: (params = '') => api.get(`/grades/stats?${params}`),
  bulletin: (studentId, term) => api.get(`/grades/bulletin/${studentId}?term=${term}`),
  create: (data) => api.post('/grades', data),
  update: (id, data) => api.put(`/grades/${id}`, data),
  remove: (id) => api.del(`/grades/${id}`),
}

export const attendanceApi = {
  list: (params = '') => api.get(`/attendance?${params}`),
  stats: (params = '') => api.get(`/attendance/stats?${params}`),
  save: (data) => api.post('/attendance', data),
}

export const messagesApi = {
  conversations: () => api.get('/messages/conversations'),
  conversation: (id) => api.get(`/messages/conversation/${id}`),
  send: (data) => api.post('/messages', data),
  contacts: () => api.get('/messages/contacts'),
  unreadCount: () => api.get('/messages/unread-count'),
}

export const mediaApi = {
  list: (params = '') => api.get(`/media?${params}`),
  get: (id) => api.get(`/media/${id}`),
  like: (id) => api.put(`/media/${id}/like`),
  comment: (id, text) => api.post(`/media/${id}/comments`, { text }),
  getComments: (id) => api.get(`/media/${id}/comments`),
  share: (id) => api.put(`/media/${id}/share`),
  download: (id) => api.put(`/media/${id}/download`),
  remove: (id) => api.del(`/media/${id}`),
}

export const schoolsApi = {
  list: (params = '') => api.get(`/schools?${params}`),
  get: (id) => api.get(`/schools/${id}`),
}

export const locationsApi = {
  countries: () => api.get('/locations/countries'),
  cities: (countryId) => api.get(`/locations/cities/${countryId}`),
  neighborhoods: (cityId) => api.get(`/locations/neighborhoods/${cityId}`),
  list: (params = '') => api.get(`/locations?${params}`),
  create: (data) => api.post('/locations', data),
  update: (id, data) => api.put(`/locations/${id}`, data),
  remove: (id) => api.del(`/locations/${id}`),
}

export const schoolRegistrationApi = {
  submit: (data) => api.post('/school-registrations', data),
  list: (params = '') => api.get(`/school-registrations?${params}`),
  approve: (id) => api.put(`/school-registrations/${id}/approve`),
  reject: (id, reason) => api.put(`/school-registrations/${id}/reject`, { reason }),
}

export const platformApi = {
  get: () => api.get('/platform'),
  update: (data) => api.put('/platform', data),
  uploadImages: async (files) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('images', f))
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_URL}/platform/upload`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd })
    return res.json()
  },
  // Feed
  getFeed: (page = 1, category = '') => api.get(`/platform/feed?page=${page}${category ? `&category=${category}` : ''}`),
  createPost: async (formData) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_URL}/platform/posts`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
    return res.json()
  },
  deletePost: (id) => api.del(`/platform/posts/${id}`),
  likePost: (id) => api.put(`/platform/posts/${id}/like`),
  commentPost: (id, content) => api.post(`/platform/posts/${id}/comment`, { content }),
  viewPost: (id) => api.put(`/platform/posts/${id}/view`),
  // Experiences
  getExperiences: () => api.get('/platform/experiences'),
  getAllExperiences: () => api.get('/platform/experiences/all'),
  submitExperience: (data) => api.post('/platform/experiences', data),
  approveExperience: (id) => api.put(`/platform/experiences/${id}/approve`),
  deleteExperience: (id) => api.del(`/platform/experiences/${id}`),
}

export const schoolPagesApi = {
  get: (schoolId) => api.get(`/school-pages/${schoolId}`),
  update: (schoolId, data) => api.put(`/school-pages/${schoolId}`, data),
  uploadImages: async (schoolId, files) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('images', f))
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_URL}/school-pages/${schoolId}/upload`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd })
    return res.json()
  },
  // Team
  getTeam: (schoolId) => api.get(`/school-pages/${schoolId}/team`),
  addTeamMember: async (schoolId, formData) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_URL}/school-pages/${schoolId}/team`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
    return res.json()
  },
  updateTeamMember: async (id, formData) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_URL}/school-pages/team/${id}`, { method: 'PUT', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
    return res.json()
  },
  deleteTeamMember: (id) => api.del(`/school-pages/team/${id}`),
  // Posts
  getPosts: (schoolId, page = 1) => api.get(`/school-pages/${schoolId}/posts?page=${page}`),
  createPost: async (schoolId, formData) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_URL}/school-pages/${schoolId}/posts`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
    return res.json()
  },
  likePost: (id) => api.put(`/school-pages/posts/${id}/like`),
  commentPost: (id, content) => api.post(`/school-pages/posts/${id}/comment`, { content }),
  deletePost: (id) => api.del(`/school-pages/posts/${id}`),
  // Reviews
  getReviews: (schoolId) => api.get(`/school-pages/${schoolId}/reviews`),
  getAllReviews: (schoolId) => api.get(`/school-pages/${schoolId}/reviews/all`),
  submitReview: (schoolId, data) => api.post(`/school-pages/${schoolId}/reviews`, data),
  approveReview: (id) => api.put(`/school-pages/reviews/${id}/approve`),
  deleteReview: (id) => api.del(`/school-pages/reviews/${id}`),
  // Payments
  getPayments: (schoolId) => api.get(`/school-pages/${schoolId}/payments`),
  addPayment: (schoolId, data) => api.post(`/school-pages/${schoolId}/payments`, data),
  updatePayment: (id, data) => api.put(`/school-pages/payments/${id}`, data),
  deletePayment: (id) => api.del(`/school-pages/payments/${id}`),
}

export const enrollmentApi = {
  getClasses: (schoolId) => api.get(`/enrollments/school/${schoolId}/classes`),
  submit: async (formData) => {
    const token = localStorage.getItem('token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API_URL}/enrollments`, { method: 'POST', headers, body: formData })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || `Erreur HTTP ${res.status}`)
    return data
  },
  list: (params = '') => api.get(`/enrollments?${params}`),
  approve: (id) => api.put(`/enrollments/${id}/approve`),
  reject: (id, reason) => api.put(`/enrollments/${id}/reject`, { reason }),
  blockStudent: (id) => api.put(`/enrollments/students/${id}/block`),
  unblockStudent: (id) => api.put(`/enrollments/students/${id}/unblock`),
}

export default api
