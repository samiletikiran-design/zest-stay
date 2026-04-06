import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { differenceInDays, parseISO, addDays, isAfter } from 'date-fns';

interface SubscriptionContextType {
  isSubscribed: boolean;
  isExpired: boolean;
  isTrial: boolean;
  daysRemaining: number;
  subscriptionType: string;
  canAccessExpenses: boolean;
  canAddExpenses: boolean;
  canAccessReminders: boolean;
  canAccessMultiProperty: boolean;
  canAccessStaffManagement: boolean;
  canAddStaff: boolean;
  maxRooms: number;
  maxProperties: number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { organization } = useAuth();

  const subscriptionInfo = useMemo(() => {
    if (!organization) {
      return {
        isSubscribed: false,
        isExpired: false,
        isTrial: false,
        daysRemaining: 0,
        subscriptionType: 'none',
        canAccessExpenses: false,
        canAddExpenses: false,
        canAccessReminders: false,
        canAccessMultiProperty: false,
        canAccessStaffManagement: false,
        canAddStaff: false,
        maxRooms: 0,
        maxProperties: 0
      };
    }

    const now = new Date();
    
    // Safety check for createdAt
    const getSafeDate = (dateVal: any) => {
      if (!dateVal) return new Date();
      if (typeof dateVal.toDate === 'function') return dateVal.toDate();
      try {
        const parsed = parseISO(dateVal);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
      } catch (e) {
        return new Date();
      }
    };

    const isActive = organization.subscriptionStatus === 'active';
    
    let isSubscribed = false;
    let isExpired = false;
    let daysRemaining = 0;

    if (isActive) {
      isSubscribed = true;
      if (organization.subscriptionEndDate) {
        const endDate = getSafeDate(organization.subscriptionEndDate);
        isExpired = isAfter(now, endDate);
        isSubscribed = !isExpired;
        daysRemaining = Math.max(0, differenceInDays(endDate, now));
      } else if (organization.subscriptionType === 'lifetime' || organization.subscriptionType === 'free') {
        isSubscribed = true;
        daysRemaining = 9999;
      }
    } else {
      isExpired = true;
    }

    const plan = (organization.subscriptionType || 'free').toLowerCase();
    const isUnlimited = plan.includes('unlimited') || plan === 'lifetime';
    const isGrowth = plan.includes('growth') || isUnlimited;
    const isBasic = plan.includes('basic') || isGrowth;
    const isFree = plan === 'free' || !isBasic;

    return {
      isSubscribed,
      isExpired,
      isTrial: false, // Trial removed as per request
      daysRemaining,
      subscriptionType: plan,
      canAccessExpenses: true, // Everyone can view
      canAddExpenses: isGrowth,
      canAccessReminders: isGrowth,
      canAccessMultiProperty: isBasic, // Basic now has 2 properties
      canAccessStaffManagement: true, // Everyone can view
      canAddStaff: isUnlimited,
      maxRooms: isUnlimited ? 100 : (isGrowth ? 50 : (isBasic ? 20 : 5)),
      maxProperties: isUnlimited ? 10 : (isGrowth ? 5 : (isBasic ? 2 : 1))
    };
  }, [organization]);

  return (
    <SubscriptionContext.Provider value={subscriptionInfo}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
