import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Bed, 
  CreditCard, 
  Receipt, 
  UserCircle, 
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Plus,
  Building2
} from 'lucide-react';
import { auth } from './firebase';
import { useAuth } from './AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { userData, organization, hostels, currentHostel, setCurrentHostel, theme, setTheme } = useAuth();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Hostels', path: '/hostels', icon: Building2 },
    { name: 'Members', path: '/members', icon: Users },
    { name: 'Rooms', path: '/rooms', icon: Bed },
    { name: 'Payments', path: '/payments', icon: CreditCard },
    { name: 'Expenses', path: '/expenses', icon: Receipt },
    { name: 'Staff', path: '/staff', icon: UserCircle },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Mobile/Tablet Header */}
      <div className="lg:hidden bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Bed className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold text-gray-900 truncate max-w-[150px]">
              {currentHostel?.name || organization?.name || 'Zest Stay'}
            </span>
            <span className="text-[10px] text-gray-500 truncate">
              {organization?.name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2">
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar - Hidden on mobile/tablet by default */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[60] w-64 bg-white transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 border-r border-gray-100",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="hidden lg:flex flex-col px-6 py-8 border-b border-gray-50">
            <div className="flex items-center gap-3 overflow-hidden mb-6">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 flex-shrink-0">
                <Bed className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="font-bold text-gray-900 truncate">
                  {organization?.name || 'Zest Stay'}
                </span>
                <span className="text-xs text-gray-500 truncate">
                  {userData?.role === 'admin' ? 'Admin Panel' : 'Staff Panel'}
                </span>
              </div>
            </div>

            {/* Hostel Switcher */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Active Hostel
              </label>
              <select
                value={currentHostel?.id || ''}
                onChange={(e) => setCurrentHostel(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
              >
                {hostels.map((hostel) => (
                  <option key={hostel.id} value={hostel.id}>
                    {hostel.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                    isActive 
                      ? "bg-indigo-50 text-indigo-600 font-medium" 
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <Icon className={cn("w-5 h-5", isActive ? "text-indigo-600" : "text-gray-400")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 space-y-2 border-t border-gray-100">
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
              </div>
            </button>

            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium text-sm">
                {userData?.name?.charAt(0) || 'U'}
              </div>
              <div className="flex flex-col overflow-hidden flex-1">
                <span className="text-sm font-medium text-gray-900 truncate">{userData?.name}</span>
                <span className="text-xs text-gray-500 truncate">{userData?.email}</span>
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile/Tablet Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white z-50 px-2 py-2 flex items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.08)] border-t border-gray-100">
        <Link 
          to="/members" 
          className={cn(
            "flex flex-col items-center gap-1 flex-1 transition-colors",
            location.pathname === '/members' ? "text-indigo-600" : "text-gray-400"
          )}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium">Members</span>
        </Link>

        <Link 
          to="/rooms" 
          className={cn(
            "flex flex-col items-center gap-1 flex-1 transition-colors",
            location.pathname === '/rooms' ? "text-indigo-600" : "text-gray-400"
          )}
        >
          <Bed className="w-5 h-5" />
          <span className="text-[10px] font-medium">Rooms</span>
        </Link>

        <Link 
          to="/" 
          className={cn(
            "flex flex-col items-center gap-1 flex-1 transition-colors",
            location.pathname === '/' ? "text-indigo-600" : "text-gray-400"
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">Dashboard</span>
        </Link>

        <Link 
          to="/payments" 
          className={cn(
            "flex flex-col items-center gap-1 flex-1 transition-colors",
            location.pathname === '/payments' ? "text-indigo-600" : "text-gray-400"
          )}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px] font-medium">Payments</span>
        </Link>

        <Link 
          to="/expenses" 
          className={cn(
            "flex flex-col items-center gap-1 flex-1 transition-colors",
            location.pathname === '/expenses' ? "text-indigo-600" : "text-gray-400"
          )}
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[10px] font-medium">Expenses</span>
        </Link>
      </nav>

      {/* Overlay for mobile/tablet sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[55] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
