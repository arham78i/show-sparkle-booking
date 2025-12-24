import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Loader2, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => Promise<void>;
  amount: number;
  seatCount: number;
}

export function PaymentModal({ open, onClose, onComplete, amount, seatCount }: PaymentModalProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [name, setName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const groups = digits.match(/.{1,4}/g) || [];
    return groups.join(' ').slice(0, 19);
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 2) {
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
    }
    return digits;
  };

  const isValidForm = () => {
    return (
      cardNumber.replace(/\s/g, '').length === 16 &&
      expiry.length === 5 &&
      cvv.length >= 3 &&
      name.length >= 2
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidForm()) return;

    setProcessing(true);

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    setSuccess(true);
    
    // Wait a moment to show success state
    await new Promise(resolve => setTimeout(resolve, 1000));

    await onComplete();
  };

  const handleClose = () => {
    if (!processing) {
      setCardNumber('');
      setExpiry('');
      setCvv('');
      setName('');
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wide flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            PAYMENT
          </DialogTitle>
          <DialogDescription>
            Complete your payment to confirm the booking
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="font-display text-lg mb-2">Payment Successful!</h3>
            <p className="text-sm text-muted-foreground">Confirming your booking...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount Summary */}
            <div className="bg-secondary/30 p-4 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{seatCount} seat(s)</span>
                <span className="font-medium">${amount.toFixed(2)}</span>
              </div>
            </div>

            {/* Card Number */}
            <div className="space-y-2">
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input
                id="cardNumber"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                maxLength={19}
                disabled={processing}
              />
            </div>

            {/* Cardholder Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Cardholder Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={processing}
              />
            </div>

            {/* Expiry and CVV */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry Date</Label>
                <Input
                  id="expiry"
                  placeholder="MM/YY"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  maxLength={5}
                  disabled={processing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  placeholder="123"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  type="password"
                  disabled={processing}
                />
              </div>
            </div>

            {/* Demo Notice */}
            <p className="text-xs text-muted-foreground text-center">
              This is a demo payment. Use any valid format for card details.
            </p>

            {/* Submit Button */}
            <Button
              type="submit"
              className={cn('w-full', processing && 'cursor-not-allowed')}
              disabled={!isValidForm() || processing}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Pay ${amount.toFixed(2)}
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
