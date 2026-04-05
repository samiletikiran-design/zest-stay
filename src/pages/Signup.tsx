import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  createUserWithEmailAndPassword, 
  RecaptchaVerifier, 
  signInWithPhoneNumber,
  ConfirmationResult,
  updateProfile,
  EmailAuthProvider,
  linkWithCredential,
  signInWithCustomToken,
  updatePassword
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Bed, Lock, Mail, User, Building, AlertCircle, Phone, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const Signup = () => {
  const { user, loading: authLoading, refreshUserData, isNewUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orgName, setOrgName] = useState('');
  const [hostelName, setHostelName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  
  // OTP States
  const [step, setStep] = useState<'info' | 'verify'>('info');
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'phone'>('email');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (!authLoading && user && !loading && !signupSuccess && !isNewUser) {
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, loading, signupSuccess, isNewUser, from]);

  useEffect(() => {
    if (signupSuccess && !isNewUser) {
      sessionStorage.removeItem('signup_in_progress');
      navigate(from, { replace: true });
    }
  }, [signupSuccess, isNewUser, navigate, from]);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          console.log('Recaptcha resolved');
        }
      });
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanPhone = phone.trim().replace(/[\s-]/g, '').replace(/^\+91/, '');
      if (verificationMethod === 'phone') {
        setupRecaptcha();
        const appVerifier = (window as any).recaptchaVerifier;
        const formattedPhone = `+91${cleanPhone}`;
        const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
        setConfirmationResult(result);
        toast.success('OTP sent to your phone!');
      } else {
        const response = await fetch('/api/send-email-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to send email OTP');
        
        toast.success('OTP sent to your email!');
      }
      setStep('verify');
      setResendTimer(60);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let currentUser = auth.currentUser;
      
      // 1. Verify OTP
      if (verificationMethod === 'phone') {
        if (!confirmationResult) throw new Error('No confirmation result found');
        try {
          await confirmationResult.confirm(otp);
          currentUser = auth.currentUser; // Update local user after sign-in
        } catch (otpErr: any) {
          console.error('OTP Verification failed:', otpErr);
          if (otpErr.code === 'auth/invalid-credential' || otpErr.message?.includes('auth/invalid-credential')) {
            throw new Error('Invalid verification code or session expired. Please try again.');
          } else if (otpErr.code === 'auth/code-expired') {
            setError('The verification code has expired. Please click "Resend code" to get a new one.');
            return;
          }
          throw otpErr;
        }
      } else {
        const response = await fetch('/api/verify-email-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Invalid OTP');
        
        if (data.token) {
          await signInWithCustomToken(auth, data.token);
          currentUser = auth.currentUser; // Update local user after sign-in
        } else {
          throw new Error('Verification successful but no token received.');
        }
      }

      // 2. Create Firebase Auth User (if not already created by phone auth)
      if (!currentUser) throw new Error('Failed to identify user after verification');
      
      if (verificationMethod === 'email') {
        // Link email/password so they can use both.
        const credential = EmailAuthProvider.credential(email, password);
        try {
          await linkWithCredential(currentUser, credential);
        } catch (linkErr: any) {
          console.error('Linking failed:', linkErr);
          // If it fails because it's already linked or something, we can ignore if they are signed in
        }
      } else {
        // For phone auth, user is already signed in. Link email/password so they can use both.
        const credential = EmailAuthProvider.credential(email, password);
        try {
          await linkWithCredential(currentUser, credential);
        } catch (linkErr: any) {
          console.error('Linking failed:', linkErr);
          if (linkErr.code === 'auth/email-already-in-use') {
            throw new Error('This email is already associated with another account. Please use a different email or sign in.');
          } else if (linkErr.code === 'auth/credential-already-in-use') {
            // This phone is already linked to another email? Or this email is already linked?
          } else if (linkErr.code === 'auth/invalid-credential' || linkErr.message?.includes('auth/invalid-credential')) {
            throw new Error('Invalid email or password format. Please check your details and try again.');
          } else {
            throw new Error(`Failed to link email: ${linkErr.message}`);
          }
        }
      }

      if (!currentUser) throw new Error('Failed to identify user for Firestore records');
      await updateProfile(currentUser, { displayName: name });

      const orgId = `org_${Math.random().toString(36).substr(2, 9)}`;
      const hostelId = `hostel_${Math.random().toString(36).substr(2, 9)}`;

      // 3. Create Firestore records using a batch for atomicity
      const cleanPhone = phone.trim().replace(/[\s-]/g, '').replace(/^\+91/, '');
      const batch = writeBatch(db);

      const userRef = doc(db, 'users', currentUser.uid);
      batch.set(userRef, {
        email: email || currentUser.email || '',
        name,
        phone: `+91${cleanPhone}`,
        organizationId: orgId,
        currentHostelId: hostelId,
        role: 'admin',
        createdAt: serverTimestamp(),
      });

      const orgRef = doc(db, 'organizations', orgId);
      batch.set(orgRef, {
        name: orgName,
        ownerUid: currentUser.uid,
        ownerEmail: email || currentUser.email || '',
        ownerPhone: `+91${cleanPhone}`,
        createdAt: serverTimestamp(),
        subscriptionStatus: 'active',
        subscriptionType: 'free',
        subscriptionStartDate: serverTimestamp(),
      });

      const hostelRef = doc(db, 'hostels', hostelId);
      batch.set(hostelRef, {
        organizationId: orgId,
        name: hostelName,
        createdAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch-signup');
        throw new Error('Failed to create account records. Please try again.');
      }

      toast.success('Account created successfully!');
      await refreshUserData();
      setSignupSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div id="recaptcha-container"></div>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200 dark:shadow-none">
            <Bed className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          {step === 'info' ? 'Create your account' : 'Verify your identity'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          {step === 'info' ? (
            <>
              Already have an account?{' '}
              <Link to="/signin" className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
                Sign in
              </Link>
            </>
          ) : (
            `We've sent a 6-digit code to your ${verificationMethod}`
          )}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-6 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100 dark:border-gray-700">
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          )}

          {step === 'info' ? (
            <form className="space-y-4" onSubmit={handleSendOTP}>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Your Name
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Mobile Number
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm font-medium">+91</span>
                    </div>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      required
                      pattern="[0-9]{10}"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setPhone(val);
                      }}
                      className="block w-full pl-12 pr-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="10-digit mobile"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email address
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Organization / Group Name
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="orgName"
                    name="orgName"
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="e.g. Zest Stay Group"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="hostelName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  First Hostel / Building Name
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Bed className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="hostelName"
                    name="hostelName"
                    type="text"
                    required
                    value={hostelName}
                    onChange={(e) => setHostelName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="e.g. Building A"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Verify via:</p>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setVerificationMethod('email')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                      verificationMethod === 'email'
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerificationMethod('phone')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                      verificationMethod === 'phone'
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Phone className="w-4 h-4" />
                    Phone
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? 'Sending OTP...' : 'Continue to Verification'}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleVerifyAndSignup}>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full mb-4">
                  <CheckCircle2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Please enter the 6-digit code sent to <br />
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {verificationMethod === 'email' ? email : `+91 ${phone}`}
                  </span>
                </p>
              </div>

              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                  Verification Code
                </label>
                <div className="mt-2">
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="block w-full text-center tracking-[1em] text-2xl font-bold py-3 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="000000"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? 'Verifying...' : 'Verify & Create Account'}
                </button>
                
                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={loading || resendTimer > 0}
                  className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 disabled:text-gray-400"
                >
                  {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('info')}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Change details
                </button>
              </div>
            </form>
          )}
        </div>
        <div className="mt-6 flex justify-center gap-6 text-xs text-gray-400 dark:text-gray-500">
          <Link to="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Terms & Conditions</Link>
          <Link to="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Privacy Policy</Link>
          <Link to="/contact" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Contact Support</Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
