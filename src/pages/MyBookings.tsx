import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Booking, Show, Movie, Screen, Theater, BookingSeat, Seat } from '@/types/database';
import { Ticket, Calendar, Clock, MapPin, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface BookingWithDetails extends Booking {
  show: Show & {
    movie: Movie;
    screen: Screen & { theater: Theater };
  };
  booking_seats: (BookingSeat & { seat: Seat })[];
}

export default function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user]);

  const fetchBookings = async () => {
    setLoading(true);

    const { data } = await supabase
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
        ),
        booking_seats(
          *,
          seat:seats(*)
        )
      `)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (data) {
      setBookings(data as unknown as BookingWithDetails[]);
    }

    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-seat-available text-accent-foreground';
      case 'pending':
        return 'bg-accent text-accent-foreground';
      case 'cancelled':
        return 'bg-destructive text-destructive-foreground';
      case 'refunded':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-secondary';
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Ticket className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="font-display text-4xl mb-4">MY BOOKINGS</h1>
          <p className="text-muted-foreground mb-6">Please sign in to view your bookings</p>
          <Button asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl tracking-wider mb-2">MY BOOKINGS</h1>
          <p className="text-muted-foreground">View and manage your movie tickets</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16">
            <Ticket className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="font-display text-2xl mb-2">No Bookings Yet</h2>
            <p className="text-muted-foreground mb-6">
              You haven't booked any movie tickets yet
            </p>
            <Button asChild>
              <Link to="/movies">Browse Movies</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={booking.id} className="bg-card/80 hover:border-primary/50 transition-colors">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Poster */}
                    {booking.show.movie.poster_url && (
                      <img
                        src={booking.show.movie.poster_url}
                        alt={booking.show.movie.title}
                        className="w-20 h-28 rounded-lg object-cover hidden md:block"
                      />
                    )}

                    {/* Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-display text-xl tracking-wide">
                            {booking.show.movie.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {booking.booking_reference}
                          </p>
                        </div>
                        <Badge className={getStatusColor(booking.status)}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(parseISO(booking.show.show_date), 'MMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {format(parseISO(`2000-01-01T${booking.show.show_time}`), 'h:mm a')}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {booking.show.screen.theater.name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex gap-1">
                          {booking.booking_seats.slice(0, 5).map((bs) => (
                            <span
                              key={bs.id}
                              className="px-2 py-0.5 bg-secondary text-xs rounded"
                            >
                              {bs.seat.row_label}{bs.seat.seat_number}
                            </span>
                          ))}
                          {booking.booking_seats.length > 5 && (
                            <span className="px-2 py-0.5 bg-secondary text-xs rounded">
                              +{booking.booking_seats.length - 5}
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-accent">
                          ${booking.total_amount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex items-center">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/booking/confirmation/${booking.id}`}>
                          <ChevronRight className="h-5 w-5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
