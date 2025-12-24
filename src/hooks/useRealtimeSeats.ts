import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SeatWithStatus, SeatCategory } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';

interface UseRealtimeSeatsProps {
  showId: string;
  screenId?: string;
}

interface SeatAvailability {
  seat_id: string;
  is_available: boolean;
}

// Generate seats for a screen with proper IDs
function generateSeatsForScreen(screenId: string): SeatWithStatus[] {
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const seatsPerRow = 12;
  const seats: SeatWithStatus[] = [];

  rows.forEach((row, rowIdx) => {
    for (let seatNum = 1; seatNum <= seatsPerRow; seatNum++) {
      let category: SeatCategory = 'regular';
      let priceMultiplier = 1.0;

      // VIP rows (I, J - back rows)
      if (rowIdx >= 8) {
        category = 'vip';
        priceMultiplier = 1.5;
      }
      // Premium rows (F, G, H - middle rows)
      else if (rowIdx >= 5) {
        category = 'premium';
        priceMultiplier = 1.25;
      }

      seats.push({
        id: `${screenId}-${row}${seatNum}`,
        screen_id: screenId,
        row_label: row,
        seat_number: seatNum,
        category,
        price_multiplier: priceMultiplier,
        created_at: new Date().toISOString(),
        isBooked: false,
        isSelected: false,
      });
    }
  });

  return seats;
}

export function useRealtimeSeats({ showId, screenId = 'screen-1' }: UseRealtimeSeatsProps) {
  const { user } = useAuth();
  const [seats, setSeats] = useState<SeatWithStatus[]>(() => generateSeatsForScreen(screenId));
  const [selectedSeats, setSelectedSeats] = useState<SeatWithStatus[]>([]);
  const [reservationExpiry, setReservationExpiry] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);

  // Fetch seat availability
  const fetchAvailability = useCallback(async () => {
    try {
      const seatIds = seats.map(s => s.id);
      
      const { data, error } = await supabase.rpc('check_seat_availability', {
        _seat_ids: seatIds,
        _show_id: showId,
      });

      if (error) {
        console.error('Error checking seat availability:', error);
        return;
      }

      if (data) {
        const availabilityMap = new Map<string, boolean>();
        (data as SeatAvailability[]).forEach((item) => {
          availabilityMap.set(item.seat_id, item.is_available);
        });

        setSeats(prev => prev.map(seat => ({
          ...seat,
          isBooked: !availabilityMap.get(seat.id),
        })));
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
    } finally {
      setLoading(false);
    }
  }, [showId, seats.length]);

  // Initial fetch
  useEffect(() => {
    fetchAvailability();
  }, [showId]);

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel(`seats-${showId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seat_reservations',
          filter: `show_id=eq.${showId}`,
        },
        () => {
          fetchAvailability();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_seats',
          filter: `show_id=eq.${showId}`,
        },
        () => {
          fetchAvailability();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showId, fetchAvailability]);

  // Handle seat click
  const handleSeatClick = useCallback((seat: SeatWithStatus) => {
    if (seat.isBooked) return;

    setSeats(prev =>
      prev.map(s =>
        s.id === seat.id ? { ...s, isSelected: !s.isSelected } : s
      )
    );

    setSelectedSeats(prev => {
      const exists = prev.find(s => s.id === seat.id);
      if (exists) {
        return prev.filter(s => s.id !== seat.id);
      }
      return [...prev, { ...seat, isSelected: true }];
    });
  }, []);

  // Reserve selected seats
  const reserveSeats = useCallback(async () => {
    if (!user || selectedSeats.length === 0) return { success: false, message: 'No seats selected' };

    setReserving(true);
    try {
      const seatIds = selectedSeats.map(s => s.id);
      
      const { data, error } = await supabase.rpc('reserve_seats', {
        _seat_ids: seatIds,
        _show_id: showId,
        _user_id: user.id,
      });

      if (error) {
        console.error('Error reserving seats:', error);
        return { success: false, message: error.message };
      }

      const result = data as { success: boolean; message: string }[];
      if (result && result[0]) {
        if (result[0].success) {
          // Set expiry to 10 minutes from now
          setReservationExpiry(new Date(Date.now() + 10 * 60 * 1000));
        }
        return result[0];
      }

      return { success: false, message: 'Unknown error' };
    } catch (err: any) {
      console.error('Error reserving seats:', err);
      return { success: false, message: err.message };
    } finally {
      setReserving(false);
    }
  }, [user, selectedSeats, showId]);

  // Complete booking
  const completeBooking = useCallback(async (totalAmount: number) => {
    if (!user || selectedSeats.length === 0) {
      return { success: false, message: 'No seats selected', booking_id: null, booking_reference: null };
    }

    try {
      const seatIds = selectedSeats.map(s => s.id);
      
      const { data, error } = await supabase.rpc('complete_booking', {
        _seat_ids: seatIds,
        _show_id: showId,
        _user_id: user.id,
        _total_amount: totalAmount,
      });

      if (error) {
        console.error('Error completing booking:', error);
        return { success: false, message: error.message, booking_id: null, booking_reference: null };
      }

      const result = data as { booking_id: string; booking_reference: string }[];
      if (result && result[0]) {
        setSelectedSeats([]);
        setReservationExpiry(null);
        return { 
          success: true, 
          message: 'Booking confirmed!',
          booking_id: result[0].booking_id,
          booking_reference: result[0].booking_reference,
        };
      }

      return { success: false, message: 'Unknown error', booking_id: null, booking_reference: null };
    } catch (err: any) {
      console.error('Error completing booking:', err);
      return { success: false, message: err.message, booking_id: null, booking_reference: null };
    }
  }, [user, selectedSeats, showId]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSeats(prev => prev.map(s => ({ ...s, isSelected: false })));
    setSelectedSeats([]);
    setReservationExpiry(null);
  }, []);

  return {
    seats,
    selectedSeats,
    loading,
    reserving,
    reservationExpiry,
    handleSeatClick,
    reserveSeats,
    completeBooking,
    clearSelection,
    refreshAvailability: fetchAvailability,
  };
}
