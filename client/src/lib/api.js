const rawUrl = import.meta.env.VITE_API_URL || '/api'
const API_URL = rawUrl.endsWith('/api') ? rawUrl : rawUrl === '/api' ? '/api' : rawUrl + '/api'

async function request(path, options = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  let res
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers })
  } catch (e) {
    // Network-level failure (offline, CORS, DNS, server down)
    const url = `${API_URL}${path}`
    throw new Error(`Impossible de joindre le serveur (${url}). Vérifiez votre connexion Internet ou que le backend est en ligne.`)
  }
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    if (res.status === 401) {
      // Token expired or invalid → force re-login
      try { localStorage.removeItem('token') } catch (_) {}
    }
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
  updateProfile: (data) => api.put('/auth/profile', data),
  uploadAvatar: async (file) => {
    const fd = new FormData()
    fd.append('avatar', file)
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_URL}/auth/avatar`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || `Erreur HTTP ${res.status}`)
    return data
  },
}

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getAdminStats: () => api.get('/dashboard/admin-stats'),
  getReports: (params = '') => api.get(`/dashboard/reports?${params}`),
  reviewReport: (id) => api.put(`/dashboard/reports/${id}/review`),
  unreviewReport: (id) => api.put(`/dashboard/reports/${id}/unreview`),
}

export const studentsApi = {
  list: (params = '') => api.get(`/students?${params}`),
  get: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  remove: (id) => api.del(`/students/${id}`),
  withParents: () => api.get('/students/with-parents'),
  createParentAccount: (studentId, data) => api.post(`/students/${studentId}/parent-account`, data),
  linkParent: (email, studentIds) => api.post('/students/link-parent', { email, studentIds }),
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
  mine: () => api.get('/schools/mine'),
  create: async (formData) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_URL}/schools`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
    return res.json()
  },
  setup: async (id, formData) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_URL}/schools/${id}`, { method: 'PUT', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
    return res.json()
  },
  remove: (id) => api.del(`/schools/${id}`),
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
  submit: async (formData) => {
    const token = localStorage.getItem('token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API_URL}/school-registrations`, { method: 'POST', headers, body: formData })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || `Erreur HTTP ${res.status}`)
    return data
  },
  list: (params = '') => api.get(`/school-registrations?${params}`),
  get: (id) => api.get(`/school-registrations/${id}`),
  approve: (id) => api.put(`/school-registrations/${id}/approve`),
  reject: (id, reason) => api.put(`/school-registrations/${id}/reject`, { reason }),
  resendCredentials: (id) => api.post(`/school-registrations/${id}/resend-credentials`),
  revoke: (id) => api.del(`/school-registrations/${id}/revoke`),
  remove: (id) => api.del(`/school-registrations/${id}`),
}
export const registrationsApi = schoolRegistrationApi

export const plansApi = {
  list: () => api.get('/platform/plans'),
  listAll: () => api.get('/platform/plans/all'),
  create: (data) => api.post('/platform/plans', data),
  update: (id, data) => api.put(`/platform/plans/${id}`, data),
  remove: (id) => api.del(`/platform/plans/${id}`),
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
  updatePost: (id, data) => api.put(`/platform/posts/${id}`, data),
  deletePost: (id) => api.del(`/platform/posts/${id}`),
  likePost: (id) => api.put(`/platform/posts/${id}/like`),
  commentPost: (id, content) => api.post(`/platform/posts/${id}/comment`, { content }),
  viewPost: (id) => api.put(`/platform/posts/${id}/view`),
  sharePost: (id) => { try { api.put(`/platform/posts/${id}/share`) } catch (_) {} },
  downloadPost: (id) => api.put(`/platform/posts/${id}/download`),
  // Experiences
  getExperiences: () => api.get('/platform/experiences'),
  getAllExperiences: () => api.get('/platform/experiences/all'),
  submitExperience: (data) => api.post('/platform/experiences', data),
  approveExperience: (id) => api.put(`/platform/experiences/${id}/approve`),
  deleteExperience: (id) => api.del(`/platform/experiences/${id}`),
  // Payment methods
  getPaymentMethods: () => api.get('/platform/payment-methods'),
  getAllPaymentMethods: () => api.get('/platform/payment-methods/all'),
  createPaymentMethod: (data) => api.post('/platform/payment-methods', data),
  updatePaymentMethod: (id, data) => api.put(`/platform/payment-methods/${id}`, data),
  deletePaymentMethod: (id) => api.del(`/platform/payment-methods/${id}`),
  // Resources
  getResources: (category = '') => api.get(`/platform/resources${category ? `?category=${category}` : ''}`),
  getAllResources: () => api.get('/platform/resources/all'),
  createResource: async (formData) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_URL}/platform/resources`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
    return res.json()
  },
  updateResource: async (id, formData) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_URL}/platform/resources/${id}`, { method: 'PUT', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
    return res.json()
  },
  deleteResource: (id) => api.del(`/platform/resources/${id}`),
}

export const subjectsApi = {
  list: (params = '') => api.get(`/subjects?${params}`),
  get: (id) => api.get(`/subjects/${id}`),
  create: (data) => api.post('/subjects', data),
  update: (id, data) => api.put(`/subjects/${id}`, data),
  remove: (id) => api.del(`/subjects/${id}`),
}

export const timetablesApi = {
  list: () => api.get('/timetables'),
  getByClass: (classId) => api.get(`/timetables/class/${classId}`),
  update: (id, data) => api.put(`/timetables/${id}`, data),
  addSlot: (id, data) => api.post(`/timetables/${id}/slots`, data),
  removeSlot: (id, slotId) => api.del(`/timetables/${id}/slots/${slotId}`),
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

export const teacherApi = {
  dashboard: () => api.get('/teacher/dashboard'),
  students: () => api.get('/teacher/students'),
  homeworks: (params = '') => api.get(`/teacher/homeworks?${params}`),
  createHomework: (data) => api.post('/teacher/homeworks', data),
  updateHomework: (id, data) => api.put(`/teacher/homeworks/${id}`, data),
  deleteHomework: (id) => api.del(`/teacher/homeworks/${id}`),
  gradeSubmission: (hwId, subId, data) => api.put(`/teacher/homeworks/${hwId}/submissions/${subId}/grade`, data),
  markHomeworkCompletion: (hwId, completions) => api.put(`/teacher/homework/${hwId}/completion`, { completions }),
  notifyAttendance: (classId, attendanceId) => api.post(`/teacher/attendance/${classId}/notify`, { attendanceId }),
  classParents: (classId) => api.get(`/teacher/class/${classId}/parents`),
  analytics: () => api.get('/teacher/analytics'),
  // Activities
  activities: () => api.get('/teacher/activities'),
  createActivity: (data) => api.post('/teacher/activities', data),
  updateActivity: (id, data) => api.put(`/teacher/activities/${id}`, data),
  deleteActivity: (id) => api.del(`/teacher/activities/${id}`),
  // Resources
  resources: () => api.get('/teacher/resources'),
  createResource: (data) => api.post('/teacher/resources', data),
  updateResource: (id, data) => api.put(`/teacher/resources/${id}`, data),
  deleteResource: (id) => api.del(`/teacher/resources/${id}`),
  // Daily reports
  reports: () => api.get('/teacher/reports'),
  createReport: (data) => api.post('/teacher/reports', data),
}

export const parentApi = {
  dashboard: () => api.get('/parent/dashboard'),
  childDetail: (studentId) => api.get(`/parent/children/${studentId}`),
  fees: () => api.get('/parent/fees'),
  payFee: (feeId, data) => api.post(`/parent/fees/${feeId}/pay`, data),
  appointments: () => api.get('/parent/appointments'),
  createAppointment: (data) => api.post('/parent/appointments', data),
  getControls: (studentId) => api.get(`/parent/controls/${studentId}`),
  updateControls: (studentId, data) => api.put(`/parent/controls/${studentId}`, data),
  weeklyReport: (studentId) => api.get(`/parent/report/${studentId}`),
  documents: (studentId) => api.get(`/parent/documents/${studentId}`),
  generateDocument: (studentId, type) => api.post(`/parent/documents/${studentId}/generate`, { type }),
  classAttendance: (studentId, week = '') => api.get(`/parent/children/${studentId}/class-attendance${week ? `?week=${week}` : ''}`),
  classTeachers: (studentId) => api.get(`/parent/children/${studentId}/teachers`),
  feeInstallments: () => api.get('/parent/fees/installments'),
  homeworkClassCompletion: (hwId) => api.get(`/parent/homework/${hwId}/completion`),
  childSubjects: (studentId) => api.get(`/parent/children/${studentId}/subjects`),
  activities: () => api.get('/parent/activities'),
  resources: () => api.get('/parent/resources'),
}

export const feesApi = {
  list: (params = '') => api.get(`/fees?${params}`),
  paymentStatus: (classId) => api.get(`/fees/payment-status?classId=${classId}`),
  create: (data) => api.post('/fees', data),
  update: (id, data) => api.put(`/fees/${id}`, data),
  remove: (id) => api.del(`/fees/${id}`),
  recordPayment: (id, data) => api.post(`/fees/${id}/record-payment`, data),
  notifyInstallment: (id, installmentIndex) => api.post(`/fees/${id}/notify-installment`, { installmentIndex }),
  downloadReceipt: async (id, paymentIndex) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_URL}/fees/${id}/receipt/${paymentIndex}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const contentType = res.headers.get('content-type') || ''
    if (!res.ok || !contentType.includes('application/pdf')) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || `Erreur HTTP ${res.status}`)
    }
    const blob = await res.blob()
    const cd = res.headers.get('content-disposition') || ''
    const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd)
    const filename = decodeURIComponent(match?.[1] || match?.[2] || `recu-${id}-${paymentIndex + 1}.pdf`)
    return { blob, filename }
  },
}

export default api
