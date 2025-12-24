import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Ticket, Calendar, Clock, MapPin, ChevronRight, XCircle, RefreshCcw } from 'lucide-react';
import { format, parseISO, differenceInHours } from 'date-fns';

interface SeatData {
  id: string;
  row_label: string;
  seat_number: number;
  category: string;
  price: number;
}

interface AppBooking {
  id: string;
  user_id: string;
  tmdb_movie_id: string;
  movie_title: string;
  movie_poster_url: string | null;
  theater_name: string;
  theater_location: string | null;
  screen_name: string;
  show_date: string;
  show_time: string;
  seats: SeatData[];
  total_amount: number;
  booking_reference: string;
  status: string;
  cancelled_at: string | null;
  refund_amount: number | null;
  created_at: string;
  updated_at: string;
}

export default function MyBookings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<AppBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user]);

  const fetchBookings = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('app_bookings')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (data && !error) {
      // Parse seats from JSON
      const parsedBookings = data.map(booking => ({
        ...booking,
        seats: (typeof booking.seats === 'string' ? JSON.parse(booking.seats) : booking.seats) as SeatData[],
      }));
      setBookings(parsedBookings as AppBooking[]);
    }

    setLoading(false);
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!user) return;

    setCancelling(bookingId);

    try {
      const { data, error } = await supabase.rpc('cancel_app_booking', {
        _booking_id: bookingId,
        _user_id: user.id,
      });

      if (error) {
        toast({
          title: 'Cancellation failed',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      const result = data as { success: boolean; message: string; refund_amount: number }[];
      
      if (result && result[0]) {
        if (result[0].success) {
          toast({
            title: 'Booking cancelled',
            description: result[0].refund_amount > 0 
              ? `Refund of $${result[0].refund_amount.toFixed(2)} will be processed`
              : result[0].message,
          });
          fetchBookings();
        } else {
          toast({
            title: 'Cancellation failed',
            description: result[0].message,
            variant: 'destructive',
          });
        }
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setCancelling(null);
    }
  };

  const getRefundInfo = (booking: AppBooking) => {
    const showDateTime = new Date(`${booking.show_date}T${booking.show_time}`);
    const now = new Date();
    const hoursUntilShow = differenceInHours(showDateTime, now);

    if (hoursUntilShow > 24) {
      return { eligible: true, percentage: 100, message: 'Full refund available' };
    } else if (hoursUntilShow > 0) {
      return { eligible: true, percentage: 50, message: '50% refund (less than 24 hours)' };
    } else {
      return { eligible: false, percentage: 0, message: 'Show has already started' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-500/20 text-green-500 border-green-500/30';
      case 'pending':
        return 'bg-accent/20 text-accent border-accent/30';
      case 'cancelled':
        return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'refunded':
        return 'bg-muted text-muted-foreground border-muted';
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
            {bookings.map((booking) => {
              const refundInfo = getRefundInfo(booking);
              const canCancel = booking.status === 'confirmed' && refundInfo.eligible;
              const seats = Array.isArray(booking.seats) ? booking.seats : [];

              return (
                <Card key={booking.id} className="bg-card/80 hover:border-primary/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Poster */}
                      {booking.movie_poster_url && (
                        <img
                          src={booking.movie_poster_url}
                          alt={booking.movie_title}
                          className="w-20 h-28 rounded-lg object-cover hidden md:block"
                        />
                      )}

                      {/* Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-display text-xl tracking-wide">
                              {booking.movie_title}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {booking.booking_reference}
                            </p>
                          </div>
                          <Badge variant="outline" className={getStatusColor(booking.status)}>
                            {booking.status === 'cancelled' && booking.refund_amount && booking.refund_amount > 0 
                              ? `Refunded $${booking.refund_amount.toFixed(2)}`
                              : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(parseISO(booking.show_date), 'MMM d, yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {format(parseISO(`2000-01-01T${booking.show_time}`), 'h:mm a')}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {booking.theater_name}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex gap-1 flex-wrap">
                            {seats.slice(0, 5).map((seat) => (
                              <span
                                key={seat.id}
                                className="px-2 py-0.5 bg-secondary text-xs rounded"
                              >
                                {seat.row_label}{seat.seat_number}
                              </span>
                            ))}
                            {seats.length > 5 && (
                              <span className="px-2 py-0.5 bg-secondary text-xs rounded">
                                +{seats.length - 5}
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-accent">
                            ${booking.total_amount.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {canCancel && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                disabled={cancelling === booking.id}
                              >
                                {cancelling === booking.id ? (
                                  <RefreshCcw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <XCircle className="h-4 w-4" />
                                )}
                                <span className="ml-2 hidden sm:inline">Cancel</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
                                <AlertDialogDescription className="space-y-2">
                                  <p>Are you sure you want to cancel this booking?</p>
                                  <div className="bg-secondary/50 p-3 rounded-lg mt-2">
                                    <p className="font-medium text-foreground">{refundInfo.message}</p>
                                    {refundInfo.percentage > 0 && (
                                      <p className="text-sm mt-1">
                                        Refund amount: ${(booking.total_amount * refundInfo.percentage / 100).toFixed(2)}
                                      </p>
                                    )}
                                  </div>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleCancelBooking(booking.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Cancel Booking
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/booking/confirmation/${booking.id}`}>
                            <ChevronRight className="h-5 w-5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}