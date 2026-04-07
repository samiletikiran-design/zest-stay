import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>

        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="bg-indigo-600 px-6 py-8 sm:px-10 text-center">
            <ShieldCheck className="w-12 h-12 text-white mx-auto mb-4" />
            <h1 className="text-3xl font-extrabold text-white">Privacy Policy</h1>
            <p className="mt-2 text-indigo-100">Last updated: April 1, 2026</p>
          </div>

          <div className="px-6 py-8 sm:px-10 prose prose-indigo dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 leading-relaxed">
            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">1. Information We Collect</h2>
              <p className="mb-4">
                Zest Stay collects information to provide better services to all our users. We collect information in the following ways:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Google Account Information:</strong> When you sign in using Google OAuth, we receive your name, email address, and profile picture. This is used solely for authentication and identifying you within the platform.</li>
                <li><strong>Property & Management Data:</strong> Information you provide about your hostels, rooms, and tenants to enable the management features of the app.</li>
                <li><strong>Usage Data:</strong> We collect information about how you interact with our services to improve performance and user experience.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">2. How We Use Information</h2>
              <p className="mb-4">
                We use the information we collect for the following purposes:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>To provide our services:</strong> Managing your PG/Hostel operations, tracking rent, and generating reports.</li>
                <li><strong>Authentication:</strong> To securely log you into your account and protect your data.</li>
                <li><strong>Communication:</strong> To send you critical system updates, rent reminders, and support responses.</li>
                <li><strong>Improvement:</strong> To analyze usage patterns and develop new features that benefit our users.</li>
              </ul>
              <p className="mt-4 font-semibold text-indigo-600 dark:text-indigo-400">
                We do not sell your personal data to third parties.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">3. Information Security</h2>
              <p>
                We work hard to protect Zest Stay and our users from unauthorized access to or unauthorized alteration, disclosure or destruction of information we hold. In particular:
              </p>
              <ul className="list-disc pl-5 mt-4 space-y-2">
                <li>We encrypt many of our services using SSL.</li>
                <li>We review our information collection, storage and processing practices, including physical security measures, to guard against unauthorized access to systems.</li>
                <li>We restrict access to personal information to Zest Stay employees, contractors and agents who need to know that information in order to process it for us.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">4. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at:
                <br />
                <span className="font-medium text-indigo-600 dark:text-indigo-400">contact@zeststay.in</span>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
