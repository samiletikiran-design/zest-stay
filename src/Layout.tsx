import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Bed, 
  CreditCard, 
  Receipt, 
  UserCircle, 
  ChevronRight,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Plus,
  Building2,
  Settings as SettingsIcon,
  HelpCircle,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { auth } from './firebase';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import InstallPWA from './components/InstallPWA';
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
  const { 
    isSubscribed, 
    isTrial, 
    isExpired, 
    daysRemaining, 
    subscriptionType,
    canAccessExpenses,
    canAccessStaffManagement,
    canAccessMultiProperty
  } = useSubscription();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Hostels', path: '/hostels', icon: Building2 },
    { name: 'Members', path: '/members', icon: Users },
    { name: 'Rooms', path: '/rooms', icon: Bed },
    { name: 'Payments', path: '/payments', icon: CreditCard },
    { name: 'Expenses', path: '/expenses', icon: Receipt, restricted: !canAccessExpenses },
    { name: 'Staff', path: '/staff', icon: UserCircle, restricted: !canAccessStaffManagement },
  ].filter(item => !item.restricted);

  return (
    <div className={cn(
      "min-h-screen flex flex-col lg:flex-row transition-colors duration-200 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
    )}>
      {/* Mobile/Tablet Header */}
      <div className="lg:hidden bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Bed className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
              {currentHostel?.name || organization?.name || 'Zest Stay'}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
              {organization?.name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-500 dark:text-gray-400">
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar - Hidden on mobile/tablet by default */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[60] w-64 bg-white dark:bg-gray-800 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 border-r border-gray-100 dark:border-gray-700",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="hidden lg:flex flex-col px-6 py-8 border-b border-gray-50 dark:border-gray-700">
            <div className="flex items-center gap-3 overflow-hidden mb-6">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none flex-shrink-0">
                <Bed className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="font-bold text-gray-900 dark:text-white truncate">
                  {organization?.name || 'Zest Stay'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {userData?.role === 'admin' ? 'Admin Panel' : 'Staff Panel'}
                </span>
              </div>
            </div>

            {/* Hostel Switcher */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Active Hostel
              </label>
              {canAccessMultiProperty ? (
                <select
                  value={currentHostel?.id || ''}
                  onChange={(e) => setCurrentHostel(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                >
                  {hostels.map((hostel) => (
                    <option key={hostel.id} value={hostel.id}>
                      {hostel.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg p-2.5 flex items-center justify-between">
                  <span className="truncate">{currentHostel?.name}</span>
                  <Link to="/pricing" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                    <Zap className="w-3 h-3" />
                  </Link>
                </div>
              )}
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
                      ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium" 
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  <Icon className={cn("w-5 h-5", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 space-y-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 mb-4">
              <Link to="/terms" className="text-[10px] font-medium text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Terms</Link>
              <Link to="/privacy" className="text-[10px] font-medium text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Privacy</Link>
              <Link to="/contact" className="text-[10px] font-medium text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Contact Us</Link>
            </div>

            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
              </div>
            </button>

            <div className="relative group">
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all">
                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                  {userData?.name?.charAt(0) || 'U'}
                </div>
                <div className="flex flex-col overflow-hidden flex-1">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{userData?.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{userData?.email}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 transition-colors" />
              </div>
              
              {/* Profile Dropdown/Menu on Hover */}
              <div className="absolute bottom-full left-0 w-full mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[70] overflow-hidden">
                <Link 
                  to="/settings" 
                  onClick={() => setIsSidebarOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <SettingsIcon className="w-4 h-4" />
                  <span>Settings</span>
                </Link>
                <Link 
                  to="/pricing" 
                  onClick={() => setIsSidebarOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Zap className="w-4 h-4" />
                  <span>Subscription</span>
                </Link>
                <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden pb-20 lg:pb-0">
        {isExpired && (
          <div className="bg-red-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 sticky top-0 z-[40]">
            <AlertTriangle className="w-4 h-4" />
            <span>Your subscription has expired. Please renew to continue adding new entries.</span>
            <Link to="/pricing" className="underline font-bold ml-2 hover:text-red-100 transition-colors">Renew Now</Link>
          </div>
        )}
        {isTrial && daysRemaining <= 3 && (
          <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 sticky top-0 z-[40]">
            <Zap className="w-4 h-4" />
            <span>Your free trial ends in {daysRemaining} days. Upgrade now to keep using Zest Stay.</span>
            <Link to="/pricing" className="underline font-bold ml-2 hover:text-amber-100 transition-colors">Upgrade Now</Link>
          </div>
        )}
        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile/Tablet Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 z-50 px-2 py-2 flex items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.08)] border-t border-gray-100 dark:border-gray-700">
        <Link 
          to="/dashboard" 
          className={cn(
            "flex flex-col items-center gap-1 flex-1 transition-colors",
            location.pathname === '/dashboard' ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        <Link 
          to="/rooms" 
          className={cn(
            "flex flex-col items-center gap-1 flex-1 transition-colors",
            location.pathname === '/rooms' ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"
          )}
        >
          <Bed className="w-5 h-5" />
          <span className="text-[10px] font-medium">Rooms</span>
        </Link>

        <Link 
          to="/members" 
          className={cn(
            "flex flex-col items-center gap-1 flex-1 transition-colors",
            location.pathname === '/members' ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"
          )}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium">Members</span>
        </Link>

        <Link 
          to="/payments" 
          className={cn(
            "flex flex-col items-center gap-1 flex-1 transition-colors",
            location.pathname === '/payments' ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"
          )}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px] font-medium">Payments</span>
        </Link>

        {canAccessExpenses && (
          <Link 
            to="/expenses" 
            className={cn(
              "flex flex-col items-center gap-1 flex-1 transition-colors",
              location.pathname === '/expenses' ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"
            )}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px] font-medium">Expenses</span>
          </Link>
        )}
      </nav>

      {/* Overlay for mobile/tablet sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[55] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <InstallPWA />
    </div>
  );
};

export default Layout;
