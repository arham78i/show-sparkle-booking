import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMovieDetails, useSimilarMovies } from '@/hooks/useSupabaseMovies';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Star, Calendar, Play, MapPin, ChevronRight } from 'lucide-react';
import { format, parseISO, addDays, isToday, isTomorrow } from 'date-fns';
import { formatPrice } from '@/lib/currency';
import { MovieCard } from '@/components/movies/MovieCard';

interface ShowWithDetails {
  id: string;
  movie_id: string;
  screen_id: string;
  show_date: string;
  show_time: string;
  base_price: number;
  is_active: boolean;
  screen: {
    id: string;
    name: string;
    theater_id: string;
    theater: {
      id: string;
      name: string;
      location: string;
      city: string;
    };
  };
}

export default function MovieDetails() {
  const { id } = useParams<{ id: string }>();
  const { movie, loading } = useMovieDetails(id);
  const { movies: similarMovies, loading: similarLoading } = useSimilarMovies(id);
  const [shows, setShows] = useState<ShowWithDetails[]>([]);
  const [showsLoading, setShowsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      date: format(date, 'yyyy-MM-dd'),
      label: isToday(date) ? 'Today' : isTomorrow(date) ? 'Tomorrow' : format(date, 'EEE'),
      day: format(date, 'd'),
      month: format(date, 'MMM'),
    };
  });

  // Fetch shows from database
  useEffect(() => {
    async function fetchShows() {
      if (!movie?.id) return;
      
      setShowsLoading(true);
      try {
        const { data, error } = await supabase
          .from('shows')
          .select(`
            id,
            movie_id,
            screen_id,
            show_date,
            show_time,
            base_price,
            is_active,
            screen:screens (
              id,
              name,
              theater_id,
              theater:theaters (
                id,
                name,
                location,
                city
              )
            )
          `)
          .eq('movie_id', movie.id)
          .eq('show_date', selectedDate)
          .eq('is_active', true)
          .order('show_time');

        if (error) {
          console.error('Error fetching shows:', error);
          return;
        }

        // Transform the data to match our interface
        const transformedShows = (data || []).map((show: any) => ({
          ...show,
          screen: {
            ...show.screen,
            theater: show.screen?.theater || { id: '', name: 'Unknown', location: '', city: '' }
          }
        })) as ShowWithDetails[];

        setShows(transformedShows);
      } catch (err) {
        console.error('Failed to fetch shows:', err);
      } finally {
        setShowsLoading(false);
      }
    }

    fetchShows();
  }, [movie?.id, selectedDate]);

  // Group shows by theater
  const showsByTheater = shows.reduce((acc, show) => {
    const theaterId = show.screen?.theater?.id || 'unknown';
    if (!acc[theaterId]) {
      acc[theaterId] = {
        theater: show.screen?.theater || { id: 'unknown', name: 'Unknown Theater', location: '', city: '' },
        shows: [],
      };
    }
    acc[theaterId].shows.push(show);
    return acc;
  }, {} as Record<string, { theater: { id: string; name: string; location: string; city: string }; shows: ShowWithDetails[] }>);

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-3 gap-8">
            <Skeleton className="aspect-[2/3] rounded-xl" />
            <div className="md:col-span-2 space-y-4">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!movie) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-4xl mb-4">Movie Not Found</h1>
          <Button asChild>
            <Link to="/movies">Browse Movies</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative py-12 md:py-20">
        <div className="absolute inset-0 cinema-gradient">
          {movie.backdrop_url && (
            <div 
              className="absolute inset-0 opacity-20 bg-cover bg-center blur-sm"
              style={{ backgroundImage: `url(${movie.backdrop_url})` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Poster */}
            <div className="mx-auto md:mx-0">
              {movie.poster_url ? (
                <img
                  src={movie.poster_url}
                  alt={movie.title}
                  className="w-64 md:w-full max-w-xs rounded-xl shadow-2xl"
                />
              ) : (
                <div className="w-64 md:w-full max-w-xs aspect-[2/3] rounded-xl bg-secondary flex items-center justify-center">
                  <Play className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="md:col-span-2 space-y-6">
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {movie.genre.map((g) => (
                    <Badge key={g} variant="secondary">{g}</Badge>
                  ))}
                </div>
                <h1 className="font-display text-4xl md:text-6xl tracking-wider mb-4">
                  {movie.title}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-muted-foreground">
                {movie.rating && movie.rating > 0 && (
                  <span className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-accent text-accent" />
                    <span className="text-xl font-semibold text-foreground">{movie.rating.toFixed(1)}</span>
                    <span>/10</span>
                  </span>
                )}
                <span className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {movie.duration_minutes} minutes
                </span>
                {movie.release_date && (
                  <span className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {format(parseISO(movie.release_date), 'MMMM d, yyyy')}
                  </span>
                )}
                <Badge variant="outline">{movie.language}</Badge>
              </div>

              <p className="text-lg text-muted-foreground leading-relaxed">
                {movie.description}
              </p>

              {movie.trailer_url && (
                <Button size="lg" variant="outline" asChild>
                  <a href={movie.trailer_url} target="_blank" rel="noopener noreferrer">
                    <Play className="mr-2 h-5 w-5" />
                    Watch Trailer
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Showtimes Section */}
      {movie.status === 'now_showing' && (
        <section className="py-12 bg-card/50">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl tracking-wider mb-6">SELECT DATE & TIME</h2>

            {/* Date Picker */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-8">
              {dates.map(({ date, label, day, month }) => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`flex-shrink-0 px-4 py-3 rounded-lg border text-center transition-all min-w-[80px] ${
                    selectedDate === date
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary/50 border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-xs text-muted-foreground mb-1">{label}</div>
                  <div className="text-xl font-semibold">{day}</div>
                  <div className="text-xs">{month}</div>
                </button>
              ))}
            </div>

            {/* Shows by Theater */}
            {showsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
              </div>
            ) : Object.keys(showsByTheater).length > 0 ? (
              <div className="space-y-6">
                {Object.values(showsByTheater).map(({ theater, shows }) => (
                  <Card key={theater.id} className="bg-card/80">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-display text-xl tracking-wide">{theater.name}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-4 w-4" />
                            {theater.location}, {theater.city}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-3">
                        {shows.map((show) => (
                          <Button
                            key={show.id}
                            variant="outline"
                            asChild
                            className="hover:bg-primary hover:text-primary-foreground group"
                          >
                            <Link to={`/booking/${show.id}`}>
                              <span>{format(parseISO(`2000-01-01T${show.show_time}`), 'h:mm a')}</span>
                              <span className="ml-2 text-xs text-accent group-hover:text-primary-foreground">
                                {formatPrice(show.base_price)}
                              </span>
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No shows available for this date</p>
              </div>
            )}
          </div>
        </section>
      )}

      {movie.status === 'coming_soon' && movie.release_date && (
        <section className="py-12 text-center">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl tracking-wider mb-4">COMING SOON</h2>
            <p className="text-muted-foreground mb-2">
              Releasing on {format(parseISO(movie.release_date), 'MMMM d, yyyy')}
            </p>
            <p className="text-muted-foreground mb-6">
              Tickets will be available for booking soon!
            </p>
            <Button asChild>
              <Link to="/movies">Browse Other Movies</Link>
            </Button>
          </div>
        </section>
      )}

      {/* Similar Movies Section */}
      {similarMovies.length > 0 && (
        <section className="py-12 bg-secondary/20">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-3xl tracking-wider mb-8">YOU MAY ALSO LIKE</h2>
            
            {similarLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[2/3] rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {similarMovies.map((similarMovie) => (
                  <MovieCard key={similarMovie.id} movie={similarMovie} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </Layout>
  );
}
