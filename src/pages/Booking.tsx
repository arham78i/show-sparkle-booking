import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SeatMap } from '@/components/booking/SeatMap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useMovieDetails } from '@/hooks/useTMDBMovies';
import { supabase } from '@/integrations/supabase/client';
import { SeatWithStatus, SeatCategory } from '@/types/database';
import { ArrowLeft, Clock, Calendar, MapPin, Ticket, Star, AlertCircle, Loader2, RefreshCw, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatPrice } from '@/lib/currency';

interface ShowInfo {
  id: string;
  movie_id: string;
  show_date: string;
  show_time: string;
  base_price: number;
  theater_name: string;
  theater_location: string;
  screen_name: string;
}

// Generate sample seats for a screen
function generateSeats(bookedSeatIds: string[] = []): SeatWithStatus[] {
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

      const seatId = `${row}${seatNum}`;
      const isBooked = bookedSeatIds.includes(seatId);

      seats.push({
        id: seatId,
        screen_id: 'sample-screen',
        row_label: row,
        seat_number: seatNum,
        category,
        price_multiplier: priceMultiplier,
        created_at: new Date().toISOString(),
        isBooked,
        isSelected: false,
      });
    }
  });

  return seats;
}

// Parse show ID to get show info
function parseShowId(showId: string): ShowInfo | null {
  const parts = showId.split('-');
  if (parts.length < 3) return null;

  const movieId = parts[0];
  const theaterId = parts[1];
  const time = parts[2];

  const theaters: Record<string, { name: string; location: string }> = {
    '1': { name: 'Nueplex Cinemas', location: 'Clifton, Karachi' },
    '2': { name: 'Cinepax', location: 'Dolmen Mall, Karachi' },
    '3': { name: 'Cue Cinema', location: 'Gulshan, Karachi' },
  };

  const theater = theaters[theaterId] || theaters['1'];
  const formattedTime = time.slice(0, 2) + ':' + time.slice(2) + ':00';

  // Price based on time in PKR
  const hour = parseInt(time.slice(0, 2));
  let basePrice = 500; // Rs. 500 for morning shows
  if (hour >= 18) basePrice = 800; // Rs. 800 for evening shows
  else if (hour >= 14) basePrice = 650; // Rs. 650 for afternoon shows

  return {
    id: showId,
    movie_id: movieId,
    show_date: format(new Date(), 'yyyy-MM-dd'),
    show_time: formattedTime,
    base_price: basePrice,
    theater_name: theater.name,
    theater_location: theater.location,
    screen_name: 'Screen 1',
  };
}

export default function Booking() {
  const { showId } = useParams<{ showId: string }>();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [showInfo, setShowInfo] = useState<ShowInfo | null>(null);
  const [seats, setSeats] = useState<SeatWithStatus[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<SeatWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [passengerNames, setPassengerNames] = useState<Record<string, string>>({});
  const refreshIntervalRef = useRef<number | null>(null);

  const { movie } = useMovieDetails(showInfo?.movie_id);

  // Fetch booked seats from database
  const fetchBookedSeats = useCallback(async (info: ShowInfo, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    
    try {
      const { data, error } = await supabase.rpc('get_app_booked_seat_ids', {
        _tmdb_movie_id: info.movie_id,
        _theater_name: info.theater_name,
        _show_date: info.show_date,
        _show_time: info.show_time,
      });

      if (error) {
        console.error('Error fetching booked seats:', error);
        return [];
      }

      return (data as string[]) || [];
    } catch (err) {
      console.error('Failed to fetch booked seats:', err);
      return [];
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  // Initialize seats with booked status
  const initializeSeats = useCallback(async (info: ShowInfo) => {
    const bookedSeatIds = await fetchBookedSeats(info);
    setSeats(generateSeats(bookedSeatIds));
  }, [fetchBookedSeats]);

  // Refresh seats to get latest availability
  const refreshSeats = useCallback(async () => {
    if (!showInfo) return;
    
    const bookedSeatIds = await fetchBookedSeats(showInfo, true);
    
    setSeats(prev => prev.map(seat => ({
      ...seat,
      isBooked: bookedSeatIds.includes(seat.id),
      // Deselect if now booked by someone else
      isSelected: bookedSeatIds.includes(seat.id) ? false : seat.isSelected,
    })));

    // Remove from selected if now booked
    setSelectedSeats(prev => prev.filter(s => !bookedSeatIds.includes(s.id)));
  }, [showInfo, fetchBookedSeats]);

  useEffect(() => {
    if (showId) {
      const info = parseShowId(showId);
      if (info) {
        setShowInfo(info);
        initializeSeats(info);
      }
      setLoading(false);
    }
  }, [showId, initializeSeats]);

  // Auto-refresh seats every 30 seconds
  useEffect(() => {
    if (showInfo) {
      refreshIntervalRef.current = window.setInterval(() => {
        refreshSeats();
      }, 30000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [showInfo, refreshSeats]);

  const handleSeatClick = (seat: SeatWithStatus) => {
    if (seat.isBooked) return;
    
    setSeats(prev =>
      prev.map(s =>
        s.id === seat.id ? { ...s, isSelected: !s.isSelected } : s
      )
    );

    setSelectedSeats(prev => {
      const exists = prev.find(s => s.id === seat.id);
      if (exists) {
        // Remove passenger name when deselecting seat
        setPassengerNames(names => {
          const updated = { ...names };
          delete updated[seat.id];
          return updated;
        });
        return prev.filter(s => s.id !== seat.id);
      }
      return [...prev, { ...seat, isSelected: true }];
    });
  };

  const handlePassengerNameChange = (seatId: string, name: string) => {
    setPassengerNames(prev => ({
      ...prev,
      [seatId]: name,
    }));
  };

  const allPassengerNamesEntered = selectedSeats.every(
    seat => passengerNames[seat.id]?.trim()
  );

  const calculateTotal = useCallback(() => {
    if (!showInfo) return 0;
    return selectedSeats.reduce((total, seat) => {
      return total + (showInfo.base_price * seat.price_multiplier);
    }, 0);
  }, [showInfo, selectedSeats]);

  const getSeatPrice = (seat: SeatWithStatus) => {
    if (!showInfo) return 0;
    return showInfo.base_price * seat.price_multiplier;
  };

  const handleBookTicket = async () => {
    if (authLoading) {
      toast({
        title: 'Please wait',
        description: 'Checking your sign-in status…',
      });
      return;
    }

    // Always validate against the client session (prevents calls with anon token)
    const { data: { session: latestSession } } = await supabase.auth.getSession();

    if (!latestSession) {
      toast({
        title: 'Please sign in',
        description: 'Sign in to book tickets (your session may have expired).',
      });
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    if (selectedSeats.length === 0) {
      toast({
        title: 'No seats selected',
        description: 'Please select at least one seat',
        variant: 'destructive',
      });
      return;
    }

    // Validate passenger names
    const missingNames = selectedSeats.filter(seat => !passengerNames[seat.id]?.trim());
    if (missingNames.length > 0) {
      toast({
        title: 'Passenger names required',
        description: `Please enter names for all ${selectedSeats.length} passenger(s)`,
        variant: 'destructive',
      });
      return;
    }

    if (!showInfo) return;

    setBooking(true);

    try {
      const total = calculateTotal();

      // Prepare seats data for JSONB storage (with passenger names)
      const seatsData = selectedSeats.map(seat => ({
        id: seat.id,
        row_label: seat.row_label,
        seat_number: seat.seat_number,
        category: seat.category,
        price: getSeatPrice(seat),
        passenger_name: passengerNames[seat.id]?.trim() || '',
      }));

      // Use atomic booking function to prevent double-booking
      const { data: bookingResult, error: bookingError } = await supabase.rpc('complete_app_booking', {
        _tmdb_movie_id: showInfo.movie_id,
        _movie_title: movie?.title || 'Movie',
        _movie_poster_url: movie?.poster_url || null,
        _theater_name: showInfo.theater_name,
        _theater_location: showInfo.theater_location,
        _screen_name: showInfo.screen_name,
        _show_date: showInfo.show_date,
        _show_time: showInfo.show_time,
        _seats: seatsData,
        _total_amount: total,
      });

      if (bookingError) {
        // Handle specific error cases
        if (bookingError.message.includes('seats_unavailable')) {
          toast({
            title: 'Seats no longer available',
            description: 'Some seats were booked by another user. Please select different seats.',
            variant: 'destructive',
          });
          // Refresh to show updated availability
          await refreshSeats();
          return;
        }

        if (bookingError.message.includes('not_authenticated')) {
          toast({
            title: 'Please sign in',
            description: 'Your login session expired. Please sign in again to book.',
            variant: 'destructive',
          });
          navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return;
        }

        throw bookingError;
      }

      const result = bookingResult as { booking_id: string; booking_ref: string }[];
      
      if (!result || result.length === 0) {
        throw new Error('Booking failed');
      }

      const { booking_id, booking_ref } = result[0];

      toast({
        title: 'Booking confirmed!',
        description: `Your booking reference is ${booking_ref}`,
      });

      navigate(`/booking/confirmation/${booking_id}`, {
        state: {
          booking: {
            id: booking_id,
            booking_reference: booking_ref,
            total_amount: total,
            status: 'confirmed',
            created_at: new Date().toISOString(),
            movie: movie,
            show: showInfo,
            seats: selectedSeats,
          }
        }
      });
    } catch (error: any) {
      toast({
        title: 'Booking failed',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!showInfo) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-4xl mb-4">Show Not Found</h1>
          <Button asChild>
            <Link to="/movies">Browse Movies</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link to={`/movies/${showInfo.movie_id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Movie
            </Link>
          </Button>

          <div className="flex flex-col md:flex-row gap-6">
            {movie?.poster_url && (
              <img
                src={movie.poster_url}
                alt={movie.title}
                className="w-24 h-36 rounded-lg object-cover hidden md:block"
              />
            )}
            <div>
              <h1 className="font-display text-3xl md:text-4xl tracking-wider mb-2">
                {movie?.title || 'Movie'}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(parseISO(showInfo.show_date), 'EEEE, MMMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(parseISO(`2000-01-01T${showInfo.show_time}`), 'h:mm a')}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {showInfo.theater_name} - {showInfo.screen_name}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Seat Map */}
          <div className="lg:col-span-2">
            <Card className="bg-card/80">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-display text-xl tracking-wide">SELECT YOUR SEATS</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Select up to 10 seats. Seats update in real-time.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={refreshSeats}
                  disabled={refreshing}
                  className="shrink-0"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {/* Price Legend */}
                <div className="mb-6 p-4 bg-secondary/30 rounded-lg">
                  <h4 className="text-sm font-medium mb-3">Seat Prices</h4>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-seat-available/20 border-2 border-seat-available" />
                      Regular: {formatPrice(showInfo.base_price)}
                    </span>
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-seat-premium/20 border-2 border-seat-premium" />
                      Premium: {formatPrice(showInfo.base_price * 1.25)}
                    </span>
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-seat-vip/20 border-2 border-seat-vip" />
                      VIP: {formatPrice(showInfo.base_price * 1.5)}
                    </span>
                  </div>
                </div>

                <SeatMap
                  seats={seats}
                  onSeatClick={handleSeatClick}
                  maxSeats={10}
                  selectedCount={selectedSeats.length}
                />
              </CardContent>
            </Card>
          </div>

          {/* Booking Summary */}
          <div className="lg:col-span-1">
            <Card className="bg-card/80 sticky top-24">
              <CardHeader>
                <CardTitle className="font-display text-xl tracking-wide flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  BOOKING SUMMARY
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Movie</span>
                    <span className="font-medium">{movie?.title}</span>
                  </div>
                  {movie?.rating && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rating</span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-accent text-accent" />
                        {movie.rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <span>{format(parseISO(showInfo.show_date), 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Time</span>
                    <span>{format(parseISO(`2000-01-01T${showInfo.show_time}`), 'h:mm a')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Theater</span>
                    <span>{showInfo.theater_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Screen</span>
                    <span>{showInfo.screen_name}</span>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <User className="h-4 w-4" />
                      Passengers ({selectedSeats.length})
                    </span>
                  </div>
                  {selectedSeats.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {selectedSeats
                        .sort((a, b) => a.row_label.localeCompare(b.row_label) || a.seat_number - b.seat_number)
                        .map((seat, idx) => (
                          <div
                            key={seat.id}
                            className="bg-secondary/30 px-3 py-3 rounded space-y-2"
                          >
                            <div className="flex justify-between items-center text-sm">
                              <span className="flex items-center gap-2">
                                <span className="font-medium">{seat.row_label}{seat.seat_number}</span>
                                <span className="text-xs text-muted-foreground capitalize">({seat.category})</span>
                              </span>
                              <span className="text-accent">{formatPrice(getSeatPrice(seat))}</span>
                            </div>
                            <div>
                              <Label htmlFor={`passenger-${seat.id}`} className="text-xs text-muted-foreground">
                                Passenger {idx + 1} Name
                              </Label>
                              <Input
                                id={`passenger-${seat.id}`}
                                placeholder="Enter passenger name"
                                value={passengerNames[seat.id] || ''}
                                onChange={(e) => handlePassengerNameChange(seat.id, e.target.value)}
                                className="mt-1 h-8 text-sm bg-background/50"
                                maxLength={50}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-accent">
                      {formatPrice(calculateTotal())}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full cinema-glow"
                  size="lg"
                  disabled={selectedSeats.length === 0 || !allPassengerNamesEntered || booking || authLoading}
                  onClick={handleBookTicket}
                >
                  {booking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    `Book ${selectedSeats.length} Ticket${selectedSeats.length !== 1 ? 's' : ''}`
                  )}
                </Button>

                {selectedSeats.length > 0 && !allPassengerNamesEntered && (
                  <p className="text-xs text-amber-500 text-center flex items-center justify-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Enter names for all passengers to continue
                  </p>
                )}

                {!session && (
                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    You'll need to sign in to complete your booking
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
