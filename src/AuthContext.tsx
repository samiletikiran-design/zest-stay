import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { User, Organization, Hostel } from './types';

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
  logout: () => Promise<void>;
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
    console.log('AuthContext: setTheme called with:', newTheme);
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    console.log('AuthContext: Applying theme:', theme);
    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
      console.log('AuthContext: Added .dark class to html and body');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      console.log('AuthContext: Removed .dark class from html and body');
    }
  }, [theme]);

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
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserData(null);
        setOrganization(null);
        setHostels([]);
        setCurrentHostelState(null);
        setIsNewUser(false);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as User;
        setUserData({ ...data, id: docSnap.id });
        setIsNewUser(false);

        // Fetch organization
        let orgData: Organization | null = null;
        if (data.organizationId) {
          const orgPath = `organizations/${data.organizationId}`;
          try {
            const orgDoc = await getDoc(doc(db, 'organizations', data.organizationId));
            if (orgDoc.exists()) {
              orgData = { ...(orgDoc.data() as Organization), id: orgDoc.id };
              setOrganization(orgData);
            } else {
              console.warn(`Organization ${data.organizationId} not found. Retrying in 2s...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              const retryOrgDoc = await getDoc(doc(db, 'organizations', data.organizationId));
              if (retryOrgDoc.exists()) {
                orgData = { ...(retryOrgDoc.data() as Organization), id: retryOrgDoc.id };
                setOrganization(orgData);
              }
            }
          } catch (error) {
            console.error('Error fetching organization:', error);
          }
        }

        // Fetch hostels
        try {
          const hostelsQuery = query(collection(db, 'hostels'), where('organizationId', '==', data.organizationId));
          const hostelsSnapshot = await getDocs(hostelsQuery);
          let hostelsList = hostelsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Hostel));
          
          // If no hostels exist (legacy users or race condition), create a default one
          if (hostelsList.length === 0 && data.organizationId) {
            const hostelId = `hostel_${Math.random().toString(36).substr(2, 9)}`;
            const defaultHostel = {
              organizationId: data.organizationId,
              name: orgData?.name || 'Main Hostel',
              createdAt: new Date().toISOString()
            };
            try {
              await setDoc(doc(db, 'hostels', hostelId), defaultHostel);
              hostelsList = [{ ...defaultHostel, id: hostelId }];
              
              // Update user's currentHostelId if missing
              if (!data.currentHostelId) {
                await updateDoc(doc(db, 'users', user.uid), {
                  currentHostelId: hostelId
                });
                data.currentHostelId = hostelId;
              }
            } catch (error) {
              console.error('Error creating default hostel:', error);
            }
          }

          setHostels(hostelsList);

          if (data.currentHostelId) {
            const current = hostelsList.find(h => h.id === data.currentHostelId);
            if (current) setCurrentHostelState(current);
            else if (hostelsList.length > 0) setCurrentHostelState(hostelsList[0]);
          } else if (hostelsList.length > 0) {
            setCurrentHostelState(hostelsList[0]);
          }
        } catch (error) {
          console.error('Error fetching hostels:', error);
        }
      } else {
        setIsNewUser(true);
      }
      setLoading(false);
    }, (error) => {
      console.error('User snapshot error:', error);
      setLoading(false);
    });

    return () => unsubUser();
  }, [user]);

  const refreshUserData = async () => {
    if (user) {
      setLoading(true);
      // Re-fetch logic is handled by onSnapshot, but we can force a reload of the component state if needed
      // Actually, just waiting a bit and letting onSnapshot do its thing is usually enough
      await new Promise(resolve => setTimeout(resolve, 500));
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setUserData(null);
      setOrganization(null);
      setHostels([]);
      setCurrentHostelState(null);
    } catch (error) {
      console.error('Logout failed:', error);
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
      refreshUserData,
      logout
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
