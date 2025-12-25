import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  Ticket, 
  Calendar, 
  MapPin, 
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Film,
  Armchair,
  User,
  CreditCard,
  Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatPrice } from '@/lib/currency';
import { toast } from 'sonner';

interface SeatData {
  row: string;
  number: number;
  category: string;
  price: number;
}

interface BookingData {
  id: string;
  booking_reference: string;
  movie_title: string;
  movie_poster_url: string | null;
  theater_name: string;
  theater_location: string | null;
  screen_name: string;
  show_date: string;
  show_time: string;
  seats: SeatData[];
  total_amount: number;
  status: string;
  created_at: string;
  cancelled_at: string | null;
  refund_amount: number | null;
  user_id: string;
  customer_name?: string | null;
}

export default function CheckBooking() {
  const [referenceNumber, setReferenceNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!referenceNumber.trim()) {
      toast.error('Please enter a booking reference number');
      return;
    }

    setLoading(true);
    setSearched(true);
    setBooking(null);

    try {
      // Use the database function to lookup booking by reference
      const { data: bookingData, error } = await supabase
        .rpc('lookup_booking_by_reference', {
          _booking_reference: referenceNumber.trim()
        });

      if (error) {
        console.error('Error fetching booking:', error);
        toast.error('Error searching for booking');
        setLoading(false);
        return;
      }

      if (!bookingData || bookingData.length === 0) {
        setBooking(null);
        setLoading(false);
        return;
      }

      const result = bookingData[0];
      const seats = Array.isArray(result.seats) 
        ? result.seats as unknown as SeatData[]
        : [];

      setBooking({
        id: result.id,
        booking_reference: result.booking_reference,
        movie_title: result.movie_title,
        movie_poster_url: result.movie_poster_url,
        theater_name: result.theater_name,
        theater_location: result.theater_location,
        screen_name: result.screen_name,
        show_date: result.show_date,
        show_time: result.show_time,
        seats,
        total_amount: result.total_amount,
        status: result.status,
        created_at: result.created_at,
        cancelled_at: result.cancelled_at,
        refund_amount: result.refund_amount,
        user_id: '',
        customer_name: result.customer_name,
      });
    } catch (err) {
      console.error('Error:', err);
      toast.error('Something went wrong');
    }

    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 className="h-6 w-6 text-green-400" />;
      case 'cancelled':
        return <XCircle className="h-6 w-6 text-red-400" />;
      case 'pending':
        return <Clock className="h-6 w-6 text-yellow-400" />;
      default:
        return <AlertCircle className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-500/10 border-green-500/20 text-green-400';
      case 'cancelled':
        return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'pending':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
      default:
        return 'bg-secondary text-muted-foreground';
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/20 mb-4">
            <Ticket className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl tracking-wider mb-2">
            CHECK YOUR BOOKING
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Enter your booking reference number to view your ticket details
          </p>
        </div>

        {/* Search Box */}
        <Card className="max-w-xl mx-auto bg-card/80 border-0 mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Enter booking reference (e.g., BK20241225-ABC123)"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 h-12 text-base font-mono uppercase tracking-wide"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={loading}
                className="h-12 px-8"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Find Booking
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && !loading && (
          <>
            {booking ? (
              <Card className="max-w-3xl mx-auto bg-card/80 border-0 overflow-hidden">
                {/* Status Banner */}
                <div className={`p-4 flex items-center justify-between ${getStatusColor(booking.status)}`}>
                  <div className="flex items-center gap-3">
                    {getStatusIcon(booking.status)}
                    <div>
                      <p className="font-semibold text-lg capitalize">{booking.status}</p>
                      <p className="text-sm opacity-80">
                        Booked on {format(parseISO(booking.created_at), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-70 uppercase tracking-wide">Reference</p>
                    <p className="font-mono font-bold">{booking.booking_reference}</p>
                  </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  {/* Movie Info */}
                  <div className="flex gap-4">
                    {booking.movie_poster_url && (
                      <img
                        src={booking.movie_poster_url}
                        alt={booking.movie_title}
                        className="w-28 h-40 rounded-lg object-cover shadow-lg"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start gap-2 mb-2">
                        <Film className="h-5 w-5 text-primary mt-1" />
                        <h2 className="font-display text-2xl md:text-3xl">{booking.movie_title}</h2>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {booking.theater_name}
                          {booking.theater_location && ` • ${booking.theater_location}`}
                        </p>
                        <p className="flex items-center gap-2">
                          <Armchair className="h-4 w-4" />
                          {booking.screen_name}
                        </p>
                        <div className="flex flex-wrap gap-4 pt-2">
                          <span className="flex items-center gap-2 font-medium text-foreground">
                            <Calendar className="h-4 w-4 text-primary" />
                            {format(parseISO(booking.show_date), 'EEEE, MMMM d, yyyy')}
                          </span>
                          <span className="flex items-center gap-2 font-medium text-accent">
                            <Clock className="h-4 w-4" />
                            {format(parseISO(`2000-01-01T${booking.show_time}`), 'h:mm a')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer Info */}
                  {booking.customer_name && (
                    <div className="p-4 bg-secondary/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Booked By</p>
                          <p className="font-medium text-lg">{booking.customer_name}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Seats */}
                  <div>
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Armchair className="h-4 w-4 text-purple-400" />
                      Your Seats ({booking.seats.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {booking.seats.map((seat, idx) => (
                        <div 
                          key={idx} 
                          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                            seat.category === 'vip' ? 'bg-accent/20 border border-accent/30' :
                            seat.category === 'premium' ? 'bg-purple-500/20 border border-purple-500/30' :
                            'bg-secondary/50 border border-border'
                          }`}
                        >
                          <span className="font-bold">{seat.row}{seat.number}</span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {seat.category}
                          </Badge>
                          <span className="text-sm text-accent font-medium">{formatPrice(seat.price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Summary */}
                  <div className="p-4 bg-gradient-to-br from-accent/10 to-transparent rounded-lg border border-accent/20">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="h-5 w-5 text-accent" />
                      <h3 className="font-medium">Payment Summary</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tickets ({booking.seats.length})</span>
                        <span>{formatPrice(booking.total_amount)}</span>
                      </div>
                      {booking.refund_amount && booking.refund_amount > 0 && (
                        <div className="flex justify-between text-sm text-orange-400">
                          <span>Refund</span>
                          <span>-{formatPrice(booking.refund_amount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold text-lg pt-2 border-t border-border">
                        <span>Total Paid</span>
                        <span className="text-accent">{formatPrice(booking.total_amount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cancellation Info */}
                  {booking.status === 'cancelled' && booking.cancelled_at && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-sm text-red-400 flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Cancelled on {format(parseISO(booking.cancelled_at), 'MMMM d, yyyy h:mm a')}
                      </p>
                      {booking.refund_amount && booking.refund_amount > 0 && (
                        <p className="text-sm text-orange-400 mt-1">
                          Refund of {formatPrice(booking.refund_amount)} has been processed
                        </p>
                      )}
                    </div>
                  )}

                  {/* Instructions */}
                  {booking.status === 'confirmed' && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <p className="text-sm text-green-400 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Show this booking reference at the theater to collect your tickets
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="max-w-xl mx-auto bg-card/80 border-0">
                <CardContent className="py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-display text-xl mb-2">No Booking Found</h3>
                  <p className="text-muted-foreground mb-4">
                    We couldn't find a booking with reference <span className="font-mono font-bold text-foreground">{referenceNumber}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Please check your booking reference and try again. The reference is case-insensitive.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Help Section */}
        <div className="max-w-xl mx-auto mt-12 text-center">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Where to find your booking reference?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-4 bg-card/50 rounded-lg">
              <Ticket className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-muted-foreground">Check your booking confirmation screen after payment</p>
            </div>
            <div className="p-4 bg-card/50 rounded-lg">
              <User className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-muted-foreground">View "My Bookings" section if you're logged in</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
