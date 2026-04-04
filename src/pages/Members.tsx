import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Phone, 
  MapPin, 
  Calendar,
  Filter,
  X,
  UserPlus,
  Trash2,
  Edit2,
  Receipt,
  TrendingUp,
  Eye,
  AlertCircle,
  CreditCard,
  Building2,
  MessageSquare,
  Smartphone
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { useSubscription } from '../SubscriptionContext';
import { Member, Room, Bed, Payment } from '../types';
import { format, addMonths, isAfter, startOfMonth, endOfMonth, isBefore, addDays, startOfDay, differenceInMonths, parseISO, subMonths } from 'date-fns';
import { safeFormat } from '../lib/utils';
import { getDuesInfo, calculateProRataRent } from '../lib/dues';

import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Members = () => {
  const { organization, currentHostel, hostels, setCurrentHostel } = useAuth();
  const { isExpired, canAccessReminders } = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCollectRentModalOpen, setIsCollectRentModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberPayments, setMemberPayments] = useState<Payment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [dueFilter, setDueFilter] = useState<'all' | 'overdue' | 'today' | 'tomorrow' | 'next2' | 'next3'>('all');
  const [rentFormData, setRentFormData] = useState({
    amount: '',
    month: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    method: 'cash' as 'cash' | 'upi' | 'bank',
    notes: '',
  });

  // Form State
  const [formData, setFormData] = useState({
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

  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    idProof: '',
    roomId: '',
    bedId: '',
    rentAmount: '',
    deposit: '',
    joiningDate: '',
    status: 'active' as 'active' | 'inactive',
  });

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setIsModalOpen(true);
      
      const roomId = searchParams.get('roomId');
      const bedId = searchParams.get('bedId');
      
      if (roomId || bedId) {
        setFormData(prev => ({
          ...prev,
          roomId: roomId || prev.roomId,
          bedId: bedId || prev.bedId
        }));
      }

      // Remove the parameter after opening
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('add');
      newParams.delete('roomId');
      newParams.delete('bedId');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!organization || !currentHostel) return;

    const orgId = organization.id;
    const hostelId = currentHostel.id;
    
    const unsubMembers = onSnapshot(
      query(collection(db, 'members'), where('organizationId', '==', orgId), where('hostelId', '==', hostelId)),
      (snap) => {
        const list: Member[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as Member, id: doc.id }));
        setMembers(list);
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'members')
    );

    const unsubRooms = onSnapshot(
      query(collection(db, 'rooms'), where('organizationId', '==', orgId), where('hostelId', '==', hostelId)),
      (snap) => {
        const list: Room[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as Room, id: doc.id }));
        setRooms(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'rooms')
    );

    const unsubBeds = onSnapshot(
      query(collection(db, 'beds'), where('organizationId', '==', orgId), where('hostelId', '==', hostelId)),
      (snap) => {
        const list: Bed[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as Bed, id: doc.id }));
        setBeds(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'beds')
    );

    const unsubPayments = onSnapshot(
      query(collection(db, 'payments'), where('organizationId', '==', orgId), where('hostelId', '==', hostelId)),
      (snap) => {
        const list: Payment[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as Payment, id: doc.id }));
        setPayments(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'payments')
    );

    return () => {
      unsubMembers();
      unsubRooms();
      unsubBeds();
      unsubPayments();
    };
  }, [organization, currentHostel]);

  useEffect(() => {
    const memberId = searchParams.get('id');
    if (memberId && members.length > 0) {
      const member = members.find(m => m.id === memberId);
      if (member) {
        setSelectedMember(member);
        setIsDetailModalOpen(true);
        // Clear param after opening
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, members, setSearchParams]);

  useEffect(() => {
    if (!isDetailModalOpen || !selectedMember) {
      setMemberPayments([]);
      return;
    }

    const q = query(
      collection(db, 'payments'),
      where('organizationId', '==', organization.id),
      where('memberId', '==', selectedMember.id),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: Payment[] = [];
      snap.forEach(doc => list.push({ ...doc.data() as Payment, id: doc.id }));
      setMemberPayments(list);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'payments'));

    return () => unsub();
  }, [isDetailModalOpen, selectedMember]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !currentHostel) return;

    if (isExpired) {
      toast.error('Your subscription has expired. Please renew to add new members.');
      return;
    }

    try {
      const newMember = {
        ...formData,
        phone: `+91${formData.phone}`,
        organizationId: organization.id,
        hostelId: currentHostel.id,
        rentAmount: Number(formData.rentAmount),
        deposit: Number(formData.deposit),
        status: 'active' as const,
        lastPaidMonth: format(subMonths(parseISO(formData.joiningDate), 1), 'yyyy-MM'), // Set to previous month so joining month is due
      };

      try {
        await addDoc(collection(db, 'members'), newMember);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'members');
      }
      
      // Update Bed status
      if (formData.bedId) {
        try {
          await updateDoc(doc(db, 'beds', formData.bedId), { status: 'occupied' });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `beds/${formData.bedId}`);
        }
      }

      setIsModalOpen(false);
      setFormData({
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
      console.error('Error adding member:', error);
      toast.error('Failed to add member.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !selectedMember) return;

    try {
      const batch = writeBatch(db);
      
      // If bed changed, update old and new bed status
      if (editFormData.bedId !== selectedMember.bedId) {
        // Release old bed
        if (selectedMember.bedId) {
          batch.update(doc(db, 'beds', selectedMember.bedId), { status: 'vacant' });
        }
        // Occupy new bed
        if (editFormData.bedId) {
          batch.update(doc(db, 'beds', editFormData.bedId), { status: 'occupied' });
        }
      }

      // Update member details
      batch.update(doc(db, 'members', selectedMember.id), {
        name: editFormData.name,
        phone: `+91${editFormData.phone}`,
        idProof: editFormData.idProof,
        roomId: editFormData.roomId,
        bedId: editFormData.bedId,
        rentAmount: Number(editFormData.rentAmount),
        deposit: Number(editFormData.deposit),
        joiningDate: editFormData.joiningDate,
        status: editFormData.status,
      });

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch-update-member');
      }
      setIsEditModalOpen(false);
      setSelectedMember(null);
      toast.success('Member details updated successfully!');
    } catch (error) {
      console.error('Error updating member:', error);
      toast.error('Failed to update member.');
    }
  };

  const handleDeleteMember = async () => {
    if (!selectedMember) return;

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'members', selectedMember.id));
      if (selectedMember.bedId) {
        batch.update(doc(db, 'beds', selectedMember.bedId), { status: 'vacant' });
      }
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch-delete-member');
      }
      setIsDeleteModalOpen(false);
      setSelectedMember(null);
    } catch (error) {
      console.error('Error deleting member:', error);
      toast.error('Failed to delete member.');
    }
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = (m.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
                         (m.phone || '').includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    
    if (dueFilter === 'all') return matchesSearch && matchesStatus;
    
    const dues = getDuesInfo(m, payments);
    const today = startOfDay(new Date());
    const dueDate = startOfDay(dues.dueDate);
    
    let matchesDue = false;
    if (dueFilter === 'overdue') matchesDue = dues.isOverdue;
    else if (dueFilter === 'today') matchesDue = dues.isDueToday;
    else if (dueFilter === 'tomorrow') matchesDue = isBefore(dueDate, addDays(today, 2));
    else if (dueFilter === 'next2') matchesDue = isBefore(dueDate, addDays(today, 3));
    else if (dueFilter === 'next3') matchesDue = isBefore(dueDate, addDays(today, 4));
    
    return matchesSearch && matchesStatus && matchesDue;
  });

  const handleCollectRent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !organization || !currentHostel) return;

    try {
      const amount = Number(rentFormData.amount);
      const isInitial = !selectedMember.lastPaidMonth;
      const expectedAmount = isInitial 
        ? selectedMember.rentAmount + selectedMember.deposit 
        : selectedMember.rentAmount;

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
          memberId: selectedMember.id,
          memberName: selectedMember.name,
          amount: amount,
          month: rentFormData.month,
          date: rentFormData.date,
          method: rentFormData.method,
          status: status,
          notes: rentFormData.notes,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'payments');
      }

      // 2. Update member's lastPaidMonth
      // Only update if it's fully paid or if it's the latest month
      if (status === 'paid' || (selectedMember.lastPaidMonth && rentFormData.month > selectedMember.lastPaidMonth)) {
        try {
          await updateDoc(doc(db, 'members', selectedMember.id), {
            lastPaidMonth: rentFormData.month
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `members/${selectedMember.id}`);
        }
      }

      setIsCollectRentModalOpen(false);
      toast.success(status === 'partial' ? 'Partial payment recorded!' : 'Rent collected successfully!');
    } catch (error) {
      console.error('Error collecting rent:', error);
      toast.error('Failed to collect rent.');
    }
  };

  const openCollectRent = (member: Member) => {
    const duesInfo = getDuesInfo(member, payments);
    const monthStr = duesInfo.targetMonth;
    
    let amount = duesInfo.remaining;
    const isInitial = !member.lastPaidMonth; // We can still use this as a hint, or check if it's the joining month

    setRentFormData({
      amount: amount.toString(),
      month: monthStr,
      date: format(new Date(), 'yyyy-MM-dd'),
      method: 'cash',
      notes: isInitial ? 'Initial Payment (Deposit + Rent)' : '',
    });
    setSelectedMember(member);
    setIsCollectRentModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Members</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Manage hostel residents</p>
        </div>
        <button 
          onClick={() => {
            if (isExpired) {
              toast.error('Your subscription has expired. Please renew to add new members.');
              return;
            }
            setIsModalOpen(true);
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors shadow-lg whitespace-nowrap",
            isExpired 
              ? "bg-gray-400 text-white cursor-not-allowed shadow-none" 
              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
          )}
        >
          <UserPlus className="w-4 h-4 sm:w-5 h-5" />
          <span className="hidden xs:inline">Add New Member</span>
          <span className="xs:hidden">Add</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm text-gray-900 dark:text-white"
          />
        </div>
        {hostels.length > 1 && (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2 sm:px-3 py-2 shadow-sm flex-shrink-0 min-w-0">
            <Building2 className="w-3.5 h-3.5 sm:w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <select 
              value={currentHostel?.id}
              onChange={(e) => setCurrentHostel(e.target.value)}
              className="text-xs sm:text-sm border-none focus:ring-0 bg-transparent font-medium text-gray-700 dark:text-gray-300 p-0 pr-6 sm:pr-8 truncate"
            >
              {hostels.map(h => (
                <option key={h.id} value={h.id} className="dark:bg-gray-800">{h.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2 sm:px-3 py-2 shadow-sm flex-shrink-0 min-w-0">
          <Filter className="w-3.5 h-3.5 sm:w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs sm:text-sm border-none focus:ring-0 bg-transparent font-medium text-gray-700 dark:text-gray-300 p-0 pr-6 sm:pr-8 truncate"
          >
            <option value="all" className="dark:bg-gray-800">All Status</option>
            <option value="active" className="dark:bg-gray-800">Active</option>
            <option value="inactive" className="dark:bg-gray-800">Inactive</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2 sm:px-3 py-2 shadow-sm flex-shrink-0 min-w-0">
          <Calendar className="w-3.5 h-3.5 sm:w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <select 
            value={dueFilter}
            onChange={(e) => setDueFilter(e.target.value as any)}
            className="text-xs sm:text-sm border-none focus:ring-0 bg-transparent font-medium text-gray-700 dark:text-gray-300 p-0 pr-6 sm:pr-8 truncate"
          >
            <option value="all" className="dark:bg-gray-800">All Dues</option>
            <option value="overdue" className="dark:bg-gray-800">Overdue</option>
            <option value="today" className="dark:bg-gray-800">Due Today</option>
            <option value="tomorrow" className="dark:bg-gray-800">Due Tomorrow</option>
            <option value="next2" className="dark:bg-gray-800">Due in 2 Days</option>
            <option value="next3" className="dark:bg-gray-800">Due in 3 Days</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member) => {
            const { isPaid, isOverdue, isDueSoon, isDueToday } = getDuesInfo(member, payments);
            return (
              <div key={member.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all p-6 space-y-4 relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                      {(member.name || 'U').charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{member.name}</h3>
                      <div className="flex gap-2 mt-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${member.status === 'active' ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                          {member.status}
                        </span>
                        {isPaid && <span className="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Paid</span>}
                        {isDueToday && !isPaid && <span className="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase animate-pulse">Due Today</span>}
                        {isOverdue && <span className="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Overdue</span>}
                        {isDueSoon && !isPaid && <span className="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Due Soon</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        setSelectedMember(member);
                        setEditFormData({
                          name: member.name,
                          phone: member.phone.replace('+91', ''),
                          idProof: member.idProof,
                          roomId: member.roomId,
                          bedId: member.bedId,
                          rentAmount: member.rentAmount.toString(),
                          deposit: member.deposit.toString(),
                          joiningDate: member.joiningDate,
                          status: member.status,
                        });
                        setIsEditModalOpen(true);
                      }}
                      className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedMember(member);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    {member.phone}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    Room {rooms.find(r => r.id === member.roomId)?.roomNumber || 'N/A'} • Bed {beds.find(b => b.id === member.bedId)?.bedNumber.split('-')[1] || 'N/A'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    Next Due: {safeFormat(getDuesInfo(member, payments).dueDate, 'MMM d, yyyy')}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">Rent Amount</p>
                      <p className="font-bold text-gray-900 dark:text-white">₹{member.rentAmount}</p>
                    </div>
                    {canAccessReminders && !isPaid && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            const duesInfo = getDuesInfo(member, payments);
                            const message = `Hi ${member.name}, this is a reminder from ${currentHostel?.name} regarding your rent for ${duesInfo.targetMonth}. The pending amount is ₹${duesInfo.remaining}. Please pay by ${safeFormat(duesInfo.dueDate, 'MMM d, yyyy')}. Thank you!`;
                            const whatsappUrl = `https://wa.me/${member.phone.replace('+', '')}?text=${encodeURIComponent(message)}`;
                            window.open(whatsappUrl, '_blank');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-[10px] font-bold hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                          title="WhatsApp Reminder"
                        >
                          <MessageSquare className="w-3 h-3" />
                          WhatsApp
                        </button>
                        <button 
                          onClick={() => {
                            const duesInfo = getDuesInfo(member, payments);
                            const message = `Hi ${member.name}, this is a reminder from ${currentHostel?.name} regarding your rent for ${duesInfo.targetMonth}. The pending amount is ₹${duesInfo.remaining}. Please pay by ${safeFormat(duesInfo.dueDate, 'MMM d, yyyy')}. Thank you!`;
                            const smsUrl = `sms:${member.phone.replace('+', '')}?body=${encodeURIComponent(message)}`;
                            window.open(smsUrl, '_blank');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                          title="SMS Reminder"
                        >
                          <Smartphone className="w-3 h-3" />
                          SMS
                        </button>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedMember(member);
                      setIsDetailModalOpen(true);
                    }}
                    className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline"
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add New Member</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
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
                  value={formData.idProof}
                  onChange={(e) => setFormData({ ...formData, idProof: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Room</label>
                  <select
                    required
                    value={formData.roomId}
                    onChange={(e) => setFormData({ ...formData, roomId: e.target.value, bedId: '' })}
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
                    value={formData.bedId}
                    onChange={(e) => setFormData({ ...formData, bedId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="" className="dark:bg-gray-700">Select Bed</option>
                    {beds.filter(b => b.roomId === formData.roomId && b.status === 'vacant').map(b => (
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
                    value={formData.rentAmount}
                    onChange={(e) => setFormData({ ...formData, rentAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Security Deposit</label>
                  <input
                    type="number"
                    required
                    value={formData.deposit}
                    onChange={(e) => setFormData({ ...formData, deposit: e.target.value })}
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
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Billing Cycle</label>
                  <select
                    required
                    value={formData.billingType}
                    onChange={(e) => setFormData({ ...formData, billingType: e.target.value as any })}
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
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  Register Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {isEditModalOpen && selectedMember && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Member: {selectedMember.name}</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
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
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      className="w-full pl-12 pr-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">ID Proof</label>
                  <input
                    type="text"
                    required
                    value={editFormData.idProof}
                    onChange={(e) => setEditFormData({ ...editFormData, idProof: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  <select
                    required
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="active" className="dark:bg-gray-700">Active</option>
                    <option value="inactive" className="dark:bg-gray-700">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Room</label>
                  <select
                    required
                    value={editFormData.roomId}
                    onChange={(e) => setEditFormData({ ...editFormData, roomId: e.target.value, bedId: '' })}
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
                    value={editFormData.bedId}
                    onChange={(e) => setEditFormData({ ...editFormData, bedId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="" className="dark:bg-gray-700">Select Bed</option>
                    {/* Show current bed even if occupied, plus other vacant beds */}
                    {beds.filter(b => b.roomId === editFormData.roomId && (b.status === 'vacant' || b.id === selectedMember.bedId)).map(b => (
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
                    value={editFormData.rentAmount}
                    onChange={(e) => setEditFormData({ ...editFormData, rentAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Security Deposit</label>
                  <input
                    type="number"
                    required
                    value={editFormData.deposit}
                    onChange={(e) => setEditFormData({ ...editFormData, deposit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Joining Date</label>
                <input
                  type="date"
                  required
                  value={editFormData.joiningDate}
                  onChange={(e) => setEditFormData({ ...editFormData, joiningDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  Update Member Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Detail Modal */}
      {isDetailModalOpen && selectedMember && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-indigo-600 text-white">
              <h3 className="text-lg font-bold">Member Details</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-indigo-500 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 space-y-8 overflow-y-auto max-h-[80vh]">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-4xl shadow-inner">
                  {(selectedMember.name || 'U').charAt(0)}
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{selectedMember.name}</h2>
                  <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                    <Phone className="w-4 h-4" /> {selectedMember.phone}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 rounded-full text-xs font-bold uppercase">
                      {selectedMember.status}
                    </span>
                    <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-bold uppercase">
                      Room {rooms.find(r => r.id === selectedMember.roomId)?.roomNumber}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Accommodation</h4>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Room Number</span>
                    <span className="font-bold text-gray-900 dark:text-white">{rooms.find(r => r.id === selectedMember.roomId)?.roomNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Bed Number</span>
                    <span className="font-bold text-gray-900 dark:text-white">{beds.find(b => b.id === selectedMember.bedId)?.bedNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Joining Date</span>
                    <span className="font-bold text-gray-900 dark:text-white">{safeFormat(selectedMember.joiningDate, 'MMM d, yyyy')}</span>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Financials</h4>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Monthly Rent</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">₹{selectedMember.rentAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Security Deposit</span>
                    <span className="font-bold text-gray-900 dark:text-white">₹{selectedMember.deposit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Billing Day</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {selectedMember.billingType === 'fixed_first' ? 'Every 1st' : `Every ${parseISO(selectedMember.joiningDate).getDate()}th`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Next Due Date</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{safeFormat(getDuesInfo(selectedMember, payments).dueDate, 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-900/30 p-6 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
                    <CreditCard className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">
                      {selectedMember.lastPaidMonth ? 'Last Payment Month' : 'Initial Payment Status'}
                    </p>
                    <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400">
                      {selectedMember.lastPaidMonth 
                        ? safeFormat(selectedMember.lastPaidMonth + '-01', 'MMMM yyyy') 
                        : 'Pending (Deposit + Rent)'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => openCollectRent(selectedMember)}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                  {selectedMember.lastPaidMonth ? 'Collect Rent' : 'Collect Initial Payment'}
                </button>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Payment History
                </h4>
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                  {memberPayments.length > 0 ? (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {memberPayments.map((payment) => (
                        <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                              <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">₹{payment.amount}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{safeFormat(payment.date, 'MMM d, yyyy')} • {payment.method.toUpperCase()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">
                              {safeFormat(payment.month + '-01', 'MMM yyyy')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      No payment records found for this member.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setIsDeleteModalOpen(true);
                  }}
                  className="flex-1 py-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                >
                  Remove Member
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Collect Rent Modal */}
      {isCollectRentModalOpen && selectedMember && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-indigo-600 text-white">
              <h3 className="text-lg font-bold">Collect Rent</h3>
              <button onClick={() => setIsCollectRentModalOpen(false)} className="p-2 hover:bg-indigo-500 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCollectRent} className="p-6 space-y-4">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Member: <span className="font-bold">{selectedMember.name}</span></p>
                    <p className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Room: <span className="font-bold">{rooms.find(r => r.id === selectedMember.roomId)?.roomNumber}</span></p>
                  </div>
                  {!selectedMember.lastPaidMonth && (
                    <div className="bg-indigo-600 text-white px-2 py-1 rounded text-[10px] font-bold uppercase">
                      New Member
                    </div>
                  )}
                </div>
                {!selectedMember.lastPaidMonth && (
                  <div className="mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-800">
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">Initial Payment Required:</p>
                    <p className="text-xs text-indigo-500 dark:text-indigo-500">Rent (₹{selectedMember.rentAmount}) + Deposit (₹{selectedMember.deposit}) = ₹{getDuesInfo(selectedMember, payments).expected}</p>
                  </div>
                )}
                {selectedMember.lastPaidMonth && (
                  <div className="mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-800 flex justify-between items-center">
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">Monthly Rent:</p>
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 font-bold">₹{getDuesInfo(selectedMember, payments).expected}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                    <input
                      type="number"
                      required
                      value={rentFormData.amount}
                      onChange={(e) => setRentFormData({ ...rentFormData, amount: e.target.value })}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  {Number(rentFormData.amount) > 0 && Number(rentFormData.amount) < getDuesInfo(selectedMember, payments).expected && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                      Remaining: ₹{getDuesInfo(selectedMember, payments).expected - Number(rentFormData.amount)}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Month</label>
                  <input
                    type="month"
                    required
                    value={rentFormData.month}
                    onChange={(e) => setRentFormData({ ...rentFormData, month: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={rentFormData.date}
                    onChange={(e) => setRentFormData({ ...rentFormData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Method</label>
                  <select
                    required
                    value={rentFormData.method}
                    onChange={(e) => setRentFormData({ ...rentFormData, method: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="cash" className="dark:bg-gray-700">Cash</option>
                    <option value="upi" className="dark:bg-gray-700">UPI</option>
                    <option value="bank" className="dark:bg-gray-700">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes (Optional)</label>
                <textarea
                  value={rentFormData.notes}
                  onChange={(e) => setRentFormData({ ...rentFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  rows={2}
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedMember && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mx-auto">
                <Trash2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Delete Member</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white">{selectedMember.name}</span>? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setSelectedMember(null);
                  }}
                  className="flex-1 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteMember}
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

export default Members;
