import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReservationTimerProps {
  expiryTime: Date;
  onExpire: () => void;
}

export function ReservationTimer({ expiryTime, onExpire }: ReservationTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = expiryTime.getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      
      setTimeLeft(remaining);

      if (remaining === 0) {
        onExpire();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiryTime, onExpire]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const isLow = timeLeft < 120; // Less than 2 minutes
  const isCritical = timeLeft < 60; // Less than 1 minute

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
        isCritical
          ? 'bg-destructive/20 text-destructive animate-pulse'
          : isLow
          ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
          : 'bg-accent/20 text-accent'
      )}
    >
      <Clock className="h-4 w-4" />
      <span>
        Seats reserved for {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
