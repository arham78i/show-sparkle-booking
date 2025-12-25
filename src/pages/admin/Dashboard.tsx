import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Film,
  Calendar,
  Users,
  BarChart3,
  DollarSign,
  Ticket,
  TrendingUp,
  Clock,
  MapPin,
  ArrowUpRight,
} from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { formatPrice } from '@/lib/currency';

interface AnalyticsData {
  totalBookings: number;
  totalRevenue: number;
  todayBookings: number;
  todayRevenue: number;
  recentBookings: any[];
  topMovies: { title: string; bookings: number; revenue: number }[];
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [movies, setMovies] = useState<any[]>([]);
  const [theaters, setTheaters] = useState<any[]>([]);
  const [shows, setShows] = useState<any[]>([]);

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
        fetchAnalytics(),
        fetchMovies(),
        fetchTheaters(),
        fetchShows(),
      ]);
    }
    
    setLoading(false);
  };

  const fetchAnalytics = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

    // Fetch all bookings
    const { data: allBookings } = await supabase
      .from('bookings')
      .select('id, total_amount, created_at, status')
      .eq('status', 'confirmed');

    // Fetch today's bookings
    const { data: todayBookings } = await supabase
      .from('bookings')
      .select('id, total_amount')
      .eq('status', 'confirmed')
      .gte('created_at', `${today}T00:00:00`);

    // Fetch recent bookings with details
    const { data: recentBookings } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_reference,
        total_amount,
        status,
        created_at,
        show:shows(
          movie:movies(title),
          screen:screens(theater:theaters(name))
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate stats
    const totalBookings = allBookings?.length || 0;
    const totalRevenue = allBookings?.reduce((sum, b) => sum + b.total_amount, 0) || 0;
    const todayBookingsCount = todayBookings?.length || 0;
    const todayRevenueAmount = todayBookings?.reduce((sum, b) => sum + b.total_amount, 0) || 0;

    setAnalytics({
      totalBookings,
      totalRevenue,
      todayBookings: todayBookingsCount,
      todayRevenue: todayRevenueAmount,
      recentBookings: recentBookings || [],
      topMovies: [], // Would need aggregation query
    });
  };

  const fetchMovies = async () => {
    const { data } = await supabase
      .from('movies')
      .select('*')
      .order('created_at', { ascending: false });
    setMovies(data || []);
  };

  const fetchTheaters = async () => {
    const { data } = await supabase
      .from('theaters')
      .select('*, screens(count)')
      .order('name');
    setTheaters(data || []);
  };

  const fetchShows = async () => {
    const { data } = await supabase
      .from('shows')
      .select(`
        *,
        movie:movies(title, poster_url),
        screen:screens(name, theater:theaters(name))
      `)
      .gte('show_date', format(new Date(), 'yyyy-MM-dd'))
      .order('show_date')
      .order('show_time')
      .limit(50);
    setShows(data || []);
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
            You don't have permission to access the admin dashboard.
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
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl tracking-wider mb-2">ADMIN DASHBOARD</h1>
          <p className="text-muted-foreground">Manage movies, showtimes, and view analytics</p>
        </div>

        {/* Stats Cards */}
        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="bg-card/80">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold">{formatPrice(analytics.totalRevenue)}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Bookings</p>
                    <p className="text-2xl font-bold">{analytics.totalBookings}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Ticket className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today's Revenue</p>
                    <p className="text-2xl font-bold">{formatPrice(analytics.todayRevenue)}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today's Bookings</p>
                    <p className="text-2xl font-bold">{analytics.todayBookings}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-6">
          <Button asChild>
            <Link to="/admin/history" className="gap-2">
              <Ticket className="h-4 w-4" />
              View Booking History
            </Link>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full md:w-auto grid-cols-4 md:inline-flex">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden md:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="movies" className="gap-2">
              <Film className="h-4 w-4" />
              <span className="hidden md:inline">Movies</span>
            </TabsTrigger>
            <TabsTrigger value="shows" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden md:inline">Shows</span>
            </TabsTrigger>
            <TabsTrigger value="theaters" className="gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden md:inline">Theaters</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card className="bg-card/80">
              <CardHeader>
                <CardTitle className="font-display tracking-wide">Recent Bookings</CardTitle>
                <CardDescription>Latest booking activity</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics?.recentBookings && analytics.recentBookings.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.recentBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{booking.booking_reference}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.show?.movie?.title || 'N/A'} at{' '}
                            {booking.show?.screen?.theater?.name || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-accent">{formatPrice(booking.total_amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(booking.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No bookings yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Movies Tab */}
          <TabsContent value="movies" className="space-y-6">
            <Card className="bg-card/80">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-display tracking-wide">Movies</CardTitle>
                    <CardDescription>Manage movie catalog</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {movies.length > 0 ? (
                  <div className="grid gap-4">
                    {movies.map((movie) => (
                      <div
                        key={movie.id}
                        className="flex items-center gap-4 p-4 bg-secondary/30 rounded-lg"
                      >
                        {movie.poster_url && (
                          <img
                            src={movie.poster_url}
                            alt={movie.title}
                            className="w-12 h-16 rounded object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{movie.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {movie.duration_minutes} min • {movie.language}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            movie.status === 'now_showing'
                              ? 'text-green-500 border-green-500/30'
                              : movie.status === 'coming_soon'
                              ? 'text-accent border-accent/30'
                              : 'text-muted-foreground'
                          }
                        >
                          {movie.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No movies in database</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Shows Tab */}
          <TabsContent value="shows" className="space-y-6">
            <Card className="bg-card/80">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-display tracking-wide">Upcoming Shows</CardTitle>
                    <CardDescription>Manage showtimes</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {shows.length > 0 ? (
                  <div className="space-y-4">
                    {shows.map((show) => (
                      <div
                        key={show.id}
                        className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          {show.movie?.poster_url && (
                            <img
                              src={show.movie.poster_url}
                              alt={show.movie.title}
                              className="w-10 h-14 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium">{show.movie?.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {show.screen?.theater?.name} - {show.screen?.name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(show.show_date), 'MMM d')}
                          </p>
                          <p className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(parseISO(`2000-01-01T${show.show_time}`), 'h:mm a')}
                          </p>
                        </div>
                        <Badge variant="outline">{formatPrice(show.base_price)}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No upcoming shows</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Theaters Tab */}
          <TabsContent value="theaters" className="space-y-6">
            <Card className="bg-card/80">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-display tracking-wide">Theaters</CardTitle>
                    <CardDescription>Manage theater locations</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {theaters.length > 0 ? (
                  <div className="grid gap-4">
                    {theaters.map((theater) => (
                      <div
                        key={theater.id}
                        className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{theater.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {theater.location}, {theater.city}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{theater.phone || 'No phone'}</p>
                          <p className="text-xs text-muted-foreground">
                            {theater.screens?.[0]?.count || 0} screens
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No theaters configured</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
