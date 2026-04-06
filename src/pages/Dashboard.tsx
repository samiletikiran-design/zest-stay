import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Bed, 
  CreditCard, 
  Receipt, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
  UserPlus,
  Plus,
  Building2,
  Home,
  MessageSquare,
  Smartphone
} from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { useSubscription } from '../SubscriptionContext';
import { Member, Room, Bed as BedType, Payment, Expense } from '../types';
import { format, subMonths, subYears, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfDay, addMonths, isAfter, differenceInMonths, addDays, isBefore } from 'date-fns';
import { getDuesInfo } from '../lib/dues';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { safeFormat } from '../lib/utils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Dashboard = () => {
  const { organization, currentHostel, hostels, setCurrentHostel, refreshUserData } = useAuth();
  const { isExpired, canAccessReminders } = useSubscription();
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState('monthly');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [stats, setStats] = useState({
    totalMembers: 0,
    occupiedBeds: 0,
    totalBeds: 0,
    income: 0,
    expenses: 0,
  });
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<BedType[]>([]);
  const [dueMembers, setDueMembers] = useState<(Member & { duesInfo: any })[]>([]);
  const [dueSoonMembers, setDueSoonMembers] = useState<(Member & { duesInfo: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isCollectRentModalOpen, setIsCollectRentModalOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Add Member Form State
  const [addMemberFormData, setAddMemberFormData] = useState({
    name: '',
    phone: '',
    idProof: '',
    roomId: '',
    bedId: '',
    rentAmount: '',
    deposit: '',
    joiningDate: format(new Date(), 'yyyy-MM-dd'),
    billingType: 'anniversary' as 'anniversary' | 'fixed_first',
  });

  // Collect Rent Form State
  const [collectRentFormData, setCollectRentFormData] = useState({
    memberId: '',
    amount: '',
    month: format(new Date(), 'yyyy-MM'),
    date: format(new Date(), 'yyyy-MM-dd'),
    method: 'cash',
    notes: '',
  });
  
  useEffect(() => {
    if (currentHostel && !selectedHostelId) {
      setSelectedHostelId(currentHostel.id);
    }
  }, [currentHostel]);

  useEffect(() => {
    if (!organization || (!currentHostel && selectedHostelId !== 'all')) {
      if (!organization) setLoading(false);
      return;
    }

    const orgId = organization.id;
    const hostelId = selectedHostelId || currentHostel?.id;
    if (!hostelId && selectedHostelId !== 'all') return;

    const today = new Date();
    const currentMonth = format(today, 'yyyy-MM');

    const getBaseQuery = (collName: string) => {
      let q = query(collection(db, collName), where('organizationId', '==', orgId));
      if (selectedHostelId !== 'all') {
        q = query(q, where('hostelId', '==', hostelId));
      }
      return q;
    };

    // 1. Real-time Members & Dues (Not affected by time filter for counts)
    const unsubMembers = onSnapshot(
      query(getBaseQuery('members'), where('status', '==', 'active')),
      (snap) => {
        const list: Member[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as Member, id: doc.id }));
        setMembers(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'members');
        setLoading(false);
      }
    );

    const unsubPayments = onSnapshot(
      getBaseQuery('payments'),
      (snap) => {
        const list: Payment[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as Payment, id: doc.id }));
        setPayments(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'payments');
        setLoading(false);
      }
    );

    const unsubBeds = onSnapshot(
      getBaseQuery('beds'),
      (snap) => {
        const list: BedType[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as BedType, id: doc.id }));
        setBeds(list);
        
        const occupied = list.filter(b => b.status === 'occupied').length;
        setStats(prev => ({ ...prev, occupiedBeds: occupied }));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'beds');
        setLoading(false);
      }
    );

    const unsubRooms = onSnapshot(
      getBaseQuery('rooms'),
      (snap) => {
        const list: Room[] = [];
        let total = 0;
        snap.forEach(doc => {
          const data = doc.data() as Room;
          list.push({ ...data, id: doc.id });
          total += data.totalBeds;
        });
        setRooms(list);
        setStats(prev => ({ ...prev, totalBeds: total }));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'rooms');
        setLoading(false);
      }
    );

    // 3. Filtered Financial Data (Income & Expenses)
    const fetchFinancials = async () => {
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

      // Fetch Payments
      let paymentsSnap;
      try {
        const paymentsQuery = query(
          getBaseQuery('payments'),
          where('date', '>=', startStr),
          where('date', '<=', endStr)
        );
        paymentsSnap = await getDocs(paymentsQuery);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'payments');
      }
      let income = 0;
      if (paymentsSnap) {
        paymentsSnap.forEach(doc => income += (doc.data() as Payment).amount);
      }

      // Fetch Expenses
      let expensesSnap;
      try {
        const expensesQuery = query(
          getBaseQuery('expenses'),
          where('date', '>=', startStr),
          where('date', '<=', endStr)
        );
        expensesSnap = await getDocs(expensesQuery);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'expenses');
      }
      let expenses = 0;
      if (expensesSnap) {
        expensesSnap.forEach(doc => expenses += (doc.data() as Expense).amount);
      }

      setStats(prev => ({ ...prev, income, expenses }));
      setLoading(false);
    };

    fetchFinancials();

    // 4. Recent Activity (Always show last 5)
    const unsubRecent = onSnapshot(
      query(getBaseQuery('payments'), orderBy('date', 'desc'), limit(5)),
      (snap) => {
        const recent: Payment[] = [];
        snap.forEach(doc => recent.push({ ...doc.data() as Payment, id: doc.id }));
        setRecentPayments(recent);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'payments')
    );

    return () => {
      unsubMembers();
      unsubRooms();
      unsubBeds();
      unsubRecent();
      unsubPayments();
    };
  }, [organization, currentHostel, selectedHostelId, timeFilter, customRange]);

  // Update dues when members or payments change
  useEffect(() => {
    if (members.length === 0) {
      setDueMembers([]);
      setDueSoonMembers([]);
      setStats(prev => ({ ...prev, totalMembers: 0 }));
      return;
    }

    const overdue: (Member & { duesInfo: any })[] = [];
    const soon: (Member & { duesInfo: any })[] = [];

    members.forEach(m => {
      const duesInfo = getDuesInfo(m, payments);

      // Show as overdue if Next Due date < sysdate
      if (duesInfo.isOverdue) {
        overdue.push({ ...m, duesInfo });
      } else if ((duesInfo.isDueSoon || duesInfo.isDueToday) && !duesInfo.isPaid) {
        soon.push({ ...m, duesInfo });
      }
    });

    // Sort by due date
    overdue.sort((a: any, b: any) => a.duesInfo.dueDate.getTime() - b.duesInfo.dueDate.getTime());
    soon.sort((a: any, b: any) => a.duesInfo.dueDate.getTime() - b.duesInfo.dueDate.getTime());

    setDueMembers(overdue);
    setDueSoonMembers(soon);
    setStats(prev => ({ ...prev, totalMembers: members.length }));
  }, [members, payments]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !currentHostel) return;

    if (isExpired) {
      toast.error('Your subscription has expired. Please renew to add new members.');
      return;
    }

    try {
      const newMember = {
        ...addMemberFormData,
        phone: `+91${addMemberFormData.phone}`,
        organizationId: organization.id,
        hostelId: currentHostel.id,
        rentAmount: Number(addMemberFormData.rentAmount),
        deposit: Number(addMemberFormData.deposit),
        status: 'active' as const,
        lastPaidMonth: format(subMonths(parseISO(addMemberFormData.joiningDate), 1), 'yyyy-MM'),
      };

      await addDoc(collection(db, 'members'), newMember);
      
      if (addMemberFormData.bedId) {
        await updateDoc(doc(db, 'beds', addMemberFormData.bedId), { status: 'occupied' });
      }

      setIsAddMemberModalOpen(false);
      setAddMemberFormData({
        name: '',
        phone: '',
        idProof: '',
        roomId: '',
        bedId: '',
        rentAmount: '',
        deposit: '',
        joiningDate: format(new Date(), 'yyyy-MM-dd'),
        billingType: 'anniversary',
      });
      toast.success('Member registered successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'members');
      toast.error('Failed to add member.');
    }
  };

  const handleCollectRent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !currentHostel) return;

    try {
      const selectedMember = members.find(m => m.id === collectRentFormData.memberId);
      if (!selectedMember) return;

      const amount = Number(collectRentFormData.amount);
      const isInitial = !selectedMember.lastPaidMonth;
      const expectedAmount = isInitial 
        ? selectedMember.rentAmount + selectedMember.deposit 
        : selectedMember.rentAmount;

      // Determine status
      let status: 'paid' | 'partial' = 'paid';
      if (amount < expectedAmount) {
        status = 'partial';
      }

      await addDoc(collection(db, 'payments'), {
        organizationId: organization.id,
        hostelId: currentHostel.id,
        memberId: collectRentFormData.memberId,
        memberName: selectedMember.name,
        amount: amount,
        month: collectRentFormData.month,
        date: collectRentFormData.date,
        method: collectRentFormData.method,
        status: status,
        notes: collectRentFormData.notes,
        createdAt: serverTimestamp(),
      });

      // Only update if it's fully paid or if it's the latest month
      if (status === 'paid' || (selectedMember.lastPaidMonth && collectRentFormData.month > selectedMember.lastPaidMonth)) {
        await updateDoc(doc(db, 'members', selectedMember.id), {
          lastPaidMonth: collectRentFormData.month
        });
      }

      toast.success(status === 'partial' ? 'Partial payment recorded!' : 'Payment recorded successfully!');
      setCollectRentFormData({
        memberId: '',
        amount: '',
        month: format(new Date(), 'yyyy-MM'),
        date: format(new Date(), 'yyyy-MM-dd'),
        method: 'cash',
        notes: '',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payments');
      toast.error('Failed to record payment.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account Setup Incomplete</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
            We couldn't find your organization details. This might have happened if your initial setup was interrupted.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => refreshUserData()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Retry Loading
            </button>
            <Link
              to="/signup"
              className="px-6 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Go to Signup
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const cards = [
    { name: 'Total Members', value: stats.totalMembers, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', link: '/members' },
    { name: 'Occupancy', value: `${stats.occupiedBeds}/${stats.totalBeds}`, icon: Bed, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20', link: '/rooms' },
    { name: 'Income', value: `₹${stats.income}`, icon: TrendingUp, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', link: '/payments' },
    { name: 'Expenses', value: `₹${stats.expenses}`, icon: TrendingDown, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', link: '/expenses' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Welcome back to {organization?.name}</p>
        </div>
        <button 
          onClick={() => {
            if (isExpired) {
              toast.error('Your subscription has expired. Please renew to add new members.');
              return;
            }
            setIsAddMemberModalOpen(true);
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg whitespace-nowrap",
            isExpired 
              ? "bg-gray-400 text-white cursor-not-allowed shadow-none" 
              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
          )}
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Add Member</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar pb-1">
        <div className="flex-1 min-w-[140px] flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-sm">
          <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <select 
            value={selectedHostelId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedHostelId(val);
              if (val !== 'all') {
                setCurrentHostel(val);
              }
            }}
            className="text-xs sm:text-sm border-none focus:ring-0 bg-transparent font-medium text-gray-700 dark:text-gray-200 p-0 pr-8 w-full truncate"
          >
            <option value="all">All Hostels</option>
            {hostels.map(h => (
              <option key={h.id} value={h.id} className="dark:bg-gray-800">{h.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[140px] flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-sm">
          <CalendarIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <select 
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="text-xs sm:text-sm border-none focus:ring-0 bg-transparent font-medium text-gray-700 dark:text-gray-200 p-0 pr-8 w-full truncate"
          >
            <option value="monthly">Monthly</option>
            <option value="past_month">Past Month</option>
            <option value="3_months">3 Months</option>
            <option value="6_months">6 Months</option>
            <option value="1_year">1 Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link 
              key={card.name} 
              to={card.link}
              className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-900 transition-all duration-200 group overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className={cn(card.bg, "p-2 sm:p-3 rounded-xl group-hover:scale-110 transition-transform w-fit")}>
                    <Icon className={cn("w-5 h-5 sm:w-6 sm:h-6", card.color)} />
                  </div>
                  <p className="text-[10px] sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{card.name}</p>
                </div>
                <div className="min-w-0 sm:flex-1">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate sm:text-right">{card.value}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Dues Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-red-50/30 dark:bg-red-900/10">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-600 dark:text-red-400" />
                <h3 className="font-bold text-gray-900 dark:text-white">Overdue Payments</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-full text-xs font-bold">{dueMembers.length}</span>
                {dueMembers.length > 7 && (
                  <Link to="/payments?filter=overdue" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">View All</Link>
                )}
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {dueMembers.length > 0 ? (
                dueMembers.slice(0, 7).map((member: any) => (
                  <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 font-bold">
                        {(member.name || 'U').charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{member.name}</p>
                          <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Overdue</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Room {rooms.find(r => r.id === member.roomId)?.roomNumber} • Bed {beds.find(b => b.id === member.bedId)?.bedNumber.split('-')[1] || 'N/A'} • Due on {safeFormat(member.duesInfo.dueDate, 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600 dark:text-red-400">₹{member.duesInfo.remaining}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {canAccessReminders && (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  const message = `Hi ${member.name}, this is a reminder from ${currentHostel?.name} regarding your rent for ${member.duesInfo.targetMonth}. The pending amount is ₹${member.duesInfo.remaining}. Please pay by ${safeFormat(member.duesInfo.dueDate, 'MMM d, yyyy')}. Thank you!`;
                                  const whatsappUrl = `https://wa.me/${member.phone.replace('+', '')}?text=${encodeURIComponent(message)}`;
                                  window.open(whatsappUrl, '_blank');
                                }}
                                className="text-[10px] font-bold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex items-center gap-1"
                                title="WhatsApp Reminder"
                              >
                                <MessageSquare className="w-3 h-3" />
                                WhatsApp
                              </button>
                              <button 
                                onClick={() => {
                                  const message = `Hi ${member.name}, this is a reminder from ${currentHostel?.name} regarding your rent for ${member.duesInfo.targetMonth}. The pending amount is ₹${member.duesInfo.remaining}. Please pay by ${safeFormat(member.duesInfo.dueDate, 'MMM d, yyyy')}. Thank you!`;
                                  const smsUrl = `sms:${member.phone.replace('+', '')}?body=${encodeURIComponent(message)}`;
                                  window.open(smsUrl, '_blank');
                                }}
                                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
                                title="SMS Reminder"
                              >
                                <Smartphone className="w-3 h-3" />
                                SMS
                              </button>
                            </div>
                          )}
                          <Link to="/payments" className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Collect Now</Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  No overdue payments!
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-amber-50/30 dark:bg-amber-900/10">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-bold text-gray-900 dark:text-white">Due in Next 7 Days</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded-full text-xs font-bold">{dueSoonMembers.length}</span>
                {dueSoonMembers.length > 7 && (
                  <Link to="/payments?filter=upcoming" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">View All</Link>
                )}
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {dueSoonMembers.length > 0 ? (
                dueSoonMembers.slice(0, 7).map((member: any) => (
                  <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold">
                        {(member.name || 'U').charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{member.name}</p>
                          {member.duesInfo.isPaid ? (
                            <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Paid</span>
                          ) : member.duesInfo.isDueToday ? (
                            <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Due Today</span>
                          ) : (
                            <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Upcoming</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Room {rooms.find(r => r.id === member.roomId)?.roomNumber} • Bed {beds.find(b => b.id === member.bedId)?.bedNumber.split('-')[1] || 'N/A'} • Due on {safeFormat(member.duesInfo.dueDate, 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">₹{member.duesInfo.remaining}</p>
                      <p className={`text-xs font-medium ${member.duesInfo.isPaid ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {member.duesInfo.isPaid ? 'Paid' : 'Coming up'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No upcoming dues in the next 7 days.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Section */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">Recent Activity</h3>
              <Link to="/payments" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">View All</Link>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {recentPayments.map((payment) => (
                <div key={payment.id} className="px-6 py-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">₹{payment.amount} Received</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{safeFormat(payment.date, 'MMM d, h:mm a')}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
            <h3 className="font-bold mb-2">Manage Hostel</h3>
            <p className="text-indigo-100 text-sm mb-6">Keep track of your rooms, beds, and staff efficiently.</p>
            <div className="space-y-3">
              <Link to="/rooms" className="flex items-center justify-between bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-colors">
                <span className="text-sm font-medium">Room Management</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link to="/staff" className="flex items-center justify-between bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-colors">
                <span className="text-sm font-medium">Staff & Salaries</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add New Member</h3>
              <button onClick={() => setIsAddMemberModalOpen(false)} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                  <input
                    type="text"
                    required
                    value={addMemberFormData.name}
                    onChange={(e) => setAddMemberFormData({ ...addMemberFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 dark:text-gray-400 sm:text-sm font-medium">+91</span>
                    </div>
                    <input
                      type="tel"
                      required
                      pattern="[0-9]{10}"
                      maxLength={10}
                      title="Please enter a 10-digit phone number"
                      value={addMemberFormData.phone}
                      onChange={(e) => setAddMemberFormData({ ...addMemberFormData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      className="w-full pl-12 pr-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">ID Proof (Aadhar/Voter ID)</label>
                <input
                  type="text"
                  required
                  value={addMemberFormData.idProof}
                  onChange={(e) => setAddMemberFormData({ ...addMemberFormData, idProof: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Room</label>
                  <select
                    required
                    value={addMemberFormData.roomId}
                    onChange={(e) => setAddMemberFormData({ ...addMemberFormData, roomId: e.target.value, bedId: '' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="" className="dark:bg-gray-700">Select Room</option>
                    {rooms.map(r => <option key={r.id} value={r.id} className="dark:bg-gray-700">Room {r.roomNumber}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bed</label>
                  <select
                    required
                    value={addMemberFormData.bedId}
                    onChange={(e) => setAddMemberFormData({ ...addMemberFormData, bedId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="" className="dark:bg-gray-700">Select Bed</option>
                    {beds.filter(b => b.roomId === addMemberFormData.roomId && b.status === 'vacant').map(b => (
                      <option key={b.id} value={b.id} className="dark:bg-gray-700">Bed {b.bedNumber}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Rent Amount</label>
                  <input
                    type="number"
                    required
                    value={addMemberFormData.rentAmount}
                    onChange={(e) => setAddMemberFormData({ ...addMemberFormData, rentAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Security Deposit</label>
                  <input
                    type="number"
                    required
                    value={addMemberFormData.deposit}
                    onChange={(e) => setAddMemberFormData({ ...addMemberFormData, deposit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Joining Date</label>
                  <input
                    type="date"
                    required
                    value={addMemberFormData.joiningDate}
                    onChange={(e) => setAddMemberFormData({ ...addMemberFormData, joiningDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Billing Cycle</label>
                  <select
                    required
                    value={addMemberFormData.billingType}
                    onChange={(e) => setAddMemberFormData({ ...addMemberFormData, billingType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="anniversary" className="dark:bg-gray-700">Joining Date (Monthly)</option>
                    <option value="fixed_first" className="dark:bg-gray-700">Fixed (1st of Month)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  Register Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Rent Modal */}
      {isCollectRentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Collect Rent</h3>
              <button onClick={() => setIsCollectRentModalOpen(false)} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCollectRent} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Member</label>
                <select
                  required
                  value={collectRentFormData.memberId}
                  onChange={(e) => {
                    const member = members.find(m => m.id === e.target.value);
                    if (member) {
                      const duesInfo = getDuesInfo(member, payments);
                      const isInitial = !member.lastPaidMonth;
                      setCollectRentFormData({ 
                        ...collectRentFormData, 
                        memberId: e.target.value,
                        amount: duesInfo.remaining.toString(),
                        month: duesInfo.targetMonth,
                        notes: isInitial ? 'Initial Payment (Deposit + Rent)' : ''
                      });
                    } else {
                      setCollectRentFormData({ 
                        ...collectRentFormData, 
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
                    <option key={m.id} value={m.id} className="dark:bg-gray-700">{m.name} (Room {rooms.find(r => r.id === m.roomId)?.roomNumber})</option>
                  ))}
                </select>
              </div>

              {collectRentFormData.memberId && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl">
                  {(() => {
                    const m = members.find(m => m.id === collectRentFormData.memberId);
                    if (!m) return null;
                    const duesInfo = getDuesInfo(m, payments);
                    const isInitial = !m.lastPaidMonth;
                    const expected = duesInfo.expected;
                    return (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                            {isInitial ? 'Initial Payment' : 'Expected Amount'}
                          </span>
                          <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">₹{expected}</span>
                        </div>
                        {isInitial && (
                          <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1">Includes Rent (₹{m.rentAmount}) + Deposit (₹{m.deposit})</p>
                        )}
                        {!isInitial && duesInfo.remaining < expected && (
                          <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1">Remaining: ₹{duesInfo.remaining}</p>
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
                    value={collectRentFormData.amount}
                    onChange={(e) => setCollectRentFormData({ ...collectRentFormData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  {(() => {
                    const m = members.find(m => m.id === collectRentFormData.memberId);
                    if (!m) return null;
                    const duesInfo = getDuesInfo(m, payments);
                    const expected = duesInfo.expected;
                    const amount = Number(collectRentFormData.amount);
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
                    value={collectRentFormData.month}
                    onChange={(e) => setCollectRentFormData({ ...collectRentFormData, month: e.target.value })}
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
                    value={collectRentFormData.date}
                    onChange={(e) => setCollectRentFormData({ ...collectRentFormData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Method</label>
                  <select
                    value={collectRentFormData.method}
                    onChange={(e) => setCollectRentFormData({ ...collectRentFormData, method: e.target.value })}
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
                  value={collectRentFormData.notes}
                  onChange={(e) => setCollectRentFormData({ ...collectRentFormData, notes: e.target.value })}
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
    </div>
  );
};

export default Dashboard;
