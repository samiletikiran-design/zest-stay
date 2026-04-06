import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';

const InstallPWA: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Check if it's mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileUA = /android|iphone|ipad|ipod|windows phone|iemobile|mobile/i.test(userAgent.toLowerCase());
      const isSmallScreen = window.innerWidth < 1024;
      return isMobileUA || isSmallScreen;
    };
    
    const mobile = checkMobile();
    setIsMobile(mobile);

    const handleResize = () => {
      setIsMobile(checkMobile());
    };
    window.addEventListener('resize', handleResize);

    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      if (!isStandalone && mobile) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Initial check
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isIframe = window.self !== window.top;
    
    if (isStandalone) {
      setIsVisible(false);
    } else if (mobile) {
      // On iOS or in an iframe, we show the banner immediately because beforeinstallprompt won't fire
      if (isIOS || isIframe) {
        const timer = setTimeout(() => setIsVisible(true), 1500);
        return () => clearTimeout(timer);
      }
      // On Android/Chrome, we wait for beforeinstallprompt to ensure "automatic" install works
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile]);

  // Re-show on dashboard if hidden
  useEffect(() => {
    if (location.pathname === '/dashboard' || location.pathname === '/') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
      const isIframe = window.self !== window.top;

      if (!isStandalone && isMobile) {
        // Only show if it's iOS, an iframe, or if the prompt is already ready
        if (isIOS || isIframe || deferredPrompt) {
          setIsVisible(true);
        }
      }
    }
  }, [location.pathname, isMobile, deferredPrompt]);

  const handleInstallClick = async () => {
    const isIframe = window.self !== window.top;
    if (isIframe) {
      toast.info("To install as an app, please open the website in a new browser tab first.", {
        action: {
          label: "Open Now",
          onClick: () => window.open(window.location.href, '_blank')
        },
        duration: 8000
      });
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          setIsVisible(false);
          toast.success("Thank you for installing Zest Stay!");
        }
      } catch (err) {
        console.error("Installation failed:", err);
        toast.error("Installation could not be started. Please try again from your browser menu.");
      }
    } else {
      const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
      if (isIOS) {
        toast.info(
          "To install: Tap the 'Share' button in Safari and select 'Add to Home Screen'.",
          { duration: 8000 }
        );
      } else {
        toast.info(
          "Installation is being prepared. If the prompt doesn't appear, please use your browser's 'Install App' menu option.",
          { duration: 6000 }
        );
      }
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || !isMobile) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 left-4 right-4 z-[100] md:bottom-6 md:left-auto md:right-6 md:w-96"
      >
        <div className="bg-indigo-600 dark:bg-indigo-500 text-white p-4 rounded-2xl shadow-2xl border border-indigo-400/30 backdrop-blur-lg flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm truncate">Install Zest Stay</h4>
            <p className="text-xs text-indigo-100 line-clamp-1">Add to home screen for faster access</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="bg-white text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InstallPWA;
