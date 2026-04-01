import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, Organization, Hostel } from './types';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';

interface AuthContextType {
  user: FirebaseUser | null;
  userData: User | null;
  organization: Organization | null;
  hostels: Hostel[];
  currentHostel: Hostel | null;
  loading: boolean;
  isNewUser: boolean;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  setCurrentHostel: (hostelId: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [currentHostel, setCurrentHostelState] = useState<Hostel | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const fetchUserData = async (uid: string) => {
    try {
      const userPath = `users/${uid}`;
      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', uid));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, userPath);
      }

      if (userDoc && userDoc.exists()) {
        const data = userDoc.data() as User;
        setUserData({ ...data, id: userDoc.id });
        setIsNewUser(false);

        const orgPath = `organizations/${data.organizationId}`;
        let orgDoc;
        try {
          orgDoc = await getDoc(doc(db, 'organizations', data.organizationId));
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, orgPath);
        }

        let orgData: Organization | null = null;
        if (orgDoc && orgDoc.exists()) {
          orgData = { ...(orgDoc.data() as Organization), id: orgDoc.id };
          setOrganization(orgData);
        }

        // Fetch hostels
        const hostelsPath = 'hostels';
        let hostelsSnapshot;
        try {
          const hostelsQuery = query(collection(db, 'hostels'), where('organizationId', '==', data.organizationId));
          hostelsSnapshot = await getDocs(hostelsQuery);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, hostelsPath);
        }

        let hostelsList = hostelsSnapshot ? hostelsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Hostel)) : [];
        
        // If no hostels exist (legacy users), create a default one
        if (hostelsList.length === 0) {
          const hostelId = `hostel_${Math.random().toString(36).substr(2, 9)}`;
          const defaultHostel = {
            organizationId: data.organizationId,
            name: orgData?.name || 'Main Hostel',
            createdAt: new Date().toISOString()
          };
          try {
            await setDoc(doc(db, 'hostels', hostelId), defaultHostel);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `hostels/${hostelId}`);
          }
          hostelsList = [{ ...defaultHostel, id: hostelId }];
          
          // Update user's currentHostelId
          try {
            await updateDoc(doc(db, 'users', uid), {
              currentHostelId: hostelId
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, userPath);
          }
          data.currentHostelId = hostelId;
        }

        setHostels(hostelsList);

        // Set current hostel
        if (data.currentHostelId) {
          const current = hostelsList.find(h => h.id === data.currentHostelId);
          if (current) {
            setCurrentHostelState(current);
          } else if (hostelsList.length > 0) {
            setCurrentHostelState(hostelsList[0]);
          }
        } else if (hostelsList.length > 0) {
          setCurrentHostelState(hostelsList[0]);
        }
      } else {
        setIsNewUser(true);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const setCurrentHostel = async (hostelId: string) => {
    if (!user || !userData) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        currentHostelId: hostelId
      });
      const selected = hostels.find(h => h.id === hostelId);
      if (selected) {
        setCurrentHostelState(selected);
        setUserData({ ...userData, currentHostelId: hostelId });
      }
    } catch (error) {
      console.error('Error setting current hostel:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserData(firebaseUser.uid);
      } else {
        setUserData(null);
        setOrganization(null);
        setIsNewUser(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user.uid);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userData, 
      organization, 
      hostels,
      currentHostel,
      loading, 
      isNewUser, 
      theme, 
      setTheme, 
      setCurrentHostel,
      refreshUserData 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
