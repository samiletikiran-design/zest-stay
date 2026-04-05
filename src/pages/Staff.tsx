import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  UserCircle, 
  Phone, 
  Briefcase, 
  Wallet, 
  Calendar,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Edit2,
  Building2
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, orderBy, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { useSubscription } from '../SubscriptionContext';
import { Staff, SalaryPayment } from '../types';
import { format, addMonths, isBefore, startOfMonth, parseISO, isAfter } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { safeFormat } from '../lib/utils';

const StaffPage = () => {
  const navigate = useNavigate();
  const { organization, currentHostel, hostels, setCurrentHostel } = useAuth();
  const { isExpired, canAddStaff } = useSubscription();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    role: 'cook',
    phone: '',
    salary: '',
    joinDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    role: 'cook',
    phone: '',
    salary: '',
    joinDate: '',
  });

  const [salaryData, setSalaryData] = useState({
    amount: '',
    month: format(new Date(), 'yyyy-MM'),
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    if (!organization || !currentHostel) return;

    const orgId = organization.id;
    const hostelId = currentHostel.id;

    const unsubStaff = onSnapshot(
      query(collection(db, 'staff'), where('organizationId', '==', orgId), where('hostelId', '==', hostelId)),
      (snap) => {
        const list: Staff[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as Staff, id: doc.id }));
        setStaff(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'staff');
        setLoading(false);
      }
    );

    const unsubSalaries = onSnapshot(
      query(collection(db, 'staffSalaries'), where('organizationId', '==', orgId), where('hostelId', '==', hostelId), orderBy('date', 'desc')),
      (snap) => {
        const list: SalaryPayment[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as SalaryPayment, id: doc.id }));
        setSalaries(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'staffSalaries')
    );

    return () => {
      unsubStaff();
      unsubSalaries();
    };
  }, [organization, currentHostel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !currentHostel) return;

    if (isExpired) {
      toast.error('Your subscription has expired. Please renew to add staff members.');
      return;
    }

    try {
      await addDoc(collection(db, 'staff'), {
        organizationId: organization.id,
        hostelId: currentHostel.id,
        name: formData.name,
        role: formData.role,
        phone: `+91${formData.phone}`,
        salary: Number(formData.salary),
        joinDate: formData.joinDate,
        status: 'active',
      });

      setIsModalOpen(false);
      toast.success('Staff member added successfully!');
      setFormData({
        name: '',
        role: 'cook',
        phone: '',
        salary: '',
        joinDate: format(new Date(), 'yyyy-MM-dd'),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'staff');
      toast.error('Failed to add staff member.');
    }
  };

  const handleSalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !currentHostel || !selectedStaff) return;

    if (!canAddStaff) {
      toast.error('Your current plan does not allow recording salaries. Please upgrade to Unlimited plan.', {
        action: {
          label: 'Upgrade Now',
          onClick: () => navigate('/settings?tab=subscription')
        }
      });
      return;
    }

    try {
      await addDoc(collection(db, 'staffSalaries'), {
        organizationId: organization.id,
        hostelId: currentHostel.id,
        staffId: selectedStaff.id,
        amount: Number(salaryData.amount),
        month: salaryData.month,
        date: salaryData.date,
        status: 'paid',
      });

      setIsSalaryModalOpen(false);
      toast.success('Salary payment recorded successfully!');
      setSalaryData({
        amount: '',
        month: format(new Date(), 'yyyy-MM'),
        date: format(new Date(), 'yyyy-MM-dd'),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'staffSalaries');
      toast.error('Failed to record salary payment.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !selectedStaff) return;

    if (!canAddStaff) {
      toast.error('Your current plan does not allow editing staff. Please upgrade to Unlimited plan.', {
        action: {
          label: 'Upgrade Now',
          onClick: () => navigate('/settings?tab=subscription')
        }
      });
      return;
    }

    try {
      await updateDoc(doc(db, 'staff', selectedStaff.id), {
        name: editFormData.name,
        role: editFormData.role,
        phone: `+91${editFormData.phone}`,
        salary: Number(editFormData.salary),
        joinDate: editFormData.joinDate,
      });

      setIsEditModalOpen(false);
      setSelectedStaff(null);
      toast.success('Staff details updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `staff/${selectedStaff.id}`);
      toast.error('Failed to update staff details.');
    }
  };

  const handleDelete = async () => {
    if (!staffToDelete) return;

    if (!canAddStaff) {
      toast.error('Your current plan does not allow deleting staff. Please upgrade to Unlimited plan.', {
        action: {
          label: 'Upgrade Now',
          onClick: () => navigate('/settings?tab=subscription')
        }
      });
      return;
    }
    try {
      await deleteDoc(doc(db, 'staff', staffToDelete));
      toast.success('Staff member deleted successfully!');
      setIsDeleteModalOpen(false);
      setStaffToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `staff/${staffToDelete}`);
      toast.error('Failed to delete staff member.');
    }
  };

  const getSalaryStatus = (member: Staff) => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const joiningMonth = format(parseISO(member.joinDate), 'yyyy-MM');
    const nextMonthAfterJoining = format(addMonths(startOfMonth(parseISO(member.joinDate)), 1), 'yyyy-MM');
    
    // If current month is before or same as joining month, no salary due yet (based on user request)
    if (currentMonth <= joiningMonth) {
      return { status: 'none', label: '' };
    }

    const isPaid = salaries.some(s => s.staffId === member.id && s.month === currentMonth);
    
    if (isPaid) {
      return { status: 'paid', label: 'Paid' };
    } else {
      return { status: 'due', label: 'Due' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Management</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your hostel team</p>
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
              if (!canAddStaff) {
                toast.error('Your current plan does not allow adding staff. Please upgrade to Unlimited plan.', {
                  action: {
                    label: 'Upgrade Now',
                    onClick: () => navigate('/settings?tab=subscription')
                  }
                });
                return;
              }
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            Add Staff Member
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-full flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : staff.length > 0 ? (
              staff.map((member) => (
                <div key={member.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                        {(member.name || 'U').charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 dark:text-white">{member.name}</h3>
                          {(() => {
                            const { status, label } = getSalaryStatus(member);
                            if (status === 'none') return null;
                            return (
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                status === 'paid' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse'
                              }`}>
                                {label}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{member.role}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          setSelectedStaff(member);
                          setSalaryData(prev => ({ ...prev, amount: member.salary.toString() }));
                          setIsSalaryModalOpen(true);
                        }}
                        className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                        title="Pay Salary"
                      >
                        <Wallet className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedStaff(member);
                          setEditFormData({
                            name: member.name,
                            role: member.role,
                            phone: member.phone.replace('+91', ''),
                            salary: member.salary.toString(),
                            joinDate: member.joinDate,
                          });
                          setIsEditModalOpen(true);
                        }}
                        className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => {
                          setStaffToDelete(member.id);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      {member.phone}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Wallet className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      Salary: ₹{member.salary}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      Joined: {safeFormat(member.joinDate, 'MMM d, yyyy')}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full bg-white dark:bg-gray-800 p-12 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400">
                No staff members added yet.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">Salary History</h3>
              <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {salaries.length > 0 ? (
                salaries.map((salary) => {
                  const staffMember = staff.find(s => s.id === salary.staffId);
                  return (
                    <div key={salary.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{staffMember?.name || 'Unknown'}</p>
                        <p className="text-sm font-bold text-green-600 dark:text-green-400">₹{salary.amount}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{safeFormat(salary.date, 'MMM d, yyyy')}</p>
                        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase">{salary.month}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No salary records found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Staff Member</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="cook" className="dark:bg-gray-800">Cook</option>
                    <option value="cleaner" className="dark:bg-gray-800">Cleaner</option>
                    <option value="warden" className="dark:bg-gray-800">Warden</option>
                    <option value="security" className="dark:bg-gray-800">Security</option>
                    <option value="other" className="dark:bg-gray-800">Other</option>
                  </select>
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
                      placeholder="10-digit number"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      className="w-full pl-12 pr-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Monthly Salary (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Join Date</label>
                  <input
                    type="date"
                    required
                    value={formData.joinDate}
                    onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  Save Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Salary Modal */}
      {isSalaryModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-indigo-600 text-white">
              <h3 className="text-lg font-bold">Pay Salary: {selectedStaff.name}</h3>
              <button onClick={() => setIsSalaryModalOpen(false)} className="p-2 hover:bg-indigo-500 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <form onSubmit={handleSalarySubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={salaryData.amount}
                  onChange={(e) => setSalaryData({ ...salaryData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Month</label>
                  <input
                    type="month"
                    required
                    value={salaryData.month}
                    onChange={(e) => setSalaryData({ ...salaryData, month: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={salaryData.date}
                    onChange={(e) => setSalaryData({ ...salaryData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {isEditModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-indigo-600 text-white">
              <h3 className="text-lg font-bold">Edit Staff Member</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-indigo-500 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="cook" className="dark:bg-gray-800">Cook</option>
                    <option value="cleaner" className="dark:bg-gray-800">Cleaner</option>
                    <option value="warden" className="dark:bg-gray-800">Warden</option>
                    <option value="security" className="dark:bg-gray-800">Security</option>
                    <option value="other" className="dark:bg-gray-800">Other</option>
                  </select>
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
                      placeholder="10-digit number"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      className="w-full pl-12 pr-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Monthly Salary (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={editFormData.salary}
                    onChange={(e) => setEditFormData({ ...editFormData, salary: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Join Date</label>
                  <input
                    type="date"
                    required
                    value={editFormData.joinDate}
                    onChange={(e) => setEditFormData({ ...editFormData, joinDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  Update Staff Member
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
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Staff Member?</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">This action cannot be undone. All records for this staff member will be removed.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
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

export default StaffPage;
