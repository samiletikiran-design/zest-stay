import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { toast } from 'sonner';

export const useHostelManagement = () => {
  const { organization, refreshUserData } = useAuth();
  const [isAddHostelModalOpen, setIsAddHostelModalOpen] = useState(false);
  const [addHostelFormData, setAddHostelFormData] = useState({
    name: '',
    address: '',
  });

  const handleAddHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    try {
      const hostelData = {
        organizationId: organization.id,
        name: addHostelFormData.name,
        address: addHostelFormData.address,
        createdAt: new Date().toISOString(),
      };

      try {
        await addDoc(collection(db, 'hostels'), hostelData);
        if (refreshUserData) {
          await refreshUserData();
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'hostels');
      }

      setIsAddHostelModalOpen(false);
      setAddHostelFormData({ name: '', address: '' });
      toast.success('Hostel/PG added successfully!');
    } catch (error) {
      console.error('Error adding hostel:', error);
      toast.error('Failed to add hostel.');
    }
  };

  return {
    isAddHostelModalOpen,
    setIsAddHostelModalOpen,
    addHostelFormData,
    setAddHostelFormData,
    handleAddHostel,
  };
};
