import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SeatMap } from '@/components/booking/SeatMap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useMovieDetails } from '@/hooks/useTMDBMovies';
import { supabase } from '@/integrations/supabase/client';
import { SeatWithStatus, SeatCategory } from '@/types/database';
import { ArrowLeft, Clock, Calendar, MapPin, Ticket, Star, AlertCircle, Loader2 } from 'lucide-react';
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
function generateSeats(): SeatWithStatus[] {
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

      // Randomly book some seats (15% chance)
      const isBooked = Math.random() < 0.15;

      seats.push({
        id: `${row}${seatNum}`,
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
    '1': { name: 'CineMax Downtown', location: 'Main Street, New York' },
    '2': { name: 'StarPlex Cinema', location: 'Mall Road, New York' },
    '3': { name: 'AMC Theater', location: 'Broadway, New York' },
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
  const { user } = useAuth();
  const { toast } = useToast();

  const [showInfo, setShowInfo] = useState<ShowInfo | null>(null);
  const [seats, setSeats] = useState<SeatWithStatus[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<SeatWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  const { movie } = useMovieDetails(showInfo?.movie_id);

  useEffect(() => {
    if (showId) {
      const info = parseShowId(showId);
      if (info) {
        setShowInfo(info);
        setSeats(generateSeats());
      }
      setLoading(false);
    }
  }, [showId]);

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
        return prev.filter(s => s.id !== seat.id);
      }
      return [...prev, { ...seat, isSelected: true }];
    });
  };

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
    if (!user) {
      toast({
        title: 'Please sign in',
        description: 'You need to be signed in to book tickets',
      });
      navigate('/auth');
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

    if (!showInfo) return;

    setBooking(true);

    try {
      const total = calculateTotal();
      const bookingRef = `BK${format(new Date(), 'yyyyMMdd')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Prepare seats data for JSONB storage
      const seatsData = selectedSeats.map(seat => ({
        id: seat.id,
        row_label: seat.row_label,
        seat_number: seat.seat_number,
        category: seat.category,
        price: getSeatPrice(seat),
      }));

      // Create booking in app_bookings table
      const { data: bookingData, error: bookingError } = await supabase
        .from('app_bookings')
        .insert({
          user_id: user.id,
          tmdb_movie_id: showInfo.movie_id,
          movie_title: movie?.title || 'Movie',
          movie_poster_url: movie?.poster_url || null,
          theater_name: showInfo.theater_name,
          theater_location: showInfo.theater_location,
          screen_name: showInfo.screen_name,
          show_date: showInfo.show_date,
          show_time: showInfo.show_time,
          seats: seatsData,
          total_amount: total,
          booking_reference: bookingRef,
          status: 'confirmed',
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      toast({
        title: 'Booking confirmed!',
        description: `Your booking reference is ${bookingData.booking_reference}`,
      });

      navigate(`/booking/confirmation/${bookingData.id}`, {
        state: {
          booking: {
            id: bookingData.id,
            booking_reference: bookingData.booking_reference,
            total_amount: total,
            status: 'confirmed',
            created_at: bookingData.created_at,
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
              <CardHeader>
                <CardTitle className="font-display text-xl tracking-wide">SELECT YOUR SEATS</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Select up to 10 seats. Click on available seats to select them.
                </p>
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
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Selected Seats</span>
                    <span>{selectedSeats.length}</span>
                  </div>
                  {selectedSeats.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {selectedSeats
                        .sort((a, b) => a.row_label.localeCompare(b.row_label) || a.seat_number - b.seat_number)
                        .map(seat => (
                          <div
                            key={seat.id}
                            className="flex justify-between items-center text-sm bg-secondary/30 px-3 py-2 rounded"
                          >
                            <span className="flex items-center gap-2">
                              <span className="font-medium">{seat.row_label}{seat.seat_number}</span>
                              <span className="text-xs text-muted-foreground capitalize">({seat.category})</span>
                            </span>
                            <span className="text-accent">{formatPrice(getSeatPrice(seat))}</span>
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
                  disabled={selectedSeats.length === 0 || booking}
                  onClick={handleBookTicket}
                >
                  {booking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    'Book Ticket'
                  )}
                </Button>

                {!user && (
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
