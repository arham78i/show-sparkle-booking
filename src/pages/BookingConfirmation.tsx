import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Booking, BookingSeat, Show, Movie, Screen, Theater, Seat } from '@/types/database';
import { CheckCircle, Calendar, Clock, MapPin, Ticket, Home, Film } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface BookingWithDetails extends Booking {
  show: Show & {
    movie: Movie;
    screen: Screen & { theater: Theater };
  };
}

interface BookingSeatWithDetails extends BookingSeat {
  seat: Seat;
}

export default function BookingConfirmation() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<BookingWithDetails | null>(null);
  const [seats, setSeats] = useState<BookingSeatWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (bookingId) {
      fetchBookingDetails();
    }
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    setLoading(true);

    const { data: bookingData } = await supabase
      .from('bookings')
      .select(`
        *,
        show:shows(
          *,
          movie:movies(*),
          screen:screens(
            *,
            theater:theaters(*)
          )
        )
      `)
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingData) {
      setBooking(bookingData as unknown as BookingWithDetails);
    }

    const { data: seatsData } = await supabase
      .from('booking_seats')
      .select(`
        *,
        seat:seats(*)
      `)
      .eq('booking_id', bookingId);

    if (seatsData) {
      setSeats(seatsData as unknown as BookingSeatWithDetails[]);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-2xl">
          <Skeleton className="h-12 w-48 mx-auto mb-8" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!booking) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-4xl mb-4">Booking Not Found</h1>
          <Button asChild>
            <Link to="/bookings">View My Bookings</Link>
          </Button>
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
            BOOKING CONFIRMED!
          </h1>
          <p className="text-muted-foreground">
            Your tickets have been booked successfully
          </p>
        </div>

        {/* Ticket Card */}
        <Card className="bg-card/80 overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Booking Reference</p>
                <p className="font-display text-2xl tracking-wider">
                  {booking.booking_reference}
                </p>
              </div>
              <Ticket className="h-8 w-8 opacity-60" />
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Movie Info */}
            <div className="flex gap-4">
              {booking.show.movie.poster_url && (
                <img
                  src={booking.show.movie.poster_url}
                  alt={booking.show.movie.title}
                  className="w-20 h-28 rounded-lg object-cover"
                />
              )}
              <div>
                <h2 className="font-display text-2xl tracking-wide mb-1">
                  {booking.show.movie.title}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {booking.show.movie.genre.join(' • ')} • {booking.show.movie.duration_minutes} min
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
                  <p className="font-medium">{booking.show.screen.theater.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {booking.show.screen.name} • {booking.show.screen.theater.location}
                  </p>
                </div>
              </div>
            </div>

            {/* Seats */}
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground mb-2">Seats ({seats.length})</p>
              <div className="flex flex-wrap gap-2">
                {seats
                  .sort((a, b) => 
                    a.seat.row_label.localeCompare(b.seat.row_label) || 
                    a.seat.seat_number - b.seat.seat_number
                  )
                  .map((bs) => (
                    <span
                      key={bs.id}
                      className="px-3 py-1 bg-accent/20 text-accent rounded-full text-sm font-medium"
                    >
                      {bs.seat.row_label}{bs.seat.seat_number}
                    </span>
                  ))}
              </div>
            </div>

            {/* Total */}
            <div className="border-t border-border pt-4 flex justify-between items-center">
              <span className="text-lg font-medium">Total Paid</span>
              <span className="font-display text-3xl text-accent">
                ${booking.total_amount.toFixed(2)}
              </span>
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

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Button asChild className="flex-1">
            <Link to="/bookings">
              <Ticket className="mr-2 h-4 w-4" />
              View My Bookings
            </Link>
          </Button>
          <Button variant="outline" asChild className="flex-1">
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
