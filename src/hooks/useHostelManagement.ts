import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { useSubscription } from '../SubscriptionContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { toast } from 'sonner';

export const useHostelManagement = () => {
  const { organization, refreshUserData } = useAuth();
  const { maxProperties } = useSubscription();
  const [isAddHostelModalOpen, setIsAddHostelModalOpen] = useState(false);
  const [addHostelFormData, setAddHostelFormData] = useState({
    name: '',
    address: '',
  });

  const handleAddHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    try {
      // Check property limit
      const hostelsSnap = await getDocs(query(collection(db, 'hostels'), where('organizationId', '==', organization.id)));
      if (hostelsSnap.size >= maxProperties) {
        toast.error(`You have reached the limit of ${maxProperties} properties for your current plan. Please upgrade to add more.`);
        return;
      }

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
