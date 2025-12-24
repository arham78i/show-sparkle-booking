import { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Calendar, Clock, MapPin, Ticket, Home, Film, Star, DollarSign } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface BookingDetails {
  id: string;
  booking_reference: string;
  total_amount: number;
  status: string;
  created_at: string;
  movie: {
    title: string;
    poster_url: string | null;
    genre: string[];
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
  }>;
}

export default function BookingConfirmation() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const location = useLocation();
  const [booking, setBooking] = useState<BookingDetails | null>(null);

  useEffect(() => {
    // Get booking from location state (passed from Booking page)
    if (location.state?.booking) {
      setBooking(location.state.booking);
    }
  }, [location]);

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
                  {booking.movie.genre.slice(0, 3).join(' • ')} • {booking.movie.duration_minutes} min
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

            {/* Seats */}
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground mb-2">Seats ({booking.seats.length})</p>
              <div className="flex flex-wrap gap-2">
                {booking.seats
                  .sort((a, b) => 
                    a.row_label.localeCompare(b.row_label) || 
                    a.seat_number - b.seat_number
                  )
                  .map((seat) => (
                    <span
                      key={seat.id}
                      className="px-3 py-1 bg-accent/20 text-accent rounded-full text-sm font-medium"
                    >
                      {seat.row_label}{seat.seat_number}
                      <span className="text-xs ml-1 opacity-70 capitalize">({seat.category})</span>
                    </span>
                  ))}
              </div>
            </div>

            {/* Total */}
            <div className="border-t border-border pt-4 flex justify-between items-center">
              <span className="text-lg font-medium">Total Paid</span>
              <span className="font-display text-3xl text-accent flex items-center">
                <DollarSign className="h-6 w-6" />
                {booking.total_amount.toFixed(2)}
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
