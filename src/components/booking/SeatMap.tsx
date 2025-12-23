import { SeatWithStatus, SeatCategory } from '@/types/database';
import { cn } from '@/lib/utils';

interface SeatMapProps {
  seats: SeatWithStatus[];
  onSeatClick: (seat: SeatWithStatus) => void;
  maxSeats?: number;
  selectedCount: number;
}

export function SeatMap({ seats, onSeatClick, maxSeats = 10, selectedCount }: SeatMapProps) {
  // Group seats by row
  const seatsByRow = seats.reduce((acc, seat) => {
    if (!acc[seat.row_label]) {
      acc[seat.row_label] = [];
    }
    acc[seat.row_label].push(seat);
    return acc;
  }, {} as Record<string, SeatWithStatus[]>);

  // Sort rows alphabetically
  const sortedRows = Object.keys(seatsByRow).sort();

  const getCategoryColor = (category: SeatCategory, isBooked: boolean, isSelected: boolean) => {
    if (isBooked) return 'bg-seat-booked cursor-not-allowed opacity-50';
    if (isSelected) return 'bg-seat-selected seat-glow';
    
    switch (category) {
      case 'vip':
        return 'bg-seat-vip/20 border-seat-vip hover:bg-seat-vip/40';
      case 'premium':
        return 'bg-seat-premium/20 border-seat-premium hover:bg-seat-premium/40';
      default:
        return 'bg-seat-available/20 border-seat-available hover:bg-seat-available/40';
    }
  };

  const handleClick = (seat: SeatWithStatus) => {
    if (seat.isBooked) return;
    if (!seat.isSelected && selectedCount >= maxSeats) return;
    onSeatClick(seat);
  };

  return (
    <div className="space-y-8">
      {/* Screen */}
      <div className="relative">
        <div className="w-full h-2 bg-gradient-to-r from-transparent via-accent to-transparent rounded-full mb-2" />
        <p className="text-center text-sm text-muted-foreground">SCREEN</p>
      </div>

      {/* Seats */}
      <div className="flex flex-col items-center gap-2 overflow-x-auto pb-4">
        {sortedRows.map((row) => {
          const rowSeats = seatsByRow[row].sort((a, b) => a.seat_number - b.seat_number);
          
          return (
            <div key={row} className="flex items-center gap-2">
              <span className="w-6 text-sm text-muted-foreground font-medium">{row}</span>
              <div className="flex gap-1">
                {rowSeats.map((seat) => (
                  <button
                    key={seat.id}
                    onClick={() => handleClick(seat)}
                    disabled={seat.isBooked}
                    className={cn(
                      'w-8 h-8 rounded-t-lg border-2 transition-all text-xs font-medium flex items-center justify-center',
                      getCategoryColor(seat.category, seat.isBooked, seat.isSelected),
                      !seat.isBooked && !seat.isSelected && selectedCount < maxSeats && 'cursor-pointer'
                    )}
                    title={`${row}${seat.seat_number} - ${seat.category.toUpperCase()}`}
                  >
                    {seat.seat_number}
                  </button>
                ))}
              </div>
              <span className="w-6 text-sm text-muted-foreground font-medium">{row}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-6 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-t-md bg-seat-available/20 border-2 border-seat-available" />
          <span className="text-sm">Regular</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-t-md bg-seat-premium/20 border-2 border-seat-premium" />
          <span className="text-sm">Premium</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-t-md bg-seat-vip/20 border-2 border-seat-vip" />
          <span className="text-sm">VIP</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-t-md bg-seat-selected seat-glow" />
          <span className="text-sm">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-t-md bg-seat-booked opacity-50" />
          <span className="text-sm">Booked</span>
        </div>
      </div>
    </div>
  );
}
