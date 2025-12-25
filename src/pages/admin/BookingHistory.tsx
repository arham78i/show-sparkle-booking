import { useState, useEffect, useMemo } from 'react';
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
  ArrowLeft,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Eye,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Film,
  Armchair,
} from 'lucide-react';
import { format, parseISO, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { formatPrice } from '@/lib/currency';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

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
  avgTicketPrice: number;
  totalSeats: number;
}

export default function AdminBookingHistory() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([fetchBookings(), fetchStats()]);
    setRefreshing(false);
  };

  const fetchBookings = async () => {
    const { data: bookingsData, error } = await supabase
      .from('app_bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bookings:', error);
      return;
    }

    const userIds = [...new Set(bookingsData?.map(b => b.user_id) || [])];
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, phone')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

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
    const { data: customersData } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' });

    const { data: allBookings } = await supabase
      .from('app_bookings')
      .select('id, total_amount, status, refund_amount, seats');

    const totalBookings = allBookings?.length || 0;
    const totalRevenue = allBookings?.reduce((sum, b) => sum + b.total_amount, 0) || 0;
    const confirmedBookings = allBookings?.filter(b => b.status === 'confirmed').length || 0;
    const cancelledBookings = allBookings?.filter(b => b.status === 'cancelled').length || 0;
    const refundedAmount = allBookings?.reduce((sum, b) => sum + (b.refund_amount || 0), 0) || 0;
    const totalSeats = allBookings?.reduce((sum, b) => {
      const seats = Array.isArray(b.seats) ? b.seats : [];
      return sum + seats.length;
    }, 0) || 0;

    setStats({
      totalCustomers: customersData?.length || 0,
      totalBookings,
      totalRevenue,
      confirmedBookings,
      cancelledBookings,
      refundedAmount,
      avgTicketPrice: totalBookings > 0 ? totalRevenue / totalBookings : 0,
      totalSeats,
    });
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      const matchesSearch = 
        booking.booking_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.movie_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.customer_email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
      
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const bookingDate = parseISO(booking.created_at);
        const today = new Date();
        switch (dateFilter) {
          case 'today':
            matchesDate = isWithinInterval(bookingDate, {
              start: startOfDay(today),
              end: endOfDay(today),
            });
            break;
          case 'week':
            matchesDate = isWithinInterval(bookingDate, {
              start: subDays(today, 7),
              end: today,
            });
            break;
          case 'month':
            matchesDate = isWithinInterval(bookingDate, {
              start: subDays(today, 30),
              end: today,
            });
            break;
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [bookings, searchTerm, statusFilter, dateFilter]);

  // Chart data
  const revenueChartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return {
        date: format(date, 'MMM d'),
        revenue: 0,
        bookings: 0,
      };
    });

    bookings.forEach(booking => {
      const bookingDate = format(parseISO(booking.created_at), 'MMM d');
      const dayData = last7Days.find(d => d.date === bookingDate);
      if (dayData && booking.status === 'confirmed') {
        dayData.revenue += booking.total_amount;
        dayData.bookings += 1;
      }
    });

    return last7Days;
  }, [bookings]);

  const statusChartData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Confirmed', value: stats.confirmedBookings, color: 'hsl(142, 76%, 36%)' },
      { name: 'Cancelled', value: stats.cancelledBookings, color: 'hsl(0, 84%, 60%)' },
      { name: 'Pending', value: stats.totalBookings - stats.confirmedBookings - stats.cancelledBookings, color: 'hsl(45, 93%, 58%)' },
    ].filter(d => d.value > 0);
  }, [stats]);

  const movieChartData = useMemo(() => {
    const movieCounts: Record<string, number> = {};
    bookings.forEach(b => {
      if (b.status === 'confirmed') {
        movieCounts[b.movie_title] = (movieCounts[b.movie_title] || 0) + 1;
      }
    });
    return Object.entries(movieCounts)
      .map(([name, value]) => ({ name: name.length > 15 ? name.slice(0, 15) + '...' : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [bookings]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'cancelled':
        return 'text-red-400 border-red-500/30 bg-red-500/10';
      case 'pending':
        return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      default:
        return null;
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link to="/admin">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="font-display text-3xl md:text-5xl tracking-wider bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                BOOKING ANALYTICS
              </h1>
              <p className="text-muted-foreground text-sm">Comprehensive booking insights and customer data</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={refreshData}
            disabled={refreshing}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Quick Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/20 to-blue-600/5">
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -mr-10 -mt-10" />
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Customers</p>
                    <p className="text-3xl font-bold mt-1">{stats.totalCustomers}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-500/20 to-green-600/5">
              <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -mr-10 -mt-10" />
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Revenue</p>
                    <p className="text-3xl font-bold mt-1">{formatPrice(stats.totalRevenue)}</p>
                    <p className="text-xs text-green-400 flex items-center mt-1">
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                      Net of refunds
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/20 to-purple-600/5">
              <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full -mr-10 -mt-10" />
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Bookings</p>
                    <p className="text-3xl font-bold mt-1">{stats.totalBookings}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.totalSeats} seats sold
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Ticket className="h-5 w-5 text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-accent/20 to-accent/5">
              <div className="absolute top-0 right-0 w-20 h-20 bg-accent/10 rounded-full -mr-10 -mt-10" />
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg. Ticket</p>
                    <p className="text-3xl font-bold mt-1">{formatPrice(stats.avgTicketPrice)}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Status Cards */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                  <div>
                    <p className="text-2xl font-bold">{stats.confirmedBookings}</p>
                    <p className="text-xs text-muted-foreground">Confirmed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <XCircle className="h-8 w-8 text-red-400" />
                  <div>
                    <p className="text-2xl font-bold">{stats.cancelledBookings}</p>
                    <p className="text-xs text-muted-foreground">Cancelled</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-500/20 bg-orange-500/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <ArrowDownRight className="h-8 w-8 text-orange-400" />
                  <div>
                    <p className="text-2xl font-bold">{formatPrice(stats.refundedAmount)}</p>
                    <p className="text-xs text-muted-foreground">Refunded</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Revenue Chart */}
          <Card className="lg:col-span-2 border-0 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Revenue (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(value) => `${value / 1000}k`}
                    />
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border rounded-lg p-3 shadow-lg">
                              <p className="text-sm font-medium">{payload[0].payload.date}</p>
                              <p className="text-sm text-primary">{formatPrice(payload[0].value as number)}</p>
                              <p className="text-xs text-muted-foreground">{payload[0].payload.bookings} bookings</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fill="url(#colorRevenue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Status Pie Chart */}
          <Card className="border-0 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Ticket className="h-5 w-5 text-purple-400" />
                Booking Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] flex items-center justify-center">
                {statusChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-popover border rounded-lg p-2 shadow-lg">
                                <p className="text-sm">{payload[0].name}: {payload[0].value}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-sm">No data</p>
                )}
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {statusChartData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Movies Chart */}
        {movieChartData.length > 0 && (
          <Card className="border-0 bg-card/50 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Film className="h-5 w-5 text-accent" />
                Top Movies by Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={movieChartData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false}
                      width={120}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border rounded-lg p-2 shadow-lg">
                              <p className="text-sm">{payload[0].value} bookings</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search and Filters */}
        <Card className="bg-card/50 border-0 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by booking reference, movie, customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background/50"
                />
              </div>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full md:w-[150px] bg-background/50">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[150px] bg-background/50">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
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
        <Card className="bg-card/50 border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-display tracking-wide text-xl">All Bookings</CardTitle>
                <CardDescription>
                  Showing {filteredBookings.length} of {bookings.length} bookings
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredBookings.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs uppercase tracking-wide">Reference</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Customer</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Movie</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Theater</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Show</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Seats</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Amount</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => (
                      <TableRow 
                        key={booking.id} 
                        className="group hover:bg-secondary/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <TableCell className="font-mono text-xs text-primary">
                          {booking.booking_reference}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                              {booking.customer_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {booking.customer_name || 'N/A'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {booking.customer_email || 'No email'}
                              </p>
                            </div>
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
                            <span className="text-sm font-medium line-clamp-1">{booking.movie_title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{booking.theater_name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Armchair className="h-3 w-3" />
                              {booking.screen_name}
                            </p>
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
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {booking.seats.length} seats
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-accent">{formatPrice(booking.total_amount)}</p>
                            {booking.refund_amount && booking.refund_amount > 0 && (
                              <p className="text-xs text-orange-400">
                                -{formatPrice(booking.refund_amount)}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(booking.status)}
                            <Badge variant="outline" className={`text-xs ${getStatusColor(booking.status)}`}>
                              {booking.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBooking(booking);
                            }}
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
              <div className="text-center py-16">
                <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                  <Ticket className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No bookings found</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your search or filters</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booking Details Dialog */}
        <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display tracking-wide text-2xl flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Ticket className="h-5 w-5 text-primary" />
                </div>
                Booking Details
              </DialogTitle>
            </DialogHeader>
            
            {selectedBooking && (
              <div className="space-y-6">
                {/* Status Banner */}
                <div className={`p-4 rounded-lg flex items-center justify-between ${
                  selectedBooking.status === 'confirmed' ? 'bg-green-500/10 border border-green-500/20' :
                  selectedBooking.status === 'cancelled' ? 'bg-red-500/10 border border-red-500/20' :
                  'bg-yellow-500/10 border border-yellow-500/20'
                }`}>
                  <div className="flex items-center gap-3">
                    {getStatusIcon(selectedBooking.status)}
                    <div>
                      <p className="font-medium capitalize">{selectedBooking.status}</p>
                      <p className="text-xs text-muted-foreground">
                        Booked on {format(parseISO(selectedBooking.created_at), 'MMMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                  <p className="font-mono text-sm">{selectedBooking.booking_reference}</p>
                </div>

                {/* Movie Info */}
                <div className="flex items-start gap-4 p-4 bg-secondary/20 rounded-lg">
                  {selectedBooking.movie_poster_url && (
                    <img
                      src={selectedBooking.movie_poster_url}
                      alt={selectedBooking.movie_title}
                      className="w-24 h-36 rounded-lg object-cover shadow-lg"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-display text-2xl">{selectedBooking.movie_title}</p>
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {selectedBooking.theater_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Armchair className="h-4 w-4" />
                        {selectedBooking.screen_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="h-4 w-4 text-primary" />
                        {format(parseISO(selectedBooking.show_date), 'EEEE, MMMM d, yyyy')}
                      </span>
                      <span className="font-medium text-accent">
                        {format(parseISO(`2000-01-01T${selectedBooking.show_time}`), 'h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="p-4 border rounded-lg">
                  <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-400" />
                    Customer Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="font-medium">{selectedBooking.customer_name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium text-sm">{selectedBooking.customer_email || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-medium">{selectedBooking.customer_phone || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seats Breakdown */}
                <div className="p-4 border rounded-lg">
                  <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <Armchair className="h-4 w-4 text-purple-400" />
                    Seats ({selectedBooking.seats.length})
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {selectedBooking.seats.map((seat, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-secondary/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded flex items-center justify-center text-xs font-bold ${
                            seat.category === 'vip' ? 'bg-accent/20 text-accent' :
                            seat.category === 'premium' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-secondary text-foreground'
                          }`}>
                            {seat.row}{seat.number}
                          </div>
                          <Badge variant="outline" className="text-xs capitalize">
                            {seat.category}
                          </Badge>
                        </div>
                        <span className="font-medium text-accent">{formatPrice(seat.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="p-4 border rounded-lg bg-gradient-to-br from-accent/10 to-transparent">
                  <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-accent" />
                    Payment Summary
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal ({selectedBooking.seats.length} seats)</span>
                      <span>{formatPrice(selectedBooking.total_amount)}</span>
                    </div>
                    {selectedBooking.refund_amount && selectedBooking.refund_amount > 0 && (
                      <div className="flex justify-between text-sm text-orange-400">
                        <span>Refund Amount</span>
                        <span>-{formatPrice(selectedBooking.refund_amount)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 mt-2 flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span className="text-accent">{formatPrice(selectedBooking.total_amount - (selectedBooking.refund_amount || 0))}</span>
                    </div>
                  </div>
                </div>

                {selectedBooking.cancelled_at && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400">
                      Cancelled on {format(parseISO(selectedBooking.cancelled_at), 'MMMM d, yyyy h:mm a')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
