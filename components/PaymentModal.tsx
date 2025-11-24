import React, { useState } from 'react';
import { X, Check, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { createPayment, renderPaymentWidget } from '../services/paymentService';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Single product configuration
const PRODUCT = {
  name: 'Generate Photos',
  price: 500,
  description: 'Unlock professional AI photo generation for your persona.',
  features: [
    'High Quality Generation (4K)',
    'All Styles Unlocked',
    'Commercial Usage Rights',
    'Priority Processing'
  ]
};

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'OFFER' | 'WIDGET' | 'SUCCESS'>('OFFER');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleBuy = async () => {
    setLoading(true);
    try {
      // 1. Get Token (Mock)
      const { confirmation_token } = await createPayment(PRODUCT.price, `Payment: ${PRODUCT.name}`);
      
      // 2. Move to Widget Step
      setStep('WIDGET');
      
      // 3. Render Widget (wait a tick for DOM)
      setTimeout(() => {
        renderPaymentWidget(
          confirmation_token,
          'yookassa-widget-container',
          () => {
             setStep('SUCCESS');
             setTimeout(() => {
                 onSuccess();
                 onClose();
             }, 2000);
          },
          (err) => {
             alert("Payment initialization failed (Demo).");
             setStep('OFFER');
          }
        );
      }, 100);

    } catch (e) {
      console.error(e);
      alert("Failed to initialize payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-slate-700 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#020617]">
          <div className="flex items-center gap-2">
             <div className="bg-purple-600 p-1.5 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
             </div>
             <h2 className="text-xl font-bold text-white">Unlock Generation</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#0b0f19]">
          
          {step === 'OFFER' && (
            <div className="flex flex-col items-center text-center">
               <div className="w-full bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 mb-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Zap className="w-32 h-32" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-2">{PRODUCT.name}</h3>
                  <p className="text-slate-400 mb-6">{PRODUCT.description}</p>
                  
                  <div className="flex items-baseline justify-center gap-1 mb-6">
                     <span className="text-4xl font-bold text-white">{PRODUCT.price}₽</span>
                     <span className="text-slate-500">one-time</span>
                   </div>
                   
                   <ul className="space-y-3 text-left max-w-xs mx-auto mb-2">
                     {PRODUCT.features.map((feat, i) => (
                       <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                         <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 text-green-500" />
                         </div>
                         {feat}
                       </li>
                     ))}
                   </ul>
               </div>

               <button 
                 onClick={handleBuy}
                 disabled={loading}
                 className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-900/30 hover:scale-[1.02]"
               >
                 {loading ? <Loader2 className="animate-spin w-6 h-6" /> : `Pay ${PRODUCT.price}₽`}
               </button>
               
               <p className="mt-4 text-xs text-slate-500 flex items-center gap-1">
                 <ShieldCheck className="w-3 h-3" />
                 Secure payment via Yookassa
               </p>
            </div>
          )}

          {step === 'WIDGET' && (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
               <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">Complete Payment</h3>
                  <p className="text-slate-400">Total: {PRODUCT.price}₽</p>
               </div>
               
               <div id="yookassa-widget-container" className="w-full bg-white rounded-xl overflow-hidden min-h-[300px] flex items-center justify-center">
                  <div className="flex flex-col items-center text-slate-900 p-8">
                     <Loader2 className="animate-spin w-8 h-8 text-purple-600 mb-4" />
                     <p className="font-medium">Loading payment secure frame...</p>
                     <p className="text-xs text-slate-500 mt-4 max-w-xs text-center">
                        Note: In this demo without a backend, the payment will auto-succeed in 5 seconds.
                     </p>
                  </div>
               </div>
            </div>
          )}

          {step === 'SUCCESS' && (
             <div className="flex flex-col items-center justify-center h-full py-10">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                   <Check className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
                <p className="text-slate-400 mb-8">You can now generate amazing photos.</p>
                <div className="w-full max-w-xs h-1.5 bg-slate-800 rounded-full overflow-hidden">
                   <div className="h-full bg-green-500 w-full animate-[pulse_1s_ease-in-out]" />
                </div>
             </div>
          )}

        </div>
      </div>
    </div>
  );
};