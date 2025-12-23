import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { MovieGrid } from '@/components/movies/MovieGrid';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Movie, MovieStatus } from '@/types/database';
import { Search, X } from 'lucide-react';

const genres = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller', 'Animation'];

export default function Movies() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<MovieStatus | null>(
    (searchParams.get('status') as MovieStatus) || null
  );

  useEffect(() => {
    fetchMovies();
  }, [selectedGenres, selectedStatus]);

  const fetchMovies = async () => {
    setLoading(true);
    
    let query = supabase
      .from('movies')
      .select('*')
      .order('release_date', { ascending: false });

    if (selectedStatus) {
      query = query.eq('status', selectedStatus);
    }

    const { data, error } = await query;
    
    if (data && !error) {
      let filtered = data as Movie[];
      
      // Filter by search
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(m => 
          m.title.toLowerCase().includes(searchLower) ||
          m.description?.toLowerCase().includes(searchLower)
        );
      }
      
      // Filter by genres
      if (selectedGenres.length > 0) {
        filtered = filtered.filter(m => 
          m.genre.some(g => selectedGenres.includes(g))
        );
      }
      
      setMovies(filtered);
    }
    
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMovies();
    if (search) {
      searchParams.set('search', search);
    } else {
      searchParams.delete('search');
    }
    setSearchParams(searchParams);
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const setStatus = (status: MovieStatus | null) => {
    setSelectedStatus(status);
    if (status) {
      searchParams.set('status', status);
    } else {
      searchParams.delete('status');
    }
    setSearchParams(searchParams);
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedGenres([]);
    setSelectedStatus(null);
    setSearchParams({});
  };

  const hasFilters = search || selectedGenres.length > 0 || selectedStatus;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl tracking-wider mb-2">MOVIES</h1>
          <p className="text-muted-foreground">
            Browse our collection and book your favorite movies
          </p>
        </div>

        {/* Search & Filters */}
        <div className="space-y-4 mb-8">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search movies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-secondary/50"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>

          {/* Status Filter */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedStatus === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatus(null)}
            >
              All
            </Button>
            <Button
              variant={selectedStatus === 'now_showing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatus('now_showing')}
            >
              Now Showing
            </Button>
            <Button
              variant={selectedStatus === 'coming_soon' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatus('coming_soon')}
            >
              Coming Soon
            </Button>
          </div>

          {/* Genre Filter */}
          <div className="flex flex-wrap gap-2">
            {genres.map((genre) => (
              <Badge
                key={genre}
                variant={selectedGenres.includes(genre) ? 'default' : 'outline'}
                className="cursor-pointer hover:bg-primary/80"
                onClick={() => toggleGenre(genre)}
              >
                {genre}
              </Badge>
            ))}
          </div>

          {/* Clear Filters */}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Results */}
        <MovieGrid movies={movies} loading={loading} />
      </div>
    </Layout>
  );
}
