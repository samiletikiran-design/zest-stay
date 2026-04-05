import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Bed, 
  Shield, 
  Zap, 
  Users, 
  CreditCard, 
  BarChart3, 
  Smartphone, 
  CheckCircle2, 
  ArrowRight,
  Building2,
  Receipt,
  MessageSquare,
  Clock
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { motion } from 'motion/react';

const Landing = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'yearly'>('monthly');

  const features = [
    {
      icon: <Building2 className="w-6 h-6" />,
      title: "Room Management",
      description: "Easily manage room allocations, bed availability, and room types across multiple properties."
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Tenant Profiles",
      description: "Maintain detailed records of all residents, including ID proofs, contact info, and joining history."
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "Rent Tracking",
      description: "Automated dues calculation, partial payment support, and digital receipt generation."
    },
    {
      icon: <Receipt className="w-6 h-6" />,
      title: "Expense Tracking",
      description: "Keep track of utilities, maintenance, and other operational costs to monitor profitability."
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: "Automated Reminders",
      description: "Send professional rent reminders via WhatsApp and SMS to ensure timely payments."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Basic Reports",
      description: "Get insights into your occupancy rates, monthly income, and pending dues at a glance."
    }
  ];

  const plans = [
    {
      name: "Basic Plan",
      price: "199",
      period: "/ month",
      annual: "1999",
      description: "Perfect for getting started with your first PG",
      features: [
        "Room management",
        "Tenant profiles",
        "Rent tracking",
        "Basic reports",
        "Mobile access",
        "Up to 20 rooms per PG",
        "Email support only"
      ],
      buttonText: "Start with Basic",
      popular: false
    },
    {
      name: "Growth Plan",
      price: "299",
      period: "/ month",
      annual: "2499",
      description: "Best value for growing businesses",
      features: [
        "All Basic Plan features",
        "Expense tracking (utilities, etc.)",
        "Automated rent reminders",
        "Multi-property support",
        "Up to 5 properties",
        "Up to 50 rooms per PG",
        "Priority email support"
      ],
      buttonText: "Go for Growth",
      popular: true
    },
    {
      name: "Unlimited Access",
      price: "399",
      period: "/ month",
      annual: "2999",
      description: "Ultimate access for large operations",
      features: [
        "All Growth Plan features",
        "Advanced analytics",
        "Dedicated account manager",
        "24/7 Phone support",
        "WhatsApp and SMS reminders"
      ],
      buttonText: "Go Unlimited",
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-50 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                <Bed className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                Zest Stay
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Features</a>
              <a href="#pricing" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Pricing</a>
              {user ? (
                <Link 
                  to="/" 
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  Dashboard
                </Link>
              ) : (
                <div className="flex items-center gap-4">
                  <Link to="/signin" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Login</Link>
                  <Link 
                    to="/signup" 
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-bold mb-6">
              <Zap className="w-4 h-4" />
              The #1 PG Management Software
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6">
              Manage your PG with <br />
              <span className="text-indigo-600 dark:text-indigo-400">Zero Stress</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10">
              Automate rent collection, track expenses, and manage tenants effortlessly. 
              Built for modern PG owners who value their time.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                to="/signup" 
                className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl text-lg font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a 
                href="#features" 
                className="w-full sm:w-auto bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 px-8 py-4 rounded-2xl text-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
              >
                See Features
              </a>
            </div>
          </motion.div>

          {/* App Preview Mockup */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-20 relative max-w-5xl mx-auto"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-[2.5rem] blur opacity-20"></div>
            <div className="relative bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[2rem] shadow-2xl overflow-hidden">
              <img 
                src="https://picsum.photos/seed/dashboard/1200/800" 
                alt="App Dashboard" 
                className="w-full h-auto"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">Everything you need to scale</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">Powerful features designed to simplify your daily operations.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                whileHover={{ y: -5 }}
                className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all"
              >
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">Choose the plan that fits your property size.</p>

            {/* Billing Toggle */}
            <div className="mt-8 flex justify-center items-center gap-6">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`text-sm font-bold transition-colors ${billingCycle === 'monthly' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                className="relative w-16 h-8 bg-gray-100 dark:bg-gray-800 rounded-full p-1 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 border border-gray-200 dark:border-gray-700"
              >
                <div
                  className={`w-6 h-6 bg-indigo-600 rounded-full shadow-lg transform transition-transform duration-300 ease-in-out ${
                    billingCycle === 'yearly' ? 'translate-x-8' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="flex flex-col items-start">
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`text-sm font-bold transition-colors ${billingCycle === 'yearly' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                  Yearly
                </button>
                <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                  Save up to 37%
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {plans.map((plan, index) => {
              const price = billingCycle === 'monthly' ? plan.price : plan.annual;
              const period = billingCycle === 'monthly' ? '/ month' : '/ year';

              return (
                <div 
                  key={index}
                  className={`relative p-10 rounded-[2.5rem] border-2 flex flex-col ${
                    plan.popular 
                      ? 'border-indigo-600 bg-white dark:bg-gray-800 shadow-2xl shadow-indigo-100 dark:shadow-none' 
                      : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-10 transform -translate-y-1/2">
                      <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-bold bg-indigo-600 text-white">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <div className="mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                    <p className="text-gray-500 dark:text-gray-400">{plan.description}</p>
                  </div>
                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-extrabold text-gray-900 dark:text-white">₹{price}</span>
                      <span className="text-gray-500 dark:text-gray-400 font-medium">{period}</span>
                    </div>
                    {billingCycle === 'yearly' && (
                      <div className="mt-2">
                        <span className="text-sm font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-full">
                          Save ₹{Number(plan.price) * 12 - Number(plan.annual)} / year
                        </span>
                      </div>
                    )}
                  </div>
                  <ul className="space-y-4 mb-10 flex-1">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link 
                    to="/signup"
                    className={`w-full py-4 rounded-2xl text-center font-bold transition-all ${
                      plan.popular
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none'
                        : 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-50 dark:hover:bg-indigo-900/50'
                    }`}
                  >
                    {plan.buttonText}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-indigo-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">Ready to transform your PG management?</h2>
          <p className="text-xl text-indigo-100 mb-10 max-w-2xl mx-auto">
            Join hundreds of PG owners who have simplified their lives with Zest Stay. 
            Start your 14-day free trial today.
          </p>
          <Link 
            to="/signup" 
            className="inline-flex items-center gap-2 bg-white text-indigo-600 px-10 py-5 rounded-2xl text-xl font-bold hover:bg-indigo-50 transition-all shadow-2xl dark:shadow-none"
          >
            Get Started for Free
            <ArrowRight className="w-6 h-6" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <Bed className="w-6 h-6 text-indigo-600" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">Zest Stay</span>
            </div>
            <div className="flex gap-8 text-sm text-gray-500 dark:text-gray-400">
              <Link to="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400">Terms of Service</Link>
              <Link to="/contact" className="hover:text-indigo-600 dark:hover:text-indigo-400">Contact Us</Link>
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">© 2026 Zest Stay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
