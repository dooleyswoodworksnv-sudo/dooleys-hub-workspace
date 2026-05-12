import React, { useState } from 'react';
import { Lock, CheckCircle, X } from 'lucide-react';

interface PaywallOverlayProps {
  onClose: () => void;
  featureName: string;
}

export const PaywallOverlay: React.FC<PaywallOverlayProps> = ({ onClose, featureName }) => {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    // If user hasn't setup Stripe keys yet, provide a simulation bypass for development
    if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY.includes('pk_test_...')) {
        alert("Stripe is not configured yet! In production, this would redirect to Stripe Checkout.\n\nSimulating successful subscription upgrade...");
        onClose(); // bypass for now
        return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }), // We'd pass the actual user token here too
      });
      
      const session = await response.json();
      if (session && session.url) {
          window.location.href = session.url;
      }
    } catch (err) {
      console.error('Error redirecting to checkout:', err);
      alert('Failed to initiate checkout. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-80 backdrop-blur-sm p-4">
      <div className="relative bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full border border-gray-700 overflow-hidden">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
            <X size={24} />
        </button>

        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-center">
            <Lock className="w-12 h-12 text-white mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-2">Unlock {featureName}</h2>
            <p className="text-blue-100">Upgrade to Pro to access advanced features like PDF generation, saving projects, and cloud assets.</p>
        </div>

        <div className="p-8">
            <div className="space-y-4 mb-8">
                {[
                    'High-resolution PDF Blueprint Generation in Backend',
                    'Cloud Project Saving & Syncing',
                    'Access to Premium 3D Models & Materials',
                    'Full Material and Cost Estimation Export'
                ].map((perk, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <CheckCircle className="text-green-400 w-5 h-5 flex-shrink-0" />
                        <span className="text-gray-300">{perk}</span>
                    </div>
                ))}
            </div>

            <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-4 rounded-xl transition-colors flex justify-center items-center gap-2"
            >
                {loading ? 'Initializing Secure Checkout...' : 'Upgrade to Pro'}
            </button>
            <p className="text-center text-gray-500 text-xs mt-4">Secure payment processed by Stripe.</p>
        </div>
      </div>
    </div>
  );
};
