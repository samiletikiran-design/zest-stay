import React, { useState, useEffect } from 'react';
import { 
  User, 
  Building, 
  Lock, 
  Shield, 
  Save, 
  AlertCircle, 
  CheckCircle2,
  ChevronRight,
  LogOut,
  Mail,
  Phone,
  CreditCard,
  Link as LinkIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  updateProfile, 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider 
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { useSubscription } from '../SubscriptionContext';
import { toast } from 'sonner';
import { safeFormat } from '../lib/utils';

const Settings = () => {
  const { user, userData, organization, refreshUserData, logout } = useAuth();
  const { isExpired, maxRooms, maxProperties, canAddExpenses, canAddStaff, subscriptionType } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Profile States
  const [name, setName] = useState(userData?.name || '');
  const [orgName, setOrgName] = useState(organization?.name || '');
  
  // Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    if (userData) setName(userData.name);
    if (organization) setOrgName(organization.name);
  }, [userData, organization]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setError('');
    setLoading(true);
    try {
      const nameToUpdate = orgName;
      // Update Auth Profile
      await updateProfile(user, { displayName: nameToUpdate });
      
      // Update Firestore User
      const userRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userRef, { name: nameToUpdate });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
        throw err;
      }
      
      // Update Organization if admin
      if (userData?.role === 'admin' && userData.organizationId) {
        const orgRef = doc(db, 'organizations', userData.organizationId);
        try {
          await updateDoc(orgRef, { name: orgName });
        } catch (err: any) {
          handleFirestoreError(err, OperationType.UPDATE, `organizations/${userData.organizationId}`);
          throw err;
        }
      }
      
      await refreshUserData();
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    setError('');
    setLoading(true);
    try {
      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      
      toast.success('Password changed successfully!');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to change password. Check your current password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your profile and security preferences</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 flex items-start gap-3 rounded-r-lg">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-8">
        {/* Profile Section */}
        <section className="bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Personal Information</h2>
          </div>
          <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {userData?.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hostel / PG Name</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="Hostel / PG Name"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm">{userData?.phone}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100 dark:shadow-none"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </section>

        {/* Subscription Section */}
        <section className="bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Subscription Plan</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    {(organization?.subscriptionType || 'Free').replace('_', ' ')} Plan
                  </h3>
                  {isExpired ? (
                    <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Expired</span>
                  ) : (
                    <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Active</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isExpired 
                    ? 'Your subscription has expired. Please renew to continue using all features.' 
                    : `Your plan is active until ${organization?.subscriptionEndDate ? safeFormat(organization.subscriptionEndDate, 'MMMM d, yyyy') : 'N/A'}.`}
                </p>
              </div>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
              >
                <CreditCard className="w-4 h-4" />
                {isExpired ? 'Renew Now' : 'Upgrade Plan'}
              </Link>
            </div>
            
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase mb-1">Room Limit</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{subscriptionType.includes('unlimited') ? 'Unlimited' : maxRooms} Rooms</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase mb-1">Property Limit</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{subscriptionType.includes('unlimited') ? 'Unlimited' : maxProperties} Properties</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase mb-1">Expenses</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{canAddExpenses ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase mb-1">Staff Mgmt</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{canAddStaff ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase mb-1">Support</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {subscriptionType.includes('unlimited') ? '24/7 Phone' : (subscriptionType.includes('growth') ? 'Priority Email' : 'Email Only')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Security</h2>
          </div>
          <div className="p-6">
            {!showPasswordForm ? (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Password</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Change your account password</p>
                </div>
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                  Update Password
                </button>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100 dark:shadow-none"
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(false)}
                    className="px-6 py-2 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20 flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h2 className="font-semibold text-red-900 dark:text-red-400">Danger Zone</h2>
          </div>
          <div className="p-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-red-900 dark:text-red-400">Sign Out</h3>
              <p className="text-sm text-red-600/70 dark:text-red-400/70 mt-1">Sign out of your account on this device</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-100 dark:shadow-none"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
