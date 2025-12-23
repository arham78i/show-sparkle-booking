import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SeatMap } from '@/components/booking/SeatMap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Show, Screen, Theater, Movie, Seat, SeatWithStatus } from '@/types/database';
import { ArrowLeft, Clock, Calendar, MapPin, Ticket } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface ShowWithDetails extends Show {
  movie: Movie;
  screen: Screen & { theater: Theater };
}

export default function Booking() {
  const { showId } = useParams<{ showId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [show, setShow] = useState<ShowWithDetails | null>(null);
  const [seats, setSeats] = useState<SeatWithStatus[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<SeatWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (showId) {
      fetchShowDetails();
    }
  }, [showId]);

  const fetchShowDetails = async () => {
    setLoading(true);

    // Fetch show details
    const { data: showData, error: showError } = await supabase
      .from('shows')
      .select(`
        *,
        movie:movies(*),
        screen:screens(
          *,
          theater:theaters(*)
        )
      `)
      .eq('id', showId)
      .maybeSingle();

    if (showError || !showData) {
      toast({
        title: 'Error',
        description: 'Show not found',
        variant: 'destructive',
      });
      navigate('/movies');
      return;
    }

    setShow(showData as unknown as ShowWithDetails);

    // Fetch seats for the screen
    const { data: seatsData } = await supabase
      .from('seats')
      .select('*')
      .eq('screen_id', showData.screen_id)
      .order('row_label')
      .order('seat_number');

    // Fetch booked seats for this show
    const { data: bookedSeats } = await supabase
      .from('booking_seats')
      .select('seat_id')
      .eq('show_id', showId);

    const bookedSeatIds = new Set(bookedSeats?.map(bs => bs.seat_id) || []);

    if (seatsData) {
      const seatsWithStatus: SeatWithStatus[] = (seatsData as Seat[]).map(seat => ({
        ...seat,
        isBooked: bookedSeatIds.has(seat.id),
        isSelected: false,
      }));
      setSeats(seatsWithStatus);
    }

    setLoading(false);
  };

  const handleSeatClick = (seat: SeatWithStatus) => {
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

  const calculateTotal = () => {
    if (!show) return 0;
    return selectedSeats.reduce((total, seat) => {
      return total + (show.base_price * seat.price_multiplier);
    }, 0);
  };

  const handleProceedToPayment = async () => {
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

    setBooking(true);

    try {
      // Generate booking reference
      const bookingRef = `BK${format(new Date(), 'yyyyMMdd')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          show_id: showId,
          booking_reference: bookingRef,
          total_amount: calculateTotal(),
          status: 'confirmed',
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Create booking seats
      const bookingSeats = selectedSeats.map(seat => ({
        booking_id: bookingData.id,
        seat_id: seat.id,
        show_id: showId!,
        price: show!.base_price * seat.price_multiplier,
      }));

      const { error: seatsError } = await supabase
        .from('booking_seats')
        .insert(bookingSeats);

      if (seatsError) throw seatsError;

      toast({
        title: 'Booking confirmed!',
        description: `Your booking reference is ${bookingRef}`,
      });

      navigate(`/booking/confirmation/${bookingData.id}`);
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

  if (!show) {
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
            <Link to={`/movies/${show.movie.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Movie
            </Link>
          </Button>

          <div className="flex flex-col md:flex-row gap-6">
            {show.movie.poster_url && (
              <img
                src={show.movie.poster_url}
                alt={show.movie.title}
                className="w-24 h-36 rounded-lg object-cover hidden md:block"
              />
            )}
            <div>
              <h1 className="font-display text-3xl md:text-4xl tracking-wider mb-2">
                {show.movie.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(parseISO(show.show_date), 'EEEE, MMMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(parseISO(`2000-01-01T${show.show_time}`), 'h:mm a')}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {show.screen.theater.name} - {show.screen.name}
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
                    <span className="font-medium">{show.movie.title}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <span>{format(parseISO(show.show_date), 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Time</span>
                    <span>{format(parseISO(`2000-01-01T${show.show_time}`), 'h:mm a')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Theater</span>
                    <span>{show.screen.theater.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Screen</span>
                    <span>{show.screen.name}</span>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Selected Seats</span>
                    <span>{selectedSeats.length}</span>
                  </div>
                  {selectedSeats.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {selectedSeats
                        .sort((a, b) => a.row_label.localeCompare(b.row_label) || a.seat_number - b.seat_number)
                        .map(seat => (
                          <span
                            key={seat.id}
                            className="px-2 py-1 bg-accent/20 text-accent text-xs rounded"
                          >
                            {seat.row_label}{seat.seat_number}
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-accent">${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  className="w-full cinema-glow"
                  size="lg"
                  disabled={selectedSeats.length === 0 || booking}
                  onClick={handleProceedToPayment}
                >
                  {booking ? 'Processing...' : 'Confirm Booking'}
                </Button>

                {!user && (
                  <p className="text-xs text-muted-foreground text-center">
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
