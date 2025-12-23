import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { MovieGrid } from '@/components/movies/MovieGrid';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Movie } from '@/types/database';
import { Play, ChevronRight, Sparkles, Clock, Star } from 'lucide-react';

export default function Index() {
  const [nowShowing, setNowShowing] = useState<Movie[]>([]);
  const [comingSoon, setComingSoon] = useState<Movie[]>([]);
  const [featured, setFeatured] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    setLoading(true);
    
    // Fetch now showing movies
    const { data: showing } = await supabase
      .from('movies')
      .select('*')
      .eq('status', 'now_showing')
      .order('rating', { ascending: false })
      .limit(10);
    
    // Fetch coming soon movies
    const { data: coming } = await supabase
      .from('movies')
      .select('*')
      .eq('status', 'coming_soon')
      .order('release_date', { ascending: true })
      .limit(5);

    if (showing && showing.length > 0) {
      setFeatured(showing[0] as Movie);
      setNowShowing(showing as Movie[]);
    }
    
    if (coming) {
      setComingSoon(coming as Movie[]);
    }
    
    setLoading(false);
  };

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center">
        {/* Background */}
        <div className="absolute inset-0 cinema-gradient">
          {featured?.poster_url && (
            <div 
              className="absolute inset-0 opacity-20 bg-cover bg-center"
              style={{ backgroundImage: `url(${featured.poster_url})` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl space-y-6 animate-fade-in">
            <div className="flex items-center gap-2 text-accent">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-medium tracking-wider uppercase">Featured Movie</span>
            </div>
            
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-none tracking-wider">
              {featured?.title || 'THE MAGIC OF CINEMA'}
            </h1>
            
            {featured ? (
              <>
                <div className="flex items-center gap-4 text-muted-foreground">
                  {featured.rating && (
                    <span className="flex items-center gap-1">
                      <Star className="h-5 w-5 fill-accent text-accent" />
                      <span className="font-semibold text-foreground">{featured.rating.toFixed(1)}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-5 w-5" />
                    {featured.duration_minutes} min
                  </span>
                  <span>{featured.genre.join(' • ')}</span>
                </div>
                
                <p className="text-lg text-muted-foreground line-clamp-3">
                  {featured.description}
                </p>
                
                <div className="flex items-center gap-4 pt-4">
                  <Button size="lg" asChild className="cinema-glow">
                    <Link to={`/movies/${featured.id}`}>
                      <Play className="mr-2 h-5 w-5" />
                      Book Tickets
                    </Link>
                  </Button>
                  {featured.trailer_url && (
                    <Button size="lg" variant="outline" asChild>
                      <a href={featured.trailer_url} target="_blank" rel="noopener noreferrer">
                        Watch Trailer
                      </a>
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-lg text-muted-foreground">
                  Experience the latest blockbusters on the big screen. 
                  Book your seats now and enjoy an unforgettable cinema experience.
                </p>
                <Button size="lg" asChild className="cinema-glow">
                  <Link to="/movies">
                    Browse Movies
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Now Showing Section */}
      <section className="py-16 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-display text-3xl md:text-4xl tracking-wider">NOW SHOWING</h2>
              <p className="text-muted-foreground mt-1">Currently in theaters</p>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/movies?status=now_showing">
                View All <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <MovieGrid movies={nowShowing} loading={loading} />
        </div>
      </section>

      {/* Coming Soon Section */}
      {comingSoon.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-display text-3xl md:text-4xl tracking-wider">COMING SOON</h2>
                <p className="text-muted-foreground mt-1">Upcoming releases</p>
              </div>
              <Button variant="ghost" asChild>
                <Link to="/movies?status=coming_soon">
                  View All <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <MovieGrid movies={comingSoon} loading={loading} />
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="font-display text-4xl md:text-5xl tracking-wider mb-4">
            READY FOR THE SHOW?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            Don't miss out on the latest blockbusters. Book your tickets now and 
            get the best seats in the house.
          </p>
          <Button size="lg" asChild className="cinema-glow">
            <Link to="/movies">
              Explore Movies
              <ChevronRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
