import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Bed, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  XCircle,
  DoorOpen,
  X,
  AlertCircle,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Receipt,
  TrendingUp,
  Building2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc, writeBatch, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Room, Bed as BedType, Member, Payment } from '../types';
import { toast } from 'sonner';
import { format, parseISO, subMonths } from 'date-fns';
import { getDuesInfo, calculateProRataRent } from '../lib/dues';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useHostelManagement } from '../hooks/useHostelManagement';
import AddHostelModal from '../components/AddHostelModal';

const Rooms = () => {
  const { organization, currentHostel, hostels, setCurrentHostel } = useAuth();
  const { 
    isAddHostelModalOpen, 
    setIsAddHostelModalOpen, 
    addHostelFormData, 
    setAddHostelFormData, 
    handleAddHostel 
  } = useHostelManagement();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<BedType[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'vacant' | 'full'>('all');
  const [capacityFilter, setCapacityFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCollectRentModalOpen, setIsCollectRentModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberPayments, setMemberPayments] = useState<Payment[]>([]);
  const [rentFormData, setRentFormData] = useState({
    amount: '',
    month: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    method: 'cash' as 'cash' | 'upi' | 'bank',
    notes: '',
  });

  // Form State
  const [formData, setFormData] = useState({
    roomNumber: '',
    totalBeds: '4',
    type: 'Non-AC' as 'AC' | 'Non-AC',
  });

  const [editFormData, setEditFormData] = useState({
    roomNumber: '',
    totalBeds: '4',
    type: 'Non-AC' as 'AC' | 'Non-AC',
  });

  useEffect(() => {
    if (!organization || !currentHostel) return;

    const orgId = organization.id;
    const hostelId = currentHostel.id;
    
    const unsubRooms = onSnapshot(
      query(collection(db, 'rooms'), where('organizationId', '==', orgId), where('hostelId', '==', hostelId)),
      (snap) => {
        const list: Room[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as Room, id: doc.id }));
        setRooms(list);
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'rooms')
    );

    const unsubBeds = onSnapshot(
      query(collection(db, 'beds'), where('organizationId', '==', orgId), where('hostelId', '==', hostelId)),
      (snap) => {
        const list: BedType[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as BedType, id: doc.id }));
        setBeds(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'beds')
    );

    const unsubMembers = onSnapshot(
      query(collection(db, 'members'), where('organizationId', '==', orgId), where('hostelId', '==', hostelId)),
      (snap) => {
        const list: Member[] = [];
        snap.forEach(doc => list.push({ ...doc.data() as Member, id: doc.id }));
        setMembers(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'members')
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
      unsubRooms();
      unsubBeds();
      unsubMembers();
      unsubPayments();
    };
  }, [organization, currentHostel]);

  useEffect(() => {
    if (!isDetailModalOpen || !selectedMember) {
      setMemberPayments([]);
      return;
    }

    const q = query(
      collection(db, 'payments'),
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

  const handleCollectRent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !organization || !currentHostel) return;

    try {
      const amount = Number(rentFormData.amount);
      const duesInfo = getDuesInfo(selectedMember, payments);
      const expectedAmount = duesInfo.expected;
      
      const status = amount >= expectedAmount ? 'paid' : 'partial';

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
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'payments');
      }

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
      toast.success('Rent collected successfully!');
    } catch (error) {
      console.error('Error collecting rent:', error);
      toast.error('Failed to collect rent.');
    }
  };

  const openCollectRent = (member: Member) => {
    const duesInfo = getDuesInfo(member, payments);
    const monthStr = duesInfo.targetMonth;
    
    let amount = duesInfo.remaining;
    const isInitial = !member.lastPaidMonth;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !currentHostel) return;

    try {
      const numBeds = Number(formData.totalBeds);
      let roomRef;
      try {
        roomRef = await addDoc(collection(db, 'rooms'), {
          organizationId: organization.id,
          hostelId: currentHostel.id,
          roomNumber: formData.roomNumber,
          totalBeds: numBeds,
          type: formData.type,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'rooms');
        return; // Stop if room creation fails
      }

      // Create beds for this room
      const batch = writeBatch(db);
      for (let i = 1; i <= numBeds; i++) {
        const bedRef = doc(collection(db, 'beds'));
        batch.set(bedRef, {
          organizationId: organization.id,
          hostelId: currentHostel.id,
          roomId: roomRef.id,
          bedNumber: `${formData.roomNumber}-${String.fromCharCode(64 + i)}`,
          status: 'vacant',
        });
      }
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch-create-beds');
      }

      setIsModalOpen(false);
      toast.success('Room and beds created successfully!');
      setFormData({ roomNumber: '', totalBeds: '4', type: 'Non-AC' });
    } catch (error) {
      console.error('Error adding room:', error);
      toast.error('Failed to add room.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !editingRoom) return;

    try {
      const numBeds = Number(editFormData.totalBeds);
      const oldBeds = beds.filter(b => b.roomId === editingRoom.id);
      
      // If total beds increased, add more beds
      if (numBeds > editingRoom.totalBeds) {
        const batch = writeBatch(db);
        for (let i = editingRoom.totalBeds + 1; i <= numBeds; i++) {
          const bedRef = doc(collection(db, 'beds'));
          batch.set(bedRef, {
            organizationId: organization.id,
            hostelId: currentHostel.id,
            roomId: editingRoom.id,
            bedNumber: `${editFormData.roomNumber}-${String.fromCharCode(64 + i)}`,
            status: 'vacant',
          });
        }
        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'batch-add-beds');
        }
      } 
      // If total beds decreased, check if any of the removed beds are occupied
      else if (numBeds < editingRoom.totalBeds) {
        const sortedOldBeds = [...oldBeds].sort((a, b) => a.bedNumber.localeCompare(b.bedNumber));
        const bedsToRemove = sortedOldBeds.slice(numBeds);
        const isAnyOccupied = bedsToRemove.some(b => b.status === 'occupied');
        if (isAnyOccupied) {
          toast.error('Cannot reduce bed capacity: Some of the beds to be removed are currently occupied.');
          return;
        }
        const batch = writeBatch(db);
        bedsToRemove.forEach(b => {
          batch.delete(doc(db, 'beds', b.id));
        });
        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'batch-delete-beds');
        }
      }

      // Update room details
      try {
        await updateDoc(doc(db, 'rooms', editingRoom.id), {
          roomNumber: editFormData.roomNumber,
          totalBeds: numBeds,
          type: editFormData.type,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `rooms/${editingRoom.id}`);
      }

      // Update existing bed numbers if room number changed
      if (editFormData.roomNumber !== editingRoom.roomNumber) {
        const batch = writeBatch(db);
        const remainingBeds = beds
          .filter(b => b.roomId === editingRoom.id)
          .sort((a, b) => a.bedNumber.localeCompare(b.bedNumber))
          .slice(0, numBeds);
        remainingBeds.forEach((b, index) => {
          batch.update(doc(db, 'beds', b.id), {
            bedNumber: `${editFormData.roomNumber}-${String.fromCharCode(64 + index + 1)}`
          });
        });
        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'batch-update-bed-numbers');
        }
      }

      setIsEditModalOpen(false);
      setEditingRoom(null);
      toast.success('Room details updated successfully!');
    } catch (error) {
      console.error('Error updating room:', error);
      toast.error('Failed to update room.');
    }
  };

  const handleDeleteRoom = async () => {
    if (!roomToDelete) return;

    try {
      const roomBeds = beds.filter(b => b.roomId === roomToDelete);
      const isOccupied = roomBeds.some(b => b.status === 'occupied');
      
      if (isOccupied) {
        toast.error('Cannot delete room with occupied beds. Please vacate the beds first.');
        setIsDeleteModalOpen(false);
        setRoomToDelete(null);
        return;
      }

      const batch = writeBatch(db);
      roomBeds.forEach(b => {
        batch.delete(doc(db, 'beds', b.id));
      });
      batch.delete(doc(db, 'rooms', roomToDelete));
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch-delete-room');
      }
      toast.success('Room and beds deleted successfully!');
      setIsDeleteModalOpen(false);
      setRoomToDelete(null);
    } catch (error) {
      console.error('Error deleting room:', error);
      toast.error('Failed to delete room.');
    }
  };

  const filteredRooms = rooms.filter(room => {
    const roomBeds = beds.filter(b => b.roomId === room.id);
    const occupiedCount = roomBeds.filter(b => b.status === 'occupied').length;
    
    const matchesStatus = filter === 'all' || 
      (filter === 'vacant' && occupiedCount < room.totalBeds) || 
      (filter === 'full' && occupiedCount === room.totalBeds);
      
    const matchesCapacity = capacityFilter === 'all' || 
      (capacityFilter === '4+' ? room.totalBeds >= 4 : room.totalBeds === Number(capacityFilter));
      
    return matchesStatus && matchesCapacity;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rooms & Beds</h1>
            <p className="text-gray-500">Manage hostel accommodation</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="sm:hidden flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            Add Room
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setIsAddHostelModalOpen(true)}
            className="flex items-center justify-center gap-1.5 sm:gap-2 bg-white border border-gray-200 text-gray-700 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap flex-shrink-0"
          >
            <Building2 className="w-4 h-4 sm:w-5 h-5" />
            Add Hostel
          </button>
          {hostels.length > 1 && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
              <Building2 className="w-4 h-4 text-gray-400" />
              <select 
                value={currentHostel?.id}
                onChange={(e) => setCurrentHostel(e.target.value)}
                className="text-sm border-none focus:ring-0 bg-transparent font-medium text-gray-700 p-0 pr-8"
              >
                {hostels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="text-sm border-none focus:ring-0 bg-transparent font-medium text-gray-700 p-0 pr-8"
            >
              <option value="all">All Status</option>
              <option value="vacant">With Vacancy</option>
              <option value="full">Fully Occupied</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <Bed className="w-4 h-4 text-gray-400" />
            <select 
              value={capacityFilter}
              onChange={(e) => setCapacityFilter(e.target.value)}
              className="text-sm border-none focus:ring-0 bg-transparent font-medium text-gray-700 p-0 pr-8"
            >
              <option value="all">All Capacities</option>
              <option value="1">1 Bed</option>
              <option value="2">2 Beds</option>
              <option value="3">3 Beds</option>
              <option value="4+">4+ Beds</option>
            </select>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="hidden sm:flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            Add Room
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => {
            const roomBeds = beds.filter(b => b.roomId === room.id);
            const occupiedCount = roomBeds.filter(b => b.status === 'occupied').length;
            const occupancyRate = (occupiedCount / room.totalBeds) * 100;

            return (
              <div key={room.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100">
                        <DoorOpen className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 text-lg">Room {room.roomNumber}</h3>
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                            room.type === 'AC' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                          )}>
                            {room.type || 'Non-AC'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{room.totalBeds} Beds Total</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          setEditingRoom(room);
                          setEditFormData({
                            roomNumber: room.roomNumber,
                            totalBeds: room.totalBeds.toString(),
                            type: room.type || 'Non-AC',
                          });
                          setIsEditModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => {
                          setRoomToDelete(room.id);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-gray-500">Occupancy</span>
                      <span className={occupancyRate === 100 ? 'text-red-600' : 'text-indigo-600'}>
                        {occupiedCount}/{room.totalBeds} Beds
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          occupancyRate === 100 ? 'bg-red-500' : 'bg-indigo-500'
                        )}
                        style={{ width: `${occupancyRate}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 flex-1">
                  <div className="grid grid-cols-2 gap-3">
                    {roomBeds.map((bed) => {
                      const member = members.find(m => m.bedId === bed.id && m.status === 'active');
                      return (
                        <div 
                          key={bed.id} 
                          onClick={() => {
                            if (bed.status === 'occupied' && member) {
                              setSelectedMember(member);
                              setIsDetailModalOpen(true);
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-colors",
                            bed.status === 'occupied' 
                              ? "bg-indigo-50 border-indigo-100 text-indigo-700 cursor-pointer hover:bg-indigo-100" 
                              : "bg-green-50 border-green-100 text-green-700"
                          )}
                        >
                          {bed.status === 'occupied' ? (
                            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-green-500" />
                          )}
                          <div className="flex flex-col truncate">
                            <span className="truncate font-bold">Bed {bed.bedNumber.split('-')[1]}</span>
                            {bed.status === 'occupied' && member && (
                              <span className="text-[10px] text-indigo-500 truncate">{member.name}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddHostelModal 
        isOpen={isAddHostelModalOpen}
        onClose={() => setIsAddHostelModalOpen(false)}
        formData={addHostelFormData}
        setFormData={setAddHostelFormData}
        onSubmit={handleAddHostel}
      />

      {/* Add Room Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Add New Room</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Room Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 101"
                  value={formData.roomNumber}
                  onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Total Beds</label>
                  <select
                    required
                    value={formData.totalBeds}
                    onChange={(e) => setFormData({ ...formData, totalBeds: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10].map(n => (
                      <option key={n} value={n}>{n} Beds</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Room Type</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Non-AC">Non-AC</option>
                    <option value="AC">AC</option>
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  Create Room & Beds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Room Modal */}
      {isEditModalOpen && editingRoom && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Edit Room {editingRoom.roomNumber}</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Room Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 101"
                  value={editFormData.roomNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, roomNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Total Beds</label>
                  <select
                    required
                    value={editFormData.totalBeds}
                    onChange={(e) => setEditFormData({ ...editFormData, totalBeds: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10].map(n => (
                      <option key={n} value={n}>{n} Beds</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Room Type</label>
                  <select
                    required
                    value={editFormData.type}
                    onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Non-AC">Non-AC</option>
                    <option value="AC">AC</option>
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  Update Room Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Detail Modal */}
      {isDetailModalOpen && selectedMember && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
              <h3 className="text-lg font-bold">Member Details</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-indigo-500 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 space-y-8 overflow-y-auto max-h-[80vh]">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-4xl shadow-inner">
                  {(selectedMember.name || 'U').charAt(0)}
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">{selectedMember.name}</h2>
                  <p className="text-gray-500 flex items-center gap-2 mt-1">
                    <Phone className="w-4 h-4" /> {selectedMember.phone}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                      {selectedMember.status}
                    </span>
                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                      Room {rooms.find(r => r.id === selectedMember.roomId)?.roomNumber}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Accommodation</h4>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Room Number</span>
                    <span className="font-bold text-gray-900">{rooms.find(r => r.id === selectedMember.roomId)?.roomNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bed Number</span>
                    <span className="font-bold text-gray-900">{beds.find(b => b.id === selectedMember.bedId)?.bedNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Joining Date</span>
                    <span className="font-bold text-gray-900">{format(new Date(selectedMember.joiningDate), 'MMM d, yyyy')}</span>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Financials</h4>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly Rent</span>
                    <span className="font-bold text-indigo-600">₹{selectedMember.rentAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Security Deposit</span>
                    <span className="font-bold text-gray-900">₹{selectedMember.deposit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Billing Day</span>
                    <span className="font-bold text-gray-900">
                      {selectedMember.billingType === 'fixed_first' ? 'Every 1st' : `Every ${parseISO(selectedMember.joiningDate).getDate()}th`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 p-6 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <CreditCard className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-indigo-900">Last Payment Month</p>
                    <p className="text-lg font-bold text-indigo-700">
                      {selectedMember.lastPaidMonth ? format(parseISO(selectedMember.lastPaidMonth + '-01'), 'MMMM yyyy') : 'No payments yet'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => openCollectRent(selectedMember)}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                >
                  Collect Rent
                </button>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  Payment History
                </h4>
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                  {memberPayments.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {memberPayments.map((payment) => (
                        <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                              <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">₹{payment.amount}</p>
                              <p className="text-xs text-gray-500">{format(parseISO(payment.date), 'MMM d, yyyy')} • {payment.method.toUpperCase()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                              {format(parseISO(payment.month + '-01'), 'MMM yyyy')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500 text-sm">
                      No payment records found for this member.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collect Rent Modal */}
      {isCollectRentModalOpen && selectedMember && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
              <h3 className="text-lg font-bold">Collect Rent</h3>
              <button onClick={() => setIsCollectRentModalOpen(false)} className="p-2 hover:bg-indigo-500 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCollectRent} className="p-6 space-y-4">
              <div className="bg-indigo-50 p-4 rounded-xl mb-4">
                <p className="text-sm text-indigo-700 font-medium">Member: <span className="font-bold">{selectedMember.name}</span></p>
                <p className="text-sm text-indigo-700 font-medium">Room: <span className="font-bold">{rooms.find(r => r.id === selectedMember.roomId)?.roomNumber}</span></p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                    <input
                      type="number"
                      required
                      value={rentFormData.amount}
                      onChange={(e) => setRentFormData({ ...rentFormData, amount: e.target.value })}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Month</label>
                  <input
                    type="month"
                    required
                    value={rentFormData.month}
                    onChange={(e) => setRentFormData({ ...rentFormData, month: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={rentFormData.date}
                    onChange={(e) => setRentFormData({ ...rentFormData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Method</label>
                  <select
                    required
                    value={rentFormData.method}
                    onChange={(e) => setRentFormData({ ...rentFormData, method: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Notes (Optional)</label>
                <textarea
                  value={rentFormData.notes}
                  onChange={(e) => setRentFormData({ ...rentFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  rows={2}
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && roomToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 mx-auto">
                <Trash2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delete Room</h3>
                <p className="text-gray-500 mt-1">
                  Are you sure you want to delete Room <span className="font-bold text-gray-900">{rooms.find(r => r.id === roomToDelete)?.roomNumber}</span>? This will also delete all associated beds.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setRoomToDelete(null);
                  }}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteRoom}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export default Rooms;
