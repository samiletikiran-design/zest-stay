import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Receipt, 
  Search, 
  Filter, 
  TrendingDown, 
  Calendar,
  X,
  CreditCard,
  ShoppingBag,
  Zap,
  Wrench,
  MoreVertical,
  Calendar as CalendarIcon,
  Building2
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, orderBy, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { useSubscription } from '../SubscriptionContext';
import { Expense } from '../types';
import { format, startOfMonth, endOfMonth, subMonths, subYears, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { safeFormat } from '../lib/utils';

const Expenses = () => {
  const navigate = useNavigate();
  const { organization, currentHostel, hostels, setCurrentHostel } = useAuth();
  const { isExpired, canAddExpenses } = useSubscription();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState('monthly');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'utilities',
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
  });

  useEffect(() => {
    if (!organization || !currentHostel) return;

    const orgId = organization.id;
    const hostelId = currentHostel.id;

    const fetchExpenses = async () => {
      setLoading(true);
      try {
        const today = new Date();
        let startDate: Date;
        let endDate = new Date();

        switch (timeFilter) {
          case 'past_month':
            startDate = startOfMonth(subMonths(today, 1));
            endDate = endOfMonth(subMonths(today, 1));
            break;
          case '3_months':
            startDate = subMonths(today, 3);
            break;
          case '6_months':
            startDate = subMonths(today, 6);
            break;
          case '1_year':
            startDate = subYears(today, 1);
            break;
          case 'custom':
            startDate = customRange.start ? parseISO(customRange.start) : subMonths(today, 1);
            endDate = customRange.end ? parseISO(customRange.end) : today;
            break;
          default: // monthly
            startDate = startOfMonth(today);
            endDate = endOfMonth(today);
        }

        const startStr = format(startDate, 'yyyy-MM-dd');
        const endStr = format(endDate, 'yyyy-MM-dd');

        const q = query(
          collection(db, 'expenses'),
          where('organizationId', '==', orgId),
          where('hostelId', '==', hostelId),
          where('date', '>=', startStr),
          where('date', '<=', endStr),
          orderBy('date', 'desc')
        );

        const snap = await getDocs(q);
        const list: Expense[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as Expense, id: doc.id }));
        setExpenses(list);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'expenses');
        toast.error('Failed to load expenses.');
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [organization, currentHostel, timeFilter, customRange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !currentHostel) return;

    if (!canAddExpenses) {
      toast.error('Your current plan does not allow adding expenses. Please upgrade to Growth plan.', {
        action: {
          label: 'Upgrade Now',
          onClick: () => navigate('/settings?tab=subscription')
        }
      });
      return;
    }

    if (isExpired) {
      toast.error('Your subscription has expired. Please renew to add expenses.');
      return;
    }

    try {
      await addDoc(collection(db, 'expenses'), {
        organizationId: organization.id,
        hostelId: currentHostel.id,
        title: formData.title,
        amount: Number(formData.amount),
        category: formData.category,
        date: formData.date,
        description: formData.description,
      });

      setIsModalOpen(false);
      toast.success('Expense added successfully!');
      setFormData({
        title: '',
        amount: '',
        category: 'utilities',
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
      toast.error('Failed to add expense.');
    }
  };

  const handleDelete = async () => {
    if (!expenseToDelete) return;

    if (!canAddExpenses) {
      toast.error('Your current plan does not allow deleting expenses. Please upgrade to Growth plan.', {
        action: {
          label: 'Upgrade Now',
          onClick: () => navigate('/settings?tab=subscription')
        }
      });
      return;
    }
    try {
      await deleteDoc(doc(db, 'expenses', expenseToDelete));
      toast.success('Expense deleted successfully!');
      // Refresh list
      setExpenses(prev => prev.filter(e => e.id !== expenseToDelete));
      setIsDeleteModalOpen(false);
      setExpenseToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${expenseToDelete}`);
      toast.error('Failed to delete expense.');
    }
  };

  const filteredExpenses = expenses.filter(exp => 
    (exp.description || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (exp.category || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'utilities': return <Zap className="w-5 h-5 text-amber-600" />;
      case 'maintenance': return <Wrench className="w-5 h-5 text-blue-600" />;
      case 'food': return <ShoppingBag className="w-5 h-5 text-green-600" />;
      default: return <CreditCard className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-gray-500 dark:text-gray-400">Track hostel operational costs</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {hostels.length > 1 && (
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-sm">
              <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <select 
                value={currentHostel?.id}
                onChange={(e) => setCurrentHostel(e.target.value)}
                className="text-sm border-none focus:ring-0 bg-transparent font-medium text-gray-700 dark:text-gray-300 p-0 pr-8"
              >
                {hostels.map(h => (
                  <option key={h.id} value={h.id} className="dark:bg-gray-800">{h.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-sm">
            <CalendarIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <select 
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="text-sm border-none focus:ring-0 bg-transparent font-medium text-gray-700 dark:text-gray-300"
            >
              <option value="monthly" className="dark:bg-gray-800">Monthly</option>
              <option value="past_month" className="dark:bg-gray-800">Past Month</option>
              <option value="3_months" className="dark:bg-gray-800">3 Months</option>
              <option value="6_months" className="dark:bg-gray-800">6 Months</option>
              <option value="1_year" className="dark:bg-gray-800">1 Year</option>
              <option value="custom" className="dark:bg-gray-800">Custom Range</option>
            </select>
          </div>

          {timeFilter === 'custom' && (
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1 shadow-sm">
              <CalendarIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input 
                type="date" 
                value={customRange.start} 
                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                className="text-xs border-none focus:ring-0 p-0 w-24 dark:bg-transparent dark:text-gray-300"
              />
              <span className="text-gray-300 dark:text-gray-600">-</span>
              <input 
                type="date" 
                value={customRange.end} 
                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                className="text-xs border-none focus:ring-0 p-0 w-24 dark:bg-transparent dark:text-gray-300"
              />
            </div>
          )}

          <button 
            onClick={() => {
              if (!canAddExpenses) {
                toast.error('Your current plan does not allow adding expenses. Please upgrade to Growth plan.', {
                  action: {
                    label: 'Upgrade Now',
                    onClick: () => navigate('/settings?tab=subscription')
                  }
                });
                return;
              }
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
          >
            <Plus className="w-5 h-5" />
            Add Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input 
              type="text" 
              placeholder="Search expenses..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expense</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                      </td>
                    </tr>
                  ) : filteredExpenses.length > 0 ? (
                    filteredExpenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{expense.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{expense.description}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gray-50 dark:bg-gray-900 rounded-lg">
                              {getCategoryIcon(expense.category)}
                            </div>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize">{expense.category}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {safeFormat(expense.date, 'MMM d, yyyy')}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-red-600 dark:text-red-400">₹{expense.amount}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => {
                              setExpenseToDelete(expense.id);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        No expenses found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-red-600 rounded-2xl p-6 text-white shadow-lg shadow-red-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <TrendingDown className="w-6 h-6" />
              </div>
              <h3 className="font-bold">Total Expenses</h3>
            </div>
            <p className="text-3xl font-bold mb-1">₹{totalExpenses}</p>
            <p className="text-red-100 text-xs">Total for filtered results</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Quick Stats</h3>
            <div className="space-y-4">
              {['utilities', 'maintenance', 'food', 'other'].map(cat => {
                const catTotal = filteredExpenses
                  .filter(e => e.category === cat)
                  .reduce((sum, e) => sum + e.amount, 0);
                const percentage = totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0;

                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-gray-500 dark:text-gray-400 capitalize">{cat}</span>
                      <span className="text-gray-900 dark:text-white">₹{catTotal}</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="h-full bg-red-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add New Expense</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electricity Bill"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                  >
                    <option value="utilities" className="dark:bg-gray-800">Utilities</option>
                    <option value="maintenance" className="dark:bg-gray-800">Maintenance</option>
                    <option value="food" className="dark:bg-gray-800">Food</option>
                    <option value="other" className="dark:bg-gray-800">Other</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 dark:shadow-none"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Expense?</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">This action cannot be undone. This expense record will be permanently removed.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 dark:shadow-none"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
