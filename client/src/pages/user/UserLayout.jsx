export default function UserLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isActive = (p) =>
    p === '/u' ? pathname === '/u' || pathname === '/u/' : pathname.startsWith(p)

  const navItem = (to, Icon, label) => (
    <button
      onClick={() => navigate(to)}
      className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        isActive(to) ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'
      }`}
    >
      <Icon size={22} />
      <span className="hidden sm:block">{label}</span>
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/u" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <BookOpen size={18} />
            </div>
            <span className="font-bold text-gray-900 hidden sm:block">KATD-SCHÜLE</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navItem('/u', Home, 'Social')}
            {navItem('/u/publier', PlusCircle, 'Publier')}
            {navItem('/u/messages', MessageCircle, 'Messages')}
            {navItem('/u/profil', User, 'Profil')}
            <button
              onClick={() => { logout(); navigate('/login') }}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-red-600 transition-colors"
              title="Se déconnecter"
            >
              <LogOut size={22} />
              <span className="hidden sm:block">Quitter</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-5">
        <Outlet />
      </main>

      {/* Floating + button (mobile-friendly shortcut to publish) */}
      <button
        onClick={() => navigate('/u/publier')}
        className="sm:hidden fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700"
        title="Publier"
      >
        <PlusCircle size={28} />
      </button>
    </div>
  )
}
