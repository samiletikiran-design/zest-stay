import React, { useState } from 'react';
import { Check, Zap, Shield, Star, Clock } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useSubscription } from '../SubscriptionContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { addMonths, addYears, format } from 'date-fns';

const plans = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'Perfect for single property owners',
    features: [
      'Room management',
      'Tenant profiles',
      'Rent tracking',
      'Basic reports',
      'Up to 5 rooms',
      'Single property only',
      'No Staff/Expense adding'
    ]
  },
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 199,
    yearlyPrice: 1999,
    description: 'Perfect for getting started with your first PGs',
    features: [
      'Everything in Free',
      'Up to 2 properties',
      'Up to 20 rooms per PG',
      'Email support only'
    ]
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 299,
    yearlyPrice: 2499,
    description: 'Best value for growing businesses',
    popular: true,
    features: [
      'All Basic Plan features',
      'Expense tracking',
      'Automated rent reminders',
      'Multi-property support',
      'Up to 5 properties',
      'Up to 50 rooms per PG',
      'Priority email support'
    ]
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    monthlyPrice: 399,
    yearlyPrice: 2999,
    description: 'Ultimate access for large operations',
    features: [
      'All Growth Plan features',
      'Staff management',
      'Advanced analytics',
      'Dedicated account manager',
      '24/7 Phone support',
      'WhatsApp and SMS reminders'
    ]
  }
];

const Pricing: React.FC = () => {
  const { organization, refreshUserData } = useAuth();
  const { isSubscribed, daysRemaining, subscriptionType } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const handleSubscribe = (planId: string) => {
    if (!organization || planId === 'free') return;
    
    const planName = plans.find(p => p.id === planId)?.name;
    const message = `Hi, I want to subscribe to the ${planName} (${billingCycle}) plan for my organization: ${organization.name}.`;
    const whatsappUrl = `https://wa.me/918099199817?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="py-12 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-base text-indigo-600 dark:text-indigo-400 font-semibold tracking-wide uppercase">Pricing</h2>
          <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl lg:text-5xl">
            Choose the right plan for your business
          </p>
          <p className="mt-4 max-w-2xl text-xl text-gray-500 dark:text-gray-400 mx-auto">
            Simple, transparent pricing that grows with you.
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 flex justify-center items-center gap-4">
            <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Monthly</span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="relative w-14 h-7 bg-gray-200 dark:bg-gray-700 rounded-full p-1 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <div
                className={`w-5 h-5 bg-white dark:bg-gray-200 rounded-full shadow-sm transform transition-transform duration-200 ${
                  billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              Yearly <span className="text-green-500 dark:text-green-400 font-bold">(Save up to 30%)</span>
            </span>
          </div>
        </div>

        <div className="mt-16 space-y-12 lg:space-y-0 lg:grid lg:grid-cols-4 lg:gap-x-8">
          {plans.map((plan) => {
            const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const fullPlanId = plan.id === 'free' ? 'free' : `${plan.id}_${billingCycle}`;
            const isCurrentPlan = (organization?.subscriptionType === fullPlanId || (plan.id === 'free' && (!organization?.subscriptionType || organization?.subscriptionType === 'free'))) && isSubscribed;

            return (
              <div
                key={plan.id}
                className={`relative p-8 bg-white dark:bg-gray-800 border rounded-2xl shadow-sm flex flex-col ${
                  plan.popular ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-6 transform -translate-y-1/2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-600 text-white">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                  <p className="mt-4 flex items-baseline text-gray-900 dark:text-white">
                    <span className="text-5xl font-extrabold tracking-tight">₹{price}</span>
                    <span className="ml-1 text-xl font-semibold text-gray-500 dark:text-gray-400">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
                  </p>
                  <p className="mt-6 text-gray-500 dark:text-gray-400">{plan.description}</p>

                  <ul className="mt-6 space-y-4">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start">
                        <div className="flex-shrink-0">
                          <Check className="h-6 w-6 text-green-500 dark:text-green-400" />
                        </div>
                        <p className="ml-3 text-base text-gray-700 dark:text-gray-300">{feature}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading !== null || isCurrentPlan}
                  className={`mt-8 w-full py-3 px-6 rounded-xl text-center font-medium transition-all duration-200 ${
                    isCurrentPlan
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default'
                      : plan.popular
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none'
                      : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                  }`}
                >
                  {loading === fullPlanId ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </div>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : (
                    'Subscribe Now'
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
          <div className="lg:grid lg:grid-cols-3 lg:gap-8 items-center">
            <div className="col-span-2">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Need a custom solution?</h3>
              <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">
                Managing more than 10 hostels? Contact our sales team for custom pricing and enterprise features.
              </p>
            </div>
            <div className="mt-8 lg:mt-0">
              <a 
                href="https://wa.me/918099199817?text=I%20need%20a%20custom%20solution"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-gray-900 dark:bg-gray-700 text-white py-4 px-8 rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors text-center"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
