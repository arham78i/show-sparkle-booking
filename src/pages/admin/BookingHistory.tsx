import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  Ticket,
  DollarSign,
  TrendingUp,
  Search,
  Filter,
  Download,
  ArrowLeft,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Eye,
} from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { formatPrice } from '@/lib/currency';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SeatData {
  row: string;
  number: number;
  category: string;
  price: number;
}

interface BookingRecord {
  id: string;
  booking_reference: string;
  user_id: string;
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
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
}

interface CustomerStats {
  totalCustomers: number;
  totalBookings: number;
  totalRevenue: number;
  confirmedBookings: number;
  cancelledBookings: number;
  refundedAmount: number;
}

export default function AdminBookingHistory() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);

  useEffect(() => {
    if (user) {
      checkAdminRole();
    } else {
      setLoading(false);
    }
  }, [user]);

  const checkAdminRole = async () => {
    const { data } = await supabase.rpc('has_role', {
      _user_id: user!.id,
      _role: 'admin',
    });
    
    setIsAdmin(!!data);
    
    if (data) {
      await Promise.all([
        fetchBookings(),
        fetchStats(),
      ]);
    }
    
    setLoading(false);
  };

  const fetchBookings = async () => {
    // Fetch all app_bookings with customer profile info
    const { data: bookingsData, error } = await supabase
      .from('app_bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bookings:', error);
      return;
    }

    // Get unique user IDs
    const userIds = [...new Set(bookingsData?.map(b => b.user_id) || [])];
    
    // Fetch profiles for these users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, phone')
      .in('user_id', userIds);

    // Create a map for quick lookup
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // Combine bookings with customer info
    const enrichedBookings: BookingRecord[] = (bookingsData || []).map(booking => {
      const profile = profileMap.get(booking.user_id);
      const seats = Array.isArray(booking.seats) 
        ? booking.seats as unknown as SeatData[]
        : [];
      
      return {
        id: booking.id,
        booking_reference: booking.booking_reference,
        user_id: booking.user_id,
        movie_title: booking.movie_title,
        movie_poster_url: booking.movie_poster_url,
        theater_name: booking.theater_name,
        theater_location: booking.theater_location,
        screen_name: booking.screen_name,
        show_date: booking.show_date,
        show_time: booking.show_time,
        seats,
        total_amount: booking.total_amount,
        status: booking.status,
        created_at: booking.created_at,
        cancelled_at: booking.cancelled_at,
        refund_amount: booking.refund_amount,
        customer_name: profile?.full_name || null,
        customer_email: profile?.email || null,
        customer_phone: profile?.phone || null,
      };
    });

    setBookings(enrichedBookings);
  };

  const fetchStats = async () => {
    // Get total unique customers
    const { data: customersData } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' });

    // Get booking stats
    const { data: allBookings } = await supabase
      .from('app_bookings')
      .select('id, total_amount, status, refund_amount');

    const totalBookings = allBookings?.length || 0;
    const totalRevenue = allBookings?.reduce((sum, b) => sum + b.total_amount, 0) || 0;
    const confirmedBookings = allBookings?.filter(b => b.status === 'confirmed').length || 0;
    const cancelledBookings = allBookings?.filter(b => b.status === 'cancelled').length || 0;
    const refundedAmount = allBookings?.reduce((sum, b) => sum + (b.refund_amount || 0), 0) || 0;

    setStats({
      totalCustomers: customersData?.length || 0,
      totalBookings,
      totalRevenue,
      confirmedBookings,
      cancelledBookings,
      refundedAmount,
    });
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.booking_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.movie_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.customer_email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'text-green-500 border-green-500/30 bg-green-500/10';
      case 'cancelled':
        return 'text-red-500 border-red-500/30 bg-red-500/10';
      case 'pending':
        return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10';
      default:
        return 'text-muted-foreground';
    }
  };

  const formatSeats = (seats: SeatData[]) => {
    return seats.map(s => `${s.row}${s.number}`).join(', ');
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-4xl mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access this page.
          </p>
          <Button asChild>
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-4xl md:text-5xl tracking-wider">BOOKING HISTORY</h1>
            <p className="text-muted-foreground">View all customer bookings and statistics</p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Card className="bg-card/80">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Customers</p>
                    <p className="text-xl font-bold">{stats.totalCustomers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Ticket className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Bookings</p>
                    <p className="text-xl font-bold">{stats.totalBookings}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-xl font-bold">{formatPrice(stats.totalRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Confirmed</p>
                    <p className="text-xl font-bold">{stats.confirmedBookings}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Ticket className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cancelled</p>
                    <p className="text-xl font-bold">{stats.cancelledBookings}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Refunded</p>
                    <p className="text-xl font-bold">{formatPrice(stats.refundedAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <Card className="bg-card/80 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by booking reference, movie, customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bookings Table */}
        <Card className="bg-card/80">
          <CardHeader>
            <CardTitle className="font-display tracking-wide">All Bookings</CardTitle>
            <CardDescription>
              Showing {filteredBookings.length} of {bookings.length} bookings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredBookings.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking Ref</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Movie</TableHead>
                      <TableHead>Theater</TableHead>
                      <TableHead>Show</TableHead>
                      <TableHead>Seats</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-mono text-sm">
                          {booking.booking_reference}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {booking.customer_name || 'N/A'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {booking.customer_email || 'No email'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {booking.movie_poster_url && (
                              <img
                                src={booking.movie_poster_url}
                                alt={booking.movie_title}
                                className="w-8 h-12 rounded object-cover"
                              />
                            )}
                            <span className="text-sm">{booking.movie_title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{booking.theater_name}</p>
                            <p className="text-xs text-muted-foreground">{booking.screen_name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{format(parseISO(booking.show_date), 'MMM d, yyyy')}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(`2000-01-01T${booking.show_time}`), 'h:mm a')}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{formatSeats(booking.seats)}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-accent">{formatPrice(booking.total_amount)}</p>
                            {booking.refund_amount && booking.refund_amount > 0 && (
                              <p className="text-xs text-orange-500">
                                Refund: {formatPrice(booking.refund_amount)}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(booking.status)}>
                            {booking.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedBooking(booking)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No bookings found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booking Details Dialog */}
        <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display tracking-wide">
                Booking Details
              </DialogTitle>
            </DialogHeader>
            
            {selectedBooking && (
              <div className="space-y-6">
                {/* Booking Info */}
                <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-lg">
                  {selectedBooking.movie_poster_url && (
                    <img
                      src={selectedBooking.movie_poster_url}
                      alt={selectedBooking.movie_title}
                      className="w-16 h-24 rounded object-cover"
                    />
                  )}
                  <div>
                    <p className="font-display text-lg">{selectedBooking.movie_title}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedBooking.theater_name} • {selectedBooking.screen_name}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(selectedBooking.show_date), 'MMM d, yyyy')}
                      </span>
                      <span>
                        {format(parseISO(`2000-01-01T${selectedBooking.show_time}`), 'h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Customer Details</h4>
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {selectedBooking.customer_name || 'N/A'}
                    </p>
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {selectedBooking.customer_email || 'No email'}
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {selectedBooking.customer_phone || 'No phone'}
                    </p>
                  </div>
                </div>

                {/* Booking Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Booking Reference</p>
                    <p className="font-mono">{selectedBooking.booking_reference}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant="outline" className={getStatusColor(selectedBooking.status)}>
                      {selectedBooking.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Seats</p>
                    <p>{formatSeats(selectedBooking.seats)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Amount</p>
                    <p className="font-medium text-accent">{formatPrice(selectedBooking.total_amount)}</p>
                  </div>
                  {selectedBooking.refund_amount && selectedBooking.refund_amount > 0 && (
                    <>
                      <div>
                        <p className="text-muted-foreground">Refund Amount</p>
                        <p className="text-orange-500">{formatPrice(selectedBooking.refund_amount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cancelled At</p>
                        <p>{selectedBooking.cancelled_at ? format(parseISO(selectedBooking.cancelled_at), 'MMM d, yyyy h:mm a') : 'N/A'}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Seats Breakdown */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Seats Breakdown</h4>
                  <div className="space-y-2">
                    {selectedBooking.seats.map((seat, idx) => (
                      <div key={idx} className="flex justify-between text-sm p-2 bg-secondary/20 rounded">
                        <span>Seat {seat.row}{seat.number} ({seat.category})</span>
                        <span className="text-accent">{formatPrice(seat.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Booked on {format(parseISO(selectedBooking.created_at), 'MMMM d, yyyy h:mm a')}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
