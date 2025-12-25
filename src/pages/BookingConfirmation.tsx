import { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Calendar, Clock, MapPin, Ticket, Home, Film, Star, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatPrice } from '@/lib/currency';

interface BookingDetails {
  id: string;
  booking_reference: string;
  total_amount: number;
  status: string;
  created_at: string;
  cancelled_at?: string | null;
  refund_amount?: number | null;
  movie: {
    title: string;
    poster_url: string | null;
    // Stored as array in some places and string in others; keep flexible at runtime
    genre: any;
    duration_minutes: number;
    rating: number | null;
  };
  show: {
    show_date: string;
    show_time: string;
    theater_name: string;
    theater_location: string;
    screen_name: string;
  };
  seats: Array<{
    id: string;
    row_label: string;
    seat_number: number;
    category: string;
    price_multiplier: number;
    passenger_name?: string;
    price?: number;
  }>;
}

export default function BookingConfirmation() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const location = useLocation();
  const { user } = useAuth();

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const stateBooking = useMemo(() => {
    return (location.state as any)?.booking as BookingDetails | undefined;
  }, [location.state]);

  useEffect(() => {
    if (stateBooking) setBooking(stateBooking);
  }, [stateBooking]);

  useEffect(() => {
    let ignore = false;

    const fetchBooking = async () => {
      if (!bookingId) return;
      if (!user && !stateBooking) return; // can't read protected booking without auth

      setLoading(true);
      setLoadError(null);

      const { data, error } = await supabase
        .from('app_bookings')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle();

      if (ignore) return;

      if (error) {
        setLoadError(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setLoading(false);
        return;
      }

      const seatsRaw = Array.isArray((data as any).seats) ? ((data as any).seats as any[]) : [];

      const mapped: BookingDetails = {
        id: data.id,
        booking_reference: (data as any).booking_reference,
        total_amount: Number((data as any).total_amount ?? 0),
        status: (data as any).status,
        created_at: (data as any).created_at,
        cancelled_at: (data as any).cancelled_at,
        refund_amount: Number((data as any).refund_amount ?? 0),
        movie: {
          title: (data as any).movie_title,
          poster_url: (data as any).movie_poster_url,
          genre: stateBooking?.movie?.genre ?? [],
          duration_minutes: stateBooking?.movie?.duration_minutes ?? 0,
          rating: stateBooking?.movie?.rating ?? null,
        },
        show: {
          show_date: (data as any).show_date,
          show_time: (data as any).show_time,
          theater_name: (data as any).theater_name,
          theater_location: (data as any).theater_location ?? '',
          screen_name: (data as any).screen_name,
        },
        seats: seatsRaw.map((s) => ({
          id: s.id ?? `${s.row_label ?? ''}${s.seat_number ?? ''}`,
          row_label: String(s.row_label ?? ''),
          seat_number: Number(s.seat_number ?? 0),
          category: String(s.category ?? 'regular'),
          price_multiplier: Number(s.price_multiplier ?? 1),
          passenger_name: s.passenger_name ?? '',
          price: Number(s.price ?? 0),
        })),
      };

      setBooking((prev) => {
        if (!prev) return mapped;
        return {
          ...mapped,
          // keep richer movie/seats if we already have them from state
          movie: prev.movie?.title ? prev.movie : mapped.movie,
          seats: prev.seats?.length ? prev.seats : mapped.seats,
          show: prev.show ? prev.show : mapped.show,
        };
      });

      setLoading(false);
    };

    fetchBooking();

    return () => {
      ignore = true;
    };
  }, [bookingId, user, stateBooking]);

  const isCancelled = booking?.status === 'cancelled';

  const genres = useMemo(() => {
    const g: any = booking?.movie?.genre;
    if (Array.isArray(g)) {
      return g
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && (item as any).name) return String((item as any).name);
          return '';
        })
        .filter(Boolean);
    }
    if (typeof g === 'string') return g.split(',').map((s) => s.trim()).filter(Boolean);
    return [] as string[];
  }, [booking]);

  if (!booking) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-seat-available/20 mb-4">
            <CheckCircle className="h-10 w-10 text-seat-available" />
          </div>
          <h1 className="font-display text-4xl mb-4">Booking Confirmed!</h1>
          <p className="text-muted-foreground mb-8">
            Your booking reference: <span className="font-mono text-foreground">{bookingId}</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild>
              <Link to="/movies">
                <Film className="mr-2 h-4 w-4" />
                Browse More Movies
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        {/* Success Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-seat-available/20 mb-4">
            <CheckCircle className="h-10 w-10 text-seat-available" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl tracking-wider mb-2">
            {isCancelled ? 'BOOKING CANCELLED' : 'BOOKING CONFIRMED!'}
          </h1>
          <p className="text-muted-foreground">
            {isCancelled ? 'Your booking was cancelled and refund details are shown below.' : 'Your tickets have been booked successfully'}
          </p>
          {loadError && (
            <p className="text-sm text-destructive mt-3">{loadError}</p>
          )}
          {loading && (
            <p className="text-sm text-muted-foreground mt-2">Refreshing booking status…</p>
          )}
        </div>

        {/* Ticket Card */}
          <Card className="bg-card/80 overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm opacity-80">Booking Reference</p>
                  <p className="font-display text-2xl tracking-wider">
                    {booking.booking_reference}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-primary-foreground/30 text-primary-foreground">
                    {booking.status.toUpperCase()}
                  </Badge>
                  <Ticket className="h-8 w-8 opacity-60" />
                </div>
              </div>
            </div>

          <CardContent className="p-6 space-y-6">
            {/* Movie Info */}
            <div className="flex gap-4">
              {booking.movie.poster_url && (
                <img
                  src={booking.movie.poster_url}
                  alt={booking.movie.title}
                  className="w-20 h-28 rounded-lg object-cover"
                />
              )}
              <div>
                <h2 className="font-display text-2xl tracking-wide mb-1">
                  {booking.movie.title}
                </h2>
                <p className="text-muted-foreground text-sm flex items-center gap-2">
                  {genres.length > 0 && genres.slice(0, 3).join(' • ')}
                  {booking.movie.duration_minutes > 0 && (
                    <>
                      {genres.length > 0 ? ' • ' : ''}{booking.movie.duration_minutes} min
                    </>
                  )}
                  {booking.movie.rating && (
                    <span className="flex items-center gap-1 text-accent">
                      <Star className="h-3 w-3 fill-accent" />
                      {booking.movie.rating.toFixed(1)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(parseISO(booking.show.show_date), 'EEEE, MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {format(parseISO(`2000-01-01T${booking.show.show_time}`), 'h:mm a')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 col-span-2">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Venue</p>
                  <p className="font-medium">{booking.show.theater_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {booking.show.screen_name} • {booking.show.theater_location}
                  </p>
                </div>
              </div>
            </div>

            {/* Passengers & Seats */}
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
                <User className="h-4 w-4" />
                Passengers ({booking.seats.length})
              </p>
              <div className="space-y-2">
                {booking.seats
                  .sort((a, b) => 
                    a.row_label.localeCompare(b.row_label) || 
                    a.seat_number - b.seat_number
                  )
                  .map((seat, idx) => (
                    <div
                      key={seat.id}
                      className="flex items-center justify-between bg-secondary/30 px-3 py-2 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-accent/20 text-accent rounded text-sm font-medium">
                          {seat.row_label}{seat.seat_number}
                        </span>
                        <div>
                          <p className="font-medium text-sm">
                            {seat.passenger_name || `Passenger ${idx + 1}`}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">{seat.category}</p>
                        </div>
                      </div>
                      {seat.price ? (
                        <span className="text-sm text-accent">{formatPrice(seat.price)}</span>
                      ) : null}
                    </div>
                  ))}
              </div>
            </div>

            {/* Total / Refund */}
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Total Paid</span>
                <span className="font-display text-3xl text-accent">
                  {formatPrice(booking.total_amount)}
                </span>
              </div>

              {booking.status === 'cancelled' && (
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Refund Amount</span>
                  <span className={((booking.refund_amount || 0) > 0) ? 'font-display text-2xl text-seat-available' : 'font-display text-2xl text-destructive'}>
                    {formatPrice(booking.refund_amount || 0)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>

          {/* Barcode-like decoration */}
          <div className="h-16 bg-secondary/50 flex items-center justify-center gap-1 border-t border-dashed border-border">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="bg-foreground/20"
                style={{
                  width: Math.random() > 0.5 ? '3px' : '2px',
                  height: `${Math.random() * 20 + 20}px`,
                }}
              />
            ))}
          </div>
        </Card>

        {/* Instructions */}
        <Card className="mt-6 bg-secondary/30">
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">Important Information</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Please arrive 15 minutes before the show starts</li>
              <li>• Show your booking reference at the ticket counter</li>
              <li>• This confirmation is valid as your entry ticket</li>
              <li>• No outside food or beverages allowed</li>
            </ul>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Button asChild className="flex-1">
            <Link to="/movies">
              <Film className="mr-2 h-4 w-4" />
              Browse More Movies
            </Link>
          </Button>
          <Button variant="ghost" asChild className="flex-1">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
}
