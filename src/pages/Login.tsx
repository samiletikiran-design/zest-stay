import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  RecaptchaVerifier, 
  signInWithPhoneNumber,
  ConfirmationResult,
  signInWithCustomToken
} from 'firebase/auth';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Bed, Lock, Mail, AlertCircle, Phone, CheckCircle2, Key, User } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const { user, loading: authLoading } = useAuth();
  const [identifier, setIdentifier] = useState(''); // Email or Phone
  const [password, setPassword] = useState('');
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // OTP States
  const [step, setStep] = useState<'identifier' | 'verify'>('identifier');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (!authLoading && user) {
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, from]);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const isEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  const isPhone = (val: string) => {
    const cleaned = val.trim().replace(/[\s-]/g, '').replace(/^\+91/, '');
    return /^\d{10}$/.test(cleaned);
  };

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanIdentifier = identifier.trim();
      if (loginMethod === 'password') {
        if (!isPhone(cleanIdentifier)) {
          throw new Error('Please enter a valid 10-digit phone number.');
        }
        const cleanedPhone = cleanIdentifier.replace(/[\s-]/g, '').replace(/^\+91/, '');
        const emailToUse = `${cleanedPhone}@zeststay.app`;
        await signInWithEmailAndPassword(auth, emailToUse, password);
        navigate(from, { replace: true });
      } else {
        // OTP Flow
        if (isPhone(cleanIdentifier)) {
          setupRecaptcha();
          const appVerifier = (window as any).recaptchaVerifier;
          const formattedPhone = `+91${cleanIdentifier.replace(/[\s-]/g, '').replace(/^\+91/, '')}`;
          const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
          setConfirmationResult(result);
          setStep('verify');
          setResendTimer(60);
          toast.success('OTP sent to your phone!');
        } else {
          throw new Error('Please enter a valid 10-digit phone number.');
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      let errorMessage = 'Failed to sign in. Please try again.';
      
      const code = err.code || '';
      const msg = err.message || '';

      if (code === 'auth/invalid-credential' || msg.includes('auth/invalid-credential')) {
        errorMessage = 'Invalid phone number or password. Please check your credentials and try again.';
      } else if (code === 'auth/user-not-found' || msg.includes('user-not-found')) {
        errorMessage = 'No account found with this phone number. Please sign up first.';
      } else if (code === 'auth/wrong-password' || msg.includes('wrong-password')) {
        errorMessage = 'Incorrect password. Please try again or use OTP login.';
      } else if (code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later or reset your password.';
      } else if (code === 'auth/invalid-phone-number') {
        errorMessage = 'The phone number provided is invalid. Please enter a 10-digit number.';
      } else if (code === 'auth/quota-exceeded') {
        errorMessage = 'SMS quota exceeded. Please try again later or use password login.';
      } else if (code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (code === 'auth/captcha-check-failed') {
        errorMessage = 'reCAPTCHA verification failed. Please try again.';
      } else if (msg) {
        errorMessage = msg;
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!confirmationResult) throw new Error('No confirmation result found. Please resend OTP.');
      await confirmationResult.confirm(otp);
      toast.success('Signed in successfully!');
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error('OTP Verification error:', err);
      let errorMessage = 'Verification failed. Please try again.';
      
      const code = err.code || '';
      const msg = err.message || '';

      if (code === 'auth/invalid-credential' || msg.includes('auth/invalid-credential')) {
        errorMessage = 'Invalid verification code or session expired. Please try again.';
      } else if (code === 'auth/code-expired') {
        errorMessage = 'The verification code has expired. Please click "Resend code" to get a new one.';
      } else if (code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid verification code. Please check and try again.';
      } else if (code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (msg) {
        errorMessage = msg;
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
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
      <div id="recaptcha-container" className="fixed bottom-0 right-0 z-[-1] pointer-events-none opacity-0"></div>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img 
            src="https://firebasestorage.googleapis.com/v0/b/zest-stay.firebasestorage.app/o/Zest%20Stay%20Logo.png?alt=media&token=a9d14fd2-5361-4864-9752-16f667f99f19" 
            alt="Zest Stay Logo" 
            className="w-14 h-14 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          {step === 'identifier' ? 'Sign in to your account' : 'Verify OTP'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Or{' '}
          <Link to="/signup" className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-6 shadow-xl rounded-3xl sm:px-10 border border-gray-100 dark:border-gray-700">
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          )}

          {step === 'identifier' ? (
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Phone Number
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="10 digit phone number"
                  />
                </div>
              </div>

              {loginMethod === 'password' && (
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
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setLoginMethod('password')}
                    className={`text-sm font-medium px-3 py-1 rounded-full transition-all ${
                      loginMethod === 'password' 
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod('otp')}
                    className={`text-sm font-medium px-3 py-1 rounded-full transition-all ${
                      loginMethod === 'otp' 
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    OTP
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? 'Processing...' : loginMethod === 'password' ? 'Sign in' : 'Send OTP'}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleVerifyOTP}>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full mb-4">
                  <Key className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Please enter the 6-digit code sent to <br />
                  <span className="font-semibold text-gray-900 dark:text-white">{identifier}</span>
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
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
                
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={loading || resendTimer > 0}
                  className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 disabled:text-gray-400"
                >
                  {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('identifier')}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Change email/phone
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

export default Login;
