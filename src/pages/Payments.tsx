import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  CreditCard, 
  Calendar, 
  User, 
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowUpRight,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  Receipt,
  ArrowRight,
  Building2
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { useSubscription } from '../SubscriptionContext';
import { Payment, Member } from '../types';
import { format, startOfMonth, endOfMonth, subMonths, subYears, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { toast } from 'sonner';
import { safeFormat } from '../lib/utils';
import { getDuesInfo } from '../lib/dues';
import UpgradeModal from '../components/UpgradeModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Payments = () => {
  const { organization, currentHostel, hostels, setCurrentHostel } = useAuth();
  const { isExpired } = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState('monthly');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [activeTab, setActiveTab] = useState<'dues' | 'history'>('dues');
  const [dueFilter, setDueFilter] = useState<'all' | 'overdue' | 'upcoming' | 'paid'>('all');

  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter === 'overdue' || filter === 'upcoming' || filter === 'paid') {
      setDueFilter(filter);
      setActiveTab('dues');
    }
  }, [searchParams]);

  // Form State
  const [formData, setFormData] = useState({
    memberId: '',
    amount: '',
    month: format(new Date(), 'yyyy-MM'),
    date: format(new Date(), 'yyyy-MM-dd'),
    method: 'cash',
    notes: '',
  });

  useEffect(() => {
    if (!organization || !currentHostel) return;

    const orgId = organization.id;
    const hostelId = currentHostel.id;

    const unsubMembers = onSnapshot(
      query(collection(db, 'members'), where('organizationId', '==', orgId), where('hostelId', '==', hostelId), where('status', '==', 'active')),
      (snap) => {
        const list: Member[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as Member, id: doc.id }));
        setMembers(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'members')
    );

    const unsubAllPayments = onSnapshot(
      query(collection(db, 'payments'), where('organizationId', '==', orgId), where('hostelId', '==', hostelId)),
      (snap) => {
        const list: Payment[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as Payment, id: doc.id }));
        setAllPayments(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'payments')
    );

    const fetchPayments = async () => {
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
          collection(db, 'payments'),
          where('organizationId', '==', orgId),
          where('hostelId', '==', hostelId),
          where('date', '>=', startStr),
          where('date', '<=', endStr),
          orderBy('date', 'desc')
        );

        const snap = await getDocs(q);
        const list: Payment[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as Payment, id: doc.id }));
        setPayments(list);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'payments');
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();

    return () => {
      unsubMembers();
      unsubAllPayments();
    };
  }, [organization, currentHostel, timeFilter, customRange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !currentHostel) return;

    try {
      const selectedMember = members.find(m => m.id === formData.memberId);
      if (!selectedMember) return;

      const dues = getDuesInfo(selectedMember, allPayments);
      const amount = Number(formData.amount);
      const expectedAmount = dues.expected;

      // Determine status
      let status: 'paid' | 'partial' = 'paid';
      if (amount < expectedAmount) {
        status = 'partial';
      }

      // 1. Record the payment
      try {
        await addDoc(collection(db, 'payments'), {
          organizationId: organization.id,
          hostelId: currentHostel.id,
          memberId: formData.memberId,
          memberName: selectedMember.name,
          amount: amount,
          month: formData.month,
          date: formData.date,
          method: formData.method,
          status: status,
          notes: formData.notes,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'payments');
      }

      // 2. Update member's lastPaidMonth if this payment is for a newer month
      if (status === 'paid' || (selectedMember.lastPaidMonth && formData.month > selectedMember.lastPaidMonth)) {
        try {
          await updateDoc(doc(db, 'members', selectedMember.id), {
            lastPaidMonth: formData.month
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `members/${selectedMember.id}`);
        }
      }

      setIsModalOpen(false);
      toast.success(status === 'partial' ? 'Partial payment recorded!' : 'Payment recorded successfully!');
      setFormData({
        memberId: '',
        amount: '',
        month: format(new Date(), 'yyyy-MM'),
        date: format(new Date(), 'yyyy-MM-dd'),
        method: 'cash',
        notes: '',
      });
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment.');
    }
  };

  const openQuickCollect = (member: Member, month: string, amount: number) => {
    const dues = getDuesInfo(member, allPayments);
    
    setFormData({
      memberId: member.id,
      amount: dues.remaining.toString(),
      month: dues.targetMonth,
      date: format(new Date(), 'yyyy-MM-dd'),
      method: 'cash',
      notes: !member.lastPaidMonth ? 'Initial Payment (Deposit + Rent)' : `Quick collect for ${safeFormat(dues.targetMonth + '-01', 'MMM yyyy')}`,
    });
    setIsModalOpen(true);
  };

  const filteredPayments = payments.filter(p => 
    (p.memberName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (p.month || '').includes(searchTerm)
  );

  const categorizedMembers = members.map(m => {
    const duesInfo = getDuesInfo(m, allPayments);
    return { ...m, duesInfo };
  }).filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const overdueMembers = categorizedMembers.filter(m => m.duesInfo.isOverdue);
  const upcomingMembers = categorizedMembers.filter(m => (m.duesInfo.isDueSoon || m.duesInfo.isDueToday) && !m.duesInfo.isPaid);
  const paidMembers = categorizedMembers.filter(m => m.duesInfo.isPaid && !m.duesInfo.isOverdue);

  const displayMembers = categorizedMembers.filter(m => {
    if (dueFilter === 'overdue') return m.duesInfo.isOverdue;
    if (dueFilter === 'upcoming') return (m.duesInfo.isDueSoon || m.duesInfo.isDueToday) && !m.duesInfo.isPaid;
    if (dueFilter === 'paid') return m.duesInfo.isPaid && !m.duesInfo.isOverdue;
    return true;
  });

  const totalCollected = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payments</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage rent collections and history</p>
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
          <button 
            onClick={() => {
              if (isExpired) {
                setIsUpgradeModalOpen(true);
                return;
              }
              setIsModalOpen(true);
            }}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors shadow-lg whitespace-nowrap",
              isExpired 
                ? "bg-gray-400 text-white cursor-not-allowed shadow-none" 
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
            )}
          >
            <Plus className="w-5 h-5" />
            Collect Rent
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('dues')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'dues' 
              ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Dues & Collections
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'history' 
              ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Payment History
        </button>
      </div>

      {activeTab === 'dues' ? (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Overdue</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{overdueMembers.length}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Members missed payment</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Upcoming</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{upcomingMembers.length}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Due in next 7 days</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Paid</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{paidMembers.length}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Up to date for this cycle</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 px-3 py-2 rounded-xl flex-1 max-w-md">
                <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Search members or room..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-sm w-full text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                {(['all', 'overdue', 'upcoming', 'paid'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setDueFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      dueFilter === f 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Member</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Room</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Month</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {displayMembers.length > 0 ? (
                    displayMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                              {member.name.charAt(0)}
                            </div>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{member.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          Room {member.roomNumber}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {safeFormat(member.duesInfo.dueDate, 'MMM d, yyyy')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-full uppercase">
                            {safeFormat(member.duesInfo.targetMonth + '-01', 'MMM yyyy')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {member.duesInfo.isOverdue ? (
                            <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">Overdue</span>
                          ) : member.duesInfo.isPaid ? (
                            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">Paid</span>
                          ) : member.duesInfo.isDueToday ? (
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">Due Today</span>
                          ) : (
                            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">Upcoming</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!member.duesInfo.isPaid ? (
                            <button 
                              onClick={() => {
                                if (isExpired) {
                                  setIsUpgradeModalOpen(true);
                                  return;
                                }
                                openQuickCollect(member, member.duesInfo.targetMonth, member.rentAmount);
                              }}
                              className={cn(
                                "inline-flex items-center gap-1.5 font-bold text-sm",
                                isExpired ? "text-gray-400 cursor-not-allowed" : "text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                              )}
                            >
                              Collect <ArrowRight className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-sm font-medium italic">Settled</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        No members found matching the filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-3">
                <Search className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Search history by name or month..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Member</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Month</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Method</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                          </td>
                        </tr>
                      ) : filteredPayments.length > 0 ? (
                        filteredPayments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                                  {(payment.memberName || 'U').charAt(0)}
                                </div>
                                <span className="text-sm font-bold text-gray-900 dark:text-white">{payment.memberName}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-full uppercase">
                                {safeFormat(payment.month + '-01', 'MMM yyyy')}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                              {safeFormat(payment.date, 'MMM d, yyyy')}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-bold text-green-600 dark:text-green-400">₹{payment.amount}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 capitalize">{payment.method}</span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-12 py-12 text-center text-gray-500 dark:text-gray-400">
                            No payment history found for the selected period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold">Total Collected</h3>
                </div>
                <p className="text-3xl font-bold mb-1">₹{totalCollected}</p>
                <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl mt-4">
                  <CalendarIcon className="w-4 h-4 text-indigo-100" />
                  <select 
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value as any)}
                    className="text-xs border-none focus:ring-0 bg-transparent font-bold text-white w-full cursor-pointer"
                  >
                    <option value="monthly" className="text-gray-900 dark:text-white dark:bg-gray-800">This Month</option>
                    <option value="past_month" className="text-gray-900 dark:text-white dark:bg-gray-800">Past Month</option>
                    <option value="3_months" className="text-gray-900 dark:text-white dark:bg-gray-800">Past 3 Months</option>
                    <option value="6_months" className="text-gray-900 dark:text-white dark:bg-gray-800">Past 6 Months</option>
                    <option value="1_year" className="text-gray-900 dark:text-white dark:bg-gray-800">Past Year</option>
                    <option value="custom" className="text-gray-900 dark:text-white dark:bg-gray-800">Custom Range</option>
                  </select>
                </div>
                {timeFilter === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input 
                      type="date" 
                      value={customRange.start} 
                      onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                      className="text-[10px] bg-white/10 border-none rounded-lg p-2 text-white placeholder-white/50"
                    />
                    <input 
                      type="date" 
                      value={customRange.end} 
                      onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                      className="text-[10px] bg-white/10 border-none rounded-lg p-2 text-white placeholder-white/50"
                    />
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Payment Methods</h3>
                <div className="space-y-4">
                  {['cash', 'upi', 'bank_transfer'].map(method => {
                    const methodTotal = filteredPayments
                      .filter(p => p.method === method)
                      .reduce((sum, p) => sum + p.amount, 0);
                    const percentage = totalCollected > 0 ? (methodTotal / totalCollected) * 100 : 0;

                    return (
                      <div key={method} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-gray-500 dark:text-gray-400 capitalize">{method.replace('_', ' ')}</span>
                          <span className="text-gray-900 dark:text-white">₹{methodTotal}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
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
        </div>
      )}

      {/* Collect Rent Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Collect Rent</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Member</label>
                <select
                  required
                  value={formData.memberId}
                  onChange={(e) => {
                    const member = members.find(m => m.id === e.target.value);
                    if (member) {
                      const isInitial = !member.lastPaidMonth;
                      const amount = isInitial ? (member.rentAmount + member.deposit) : member.rentAmount;
                      setFormData({ 
                        ...formData, 
                        memberId: e.target.value,
                        amount: amount.toString(),
                        notes: isInitial ? 'Initial Payment (Deposit + Rent)' : ''
                      });
                    } else {
                      setFormData({ 
                        ...formData, 
                        memberId: e.target.value,
                        amount: '',
                        notes: ''
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  <option value="" className="dark:bg-gray-700">Choose a member...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id} className="dark:bg-gray-700">{m.name} (Room {m.roomNumber})</option>
                  ))}
                </select>
              </div>

              {formData.memberId && (
                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-xl">
                  {(() => {
                    const m = members.find(m => m.id === formData.memberId);
                    if (!m) return null;
                    const isInitial = !m.lastPaidMonth;
                    const expected = isInitial ? (m.rentAmount + m.deposit) : m.rentAmount;
                    return (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                            {isInitial ? 'Initial Payment' : 'Monthly Rent'}
                          </span>
                          <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">₹{expected}</span>
                        </div>
                        {isInitial && (
                          <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1">Includes Rent (₹{m.rentAmount}) + Deposit (₹{m.deposit})</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  {(() => {
                    const m = members.find(m => m.id === formData.memberId);
                    if (!m) return null;
                    const isInitial = !m.lastPaidMonth;
                    const expected = isInitial ? (m.rentAmount + m.deposit) : m.rentAmount;
                    const amount = Number(formData.amount);
                    if (amount > 0 && amount < expected) {
                      return <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Remaining: ₹{expected - amount}</p>;
                    }
                    return null;
                  })()}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Rent Month</label>
                  <input
                    type="month"
                    required
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Method</label>
                  <select
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  >
                    <option value="cash" className="dark:bg-gray-700">Cash</option>
                    <option value="upi" className="dark:bg-gray-700">UPI</option>
                    <option value="bank_transfer" className="dark:bg-gray-700">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-100 dark:shadow-none"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <UpgradeModal 
        isOpen={isUpgradeModalOpen} 
        onClose={() => setIsUpgradeModalOpen(false)} 
        title="Upgrade Your Plan"
        description="Access advanced payment tracking, automated receipts, and detailed financial reports."
        features={[
          "Unlimited Payment Records",
          "Automated Digital Receipts",
          "Financial Performance Reports",
          "Bulk Payment Reminders"
        ]}
      />
    </div>
  );
};

export default Payments;
