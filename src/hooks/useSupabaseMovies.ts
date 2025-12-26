import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SupabaseMovie {
  id: string;
  tmdb_id: number | null;
  title: string;
  description: string | null;
  genre: string[];
  duration_minutes: number;
  release_date: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  trailer_url: string | null;
  rating: number | null;
  language: string | null;
  status: 'now_showing' | 'coming_soon' | 'ended';
}

export function useNowShowingMovies() {
  const [movies, setMovies] = useState<SupabaseMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchMovies() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('movies')
          .select('*')
          .eq('status', 'now_showing')
          .order('rating', { ascending: false })
          .limit(12);

        if (error) throw error;

        setMovies(data?.map(m => ({
          ...m,
          genre: m.genre || [],
          status: m.status as SupabaseMovie['status'],
        })) || []);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching now showing movies:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMovies();
  }, []);

  return { movies, loading, error };
}

export function useUpcomingMovies() {
  const [movies, setMovies] = useState<SupabaseMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchMovies() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('movies')
          .select('*')
          .eq('status', 'coming_soon')
          .order('release_date', { ascending: true })
          .limit(6);

        if (error) throw error;

        setMovies(data?.map(m => ({
          ...m,
          genre: m.genre || [],
          status: m.status as SupabaseMovie['status'],
        })) || []);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching upcoming movies:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMovies();
  }, []);

  return { movies, loading, error };
}

export function useMovieDetails(movieId: string | undefined) {
  const [movie, setMovie] = useState<SupabaseMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchMovie() {
      if (!movieId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        
        let data = null;
        
        // Check if movieId is a valid UUID or a numeric tmdb_id
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(movieId);
        
        if (isUUID) {
          // Search by UUID id first
          const result = await supabase
            .from('movies')
            .select('*')
            .eq('id', movieId)
            .maybeSingle();
          
          if (result.error) throw result.error;
          data = result.data;
        } else {
          // Try to find by tmdb_id (numeric)
          const tmdbId = parseInt(movieId);
          if (!isNaN(tmdbId)) {
            const result = await supabase
              .from('movies')
              .select('*')
              .eq('tmdb_id', tmdbId)
              .maybeSingle();

            if (result.error) throw result.error;
            data = result.data;
          }
        }

        if (data) {
          setMovie({
            ...data,
            genre: data.genre || [],
            status: data.status as SupabaseMovie['status'],
          });
        }
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching movie details:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMovie();
  }, [movieId]);

  return { movie, loading, error };
}

export function useSearchMovies(query: string) {
  const [movies, setMovies] = useState<SupabaseMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function search() {
      if (!query.trim()) {
        setMovies([]);
        return;
      }
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('movies')
          .select('*')
          .ilike('title', `%${query}%`)
          .limit(20);

        if (error) throw error;

        setMovies(data?.map(m => ({
          ...m,
          genre: m.genre || [],
          status: m.status as SupabaseMovie['status'],
        })) || []);
      } catch (err) {
        setError(err as Error);
        console.error('Error searching movies:', err);
      } finally {
        setLoading(false);
      }
    }
    search();
  }, [query]);

  return { movies, loading, error };
}

export function useAllMovies(statusFilter?: 'now_showing' | 'coming_soon') {
  const [movies, setMovies] = useState<SupabaseMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchMovies() {
      try {
        setLoading(true);
        let query = supabase
          .from('movies')
          .select('*')
          .order('rating', { ascending: false });

        if (statusFilter) {
          query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;

        if (error) throw error;

        setMovies(data?.map(m => ({
          ...m,
          genre: m.genre || [],
          status: m.status as SupabaseMovie['status'],
        })) || []);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching all movies:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMovies();
  }, [statusFilter]);

  return { movies, loading, error };
}

export function useSimilarMovies(movieId: string | undefined) {
  const [movies, setMovies] = useState<SupabaseMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchSimilarMovies() {
      if (!movieId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        
        // First get the current movie's genre
        let { data: currentMovie } = await supabase
          .from('movies')
          .select('genre, id')
          .eq('tmdb_id', parseInt(movieId))
          .maybeSingle();

        if (!currentMovie) {
          const result = await supabase
            .from('movies')
            .select('genre, id')
            .eq('id', movieId)
            .maybeSingle();
          currentMovie = result.data;
        }

        if (!currentMovie) {
          setMovies([]);
          return;
        }

        // Get movies with similar genres, excluding the current movie
        const { data, error } = await supabase
          .from('movies')
          .select('*')
          .neq('id', currentMovie.id)
          .overlaps('genre', currentMovie.genre || [])
          .limit(6);

        if (error) throw error;

        setMovies(data?.map(m => ({
          ...m,
          genre: m.genre || [],
          status: m.status as SupabaseMovie['status'],
        })) || []);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching similar movies:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSimilarMovies();
  }, [movieId]);

  return { movies, loading, error };
}

export function useSyncMovies() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const syncMovies = async () => {
    try {
      setSyncing(true);
      setResult(null);
      
      const { data, error } = await supabase.functions.invoke('sync-tmdb-movies');
      
      if (error) throw error;
      
      setResult(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync movies';
      setResult({ success: false, message: errorMessage });
      console.error('Sync error:', err);
      return { success: false, message: errorMessage };
    } finally {
      setSyncing(false);
    }
  };

  return { syncMovies, syncing, result };
}
