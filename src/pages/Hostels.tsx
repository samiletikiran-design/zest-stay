import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Building2, 
  MapPin, 
  Edit2, 
  Trash2, 
  X,
  AlertCircle,
  AlertTriangle,
  Users
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { useSubscription } from '../SubscriptionContext';
import { Hostel } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { safeFormat } from '../lib/utils';
import { useHostelManagement } from '../hooks/useHostelManagement';
import AddHostelModal from '../components/AddHostelModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Hostels = () => {
  const { organization, hostels, refreshUserData } = useAuth();
  const { isExpired, maxProperties } = useSubscription();
  const { 
    isAddHostelModalOpen, 
    setIsAddHostelModalOpen, 
    addHostelFormData, 
    setAddHostelFormData, 
    handleAddHostel 
  } = useHostelManagement();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedHostel, setSelectedHostel] = useState<Hostel | null>(null);
  const [activeMembersCount, setActiveMembersCount] = useState(0);
  const [confirmText, setConfirmText] = useState('');
  const [isCheckingMembers, setIsCheckingMembers] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    address: '',
  });

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHostel) return;

    try {
      await updateDoc(doc(db, 'hostels', selectedHostel.id), {
        name: editFormData.name,
        address: editFormData.address,
      });
      
      if (refreshUserData) {
        await refreshUserData();
      }
      
      setIsEditModalOpen(false);
      setSelectedHostel(null);
      toast.success('Hostel updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `hostels/${selectedHostel.id}`);
      toast.error('Failed to update hostel.');
    }
  };

  useEffect(() => {
    const checkActiveMembers = async () => {
      if (isDeleteModalOpen && selectedHostel && organization) {
        setIsCheckingMembers(true);
        try {
          const q = query(
            collection(db, 'members'),
            where('organizationId', '==', organization.id),
            where('hostelId', '==', selectedHostel.id),
            where('status', '==', 'active')
          );
          const snapshot = await getDocs(q);
          setActiveMembersCount(snapshot.size);
        } catch (error) {
          console.error('Error checking active members:', error);
        } finally {
          setIsCheckingMembers(false);
        }
      }
    };

    checkActiveMembers();
  }, [isDeleteModalOpen, selectedHostel, organization]);

  const handleDeleteHostel = async () => {
    if (!selectedHostel) return;

    if (confirmText !== selectedHostel.name) {
      toast.error('Confirmation text does not match.');
      return;
    }

    // Check if hostel is the only one
    if (hostels.length <= 1) {
      toast.error('Cannot delete the only hostel. At least one hostel is required.');
      setIsDeleteModalOpen(false);
      return;
    }

    try {
      await deleteDoc(doc(db, 'hostels', selectedHostel.id));
      
      if (refreshUserData) {
        await refreshUserData();
      }
      
      setIsDeleteModalOpen(false);
      setSelectedHostel(null);
      toast.success('Hostel deleted successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `hostels/${selectedHostel.id}`);
      toast.error('Failed to delete hostel.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Hostels</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Add, edit or remove your hostels/PGs</p>
        </div>
        <button 
          onClick={() => {
            if (isExpired) {
              toast.error('Your subscription has expired. Please renew to add new hostels.');
              return;
            }
            if (hostels.length >= maxProperties) {
              toast.error(`You have reached the limit of ${maxProperties} properties for your current plan. Please upgrade to a higher plan to add more hostels.`);
              return;
            }
            setIsAddHostelModalOpen(true);
          }}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg whitespace-nowrap",
            (isExpired || hostels.length >= maxProperties)
              ? "bg-gray-400 text-white cursor-not-allowed shadow-none" 
              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
          )}
        >
          <Plus className="w-5 h-5" />
          Add New Hostel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hostels.map((hostel) => (
          <div key={hostel.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{hostel.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Created on {safeFormat(hostel.createdAt, 'MMM d, yyyy')}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => {
                    setSelectedHostel(hostel);
                    setEditFormData({ name: hostel.name, address: hostel.address || '' });
                    setIsEditModalOpen(true);
                  }}
                  className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => {
                    setSelectedHostel(hostel);
                    setIsDeleteModalOpen(true);
                  }}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
              <span>{hostel.address || 'No address provided'}</span>
            </div>
          </div>
        ))}
      </div>

      <AddHostelModal 
        isOpen={isAddHostelModalOpen}
        onClose={() => setIsAddHostelModalOpen(false)}
        formData={addHostelFormData}
        setFormData={setAddHostelFormData}
        onSubmit={handleAddHostel}
      />

      {/* Edit Hostel Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Hostel</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Hostel Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                <textarea
                  rows={3}
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  Update Hostel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedHostel && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">Delete Hostel?</h3>
              
              <div className="space-y-4 mb-6">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>CRITICAL WARNING</span>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                    This action is <span className="font-bold underline">permanent</span> and cannot be recovered. 
                    Deleting <span className="font-bold">"{selectedHostel.name}"</span> will result in the loss of:
                  </p>
                  <ul className="text-[11px] text-red-600 dark:text-red-400 list-disc list-inside space-y-1 ml-1">
                    <li>All room and bed configurations</li>
                    <li>All resident data and history</li>
                    <li>All payment records and receipts</li>
                    <li>All expense tracking data</li>
                    <li>All staff assignments</li>
                  </ul>
                </div>

                {activeMembersCount > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm mb-1">
                      <Users className="w-4 h-4" />
                      <span>Active Residents Found</span>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      There are currently <span className="font-bold">{activeMembersCount} active residents</span> in this hostel. 
                      Please ensure they are vacated or moved before proceeding.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    To confirm, please type <span className="font-bold text-gray-900 dark:text-white select-all">"{selectedHostel.name}"</span> below:
                  </p>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type hostel name here"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setConfirmText('');
                  }}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteHostel}
                  disabled={confirmText !== selectedHostel.name || isCheckingMembers}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-100 dark:shadow-none"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hostels;
