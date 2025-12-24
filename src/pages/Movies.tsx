import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { MovieGrid } from '@/components/movies/MovieGrid';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAllMovies, useSearchMovies, AppMovie } from '@/hooks/useTMDBMovies';
import { Search, X } from 'lucide-react';

const genres = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller', 'Animation'];

type MovieStatus = 'now_showing' | 'coming_soon';

export default function Movies() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<MovieStatus | null>(
    (searchParams.get('status') as MovieStatus) || null
  );

  const { movies: allMovies, loading: loadingAll } = useAllMovies(selectedStatus || undefined);
  const { movies: searchResults, loading: loadingSearch } = useSearchMovies(debouncedSearch);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Filter movies
  const filteredMovies = useMemo(() => {
    let movies: AppMovie[] = debouncedSearch ? searchResults : allMovies;

    // Filter by genres
    if (selectedGenres.length > 0) {
      movies = movies.filter(m => 
        m.genre.some(g => selectedGenres.includes(g))
      );
    }

    // Filter by status if searching
    if (debouncedSearch && selectedStatus) {
      movies = movies.filter(m => m.status === selectedStatus);
    }

    return movies;
  }, [allMovies, searchResults, debouncedSearch, selectedGenres, selectedStatus]);

  const loading = loadingAll || loadingSearch;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
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
    setDebouncedSearch('');
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
              <X className="mr-1 h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Results */}
        <div className="mb-4">
          <p className="text-muted-foreground">
            {loading ? 'Loading...' : `${filteredMovies.length} movies found`}
          </p>
        </div>

        <MovieGrid movies={filteredMovies} loading={loading} />
      </div>
    </Layout>
  );
}
