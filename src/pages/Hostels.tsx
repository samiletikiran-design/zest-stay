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
import { Hostel } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { toast } from 'sonner';
import { useHostelManagement } from '../hooks/useHostelManagement';
import AddHostelModal from '../components/AddHostelModal';

const Hostels = () => {
  const { organization, hostels, refreshUserData } = useAuth();
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
          <h1 className="text-2xl font-bold text-gray-900">Manage Hostels</h1>
          <p className="text-sm text-gray-500">Add, edit or remove your hostels/PGs</p>
        </div>
        <button 
          onClick={() => setIsAddHostelModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" />
          Add New Hostel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hostels.map((hostel) => (
          <div key={hostel.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{hostel.name}</h3>
                  <p className="text-xs text-gray-500">Created on {new Date(hostel.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => {
                    setSelectedHostel(hostel);
                    setEditFormData({ name: hostel.name, address: hostel.address || '' });
                    setIsEditModalOpen(true);
                  }}
                  className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => {
                    setSelectedHostel(hostel);
                    setIsDeleteModalOpen(true);
                  }}
                  className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
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
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Edit Hostel</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Hostel Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Address</label>
                <textarea
                  rows={3}
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
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
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">Delete Hostel?</h3>
              
              <div className="space-y-4 mb-6">
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>CRITICAL WARNING</span>
                  </div>
                  <p className="text-xs text-red-600 leading-relaxed">
                    This action is <span className="font-bold underline">permanent</span> and cannot be recovered. 
                    Deleting <span className="font-bold">"{selectedHostel.name}"</span> will result in the loss of:
                  </p>
                  <ul className="text-[11px] text-red-600 list-disc list-inside space-y-1 ml-1">
                    <li>All room and bed configurations</li>
                    <li>All resident data and history</li>
                    <li>All payment records and receipts</li>
                    <li>All expense tracking data</li>
                    <li>All staff assignments</li>
                  </ul>
                </div>

                {activeMembersCount > 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-1">
                      <Users className="w-4 h-4" />
                      <span>Active Residents Found</span>
                    </div>
                    <p className="text-xs text-amber-600">
                      There are currently <span className="font-bold">{activeMembersCount} active residents</span> in this hostel. 
                      Please ensure they are vacated or moved before proceeding.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    To confirm, please type <span className="font-bold text-gray-900 select-all">"{selectedHostel.name}"</span> below:
                  </p>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type hostel name here"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setConfirmText('');
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteHostel}
                  disabled={confirmText !== selectedHostel.name || isCheckingMembers}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-100"
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
