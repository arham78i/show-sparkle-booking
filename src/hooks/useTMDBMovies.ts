import { useState, useEffect } from 'react';
import {
  getNowPlayingMovies,
  getUpcomingMovies,
  getMovieDetails,
  searchMovies,
  getSimilarMovies,
  tmdbToAppMovie,
  getGenreNames,
  getPosterUrl,
  TMDBMovie,
} from '@/services/tmdb';

export interface AppMovie {
  id: string;
  tmdb_id: number;
  title: string;
  description: string | null;
  genre: string[];
  duration_minutes: number;
  release_date: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  trailer_url: string | null;
  rating: number | null;
  language: string;
  status: 'now_showing' | 'coming_soon' | 'ended';
}

export function useNowPlayingMovies() {
  const [movies, setMovies] = useState<AppMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchMovies() {
      try {
        setLoading(true);
        const data = await getNowPlayingMovies();
        const appMovies = data.results.slice(0, 12).map(m => ({
          ...tmdbToAppMovie(m, 'now_showing'),
          genre: getGenreNames(m.genre_ids),
        }));
        setMovies(appMovies);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
    fetchMovies();
  }, []);

  return { movies, loading, error };
}

export function useUpcomingMovies() {
  const [movies, setMovies] = useState<AppMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchMovies() {
      try {
        setLoading(true);
        const data = await getUpcomingMovies();
        const appMovies = data.results.slice(0, 6).map(m => ({
          ...tmdbToAppMovie(m, 'coming_soon'),
          genre: getGenreNames(m.genre_ids),
        }));
        setMovies(appMovies);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
    fetchMovies();
  }, []);

  return { movies, loading, error };
}

export function useMovieDetails(tmdbId: string | undefined) {
  const [movie, setMovie] = useState<AppMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchMovie() {
      if (!tmdbId) return;
      try {
        setLoading(true);
        const data = await getMovieDetails(parseInt(tmdbId));
        const trailer = data.videos?.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer');
        
        setMovie({
          id: data.id.toString(),
          tmdb_id: data.id,
          title: data.title,
          description: data.overview,
          genre: data.genres?.map(g => g.name) || [],
          duration_minutes: data.runtime || 120,
          release_date: data.release_date,
          poster_url: getPosterUrl(data.poster_path),
          backdrop_url: getPosterUrl(data.backdrop_path, 'original'),
          trailer_url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
          rating: data.vote_average,
          language: data.original_language?.toUpperCase() || 'EN',
          status: new Date(data.release_date) > new Date() ? 'coming_soon' : 'now_showing',
        });
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
    fetchMovie();
  }, [tmdbId]);

  return { movie, loading, error };
}

export function useSearchMovies(query: string) {
  const [movies, setMovies] = useState<AppMovie[]>([]);
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
        const data = await searchMovies(query);
        const appMovies = data.results.slice(0, 20).map(m => ({
          ...tmdbToAppMovie(m, new Date(m.release_date) > new Date() ? 'coming_soon' : 'now_showing'),
          genre: getGenreNames(m.genre_ids),
        }));
        setMovies(appMovies);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
    search();
  }, [query]);

  return { movies, loading, error };
}

export function useAllMovies(statusFilter?: 'now_showing' | 'coming_soon') {
  const [movies, setMovies] = useState<AppMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchMovies() {
      try {
        setLoading(true);
        const [nowPlaying, upcoming] = await Promise.all([
          getNowPlayingMovies(),
          getUpcomingMovies(),
        ]);

        const nowPlayingMovies = nowPlaying.results.map(m => ({
          ...tmdbToAppMovie(m, 'now_showing'),
          genre: getGenreNames(m.genre_ids),
        }));

        const upcomingMovies = upcoming.results.map(m => ({
          ...tmdbToAppMovie(m, 'coming_soon'),
          genre: getGenreNames(m.genre_ids),
        }));

        let allMovies = [...nowPlayingMovies, ...upcomingMovies];
        
        if (statusFilter) {
          allMovies = allMovies.filter(m => m.status === statusFilter);
        }

        setMovies(allMovies);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
    fetchMovies();
  }, [statusFilter]);

  return { movies, loading, error };
}

export function useSimilarMovies(tmdbId: string | undefined) {
  const [movies, setMovies] = useState<AppMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchSimilarMovies() {
      if (!tmdbId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getSimilarMovies(parseInt(tmdbId));
        const appMovies = data.results.slice(0, 6).map(m => ({
          ...tmdbToAppMovie(m, new Date(m.release_date) > new Date() ? 'coming_soon' : 'now_showing'),
          genre: getGenreNames(m.genre_ids),
        }));
        setMovies(appMovies);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
    fetchSimilarMovies();
  }, [tmdbId]);

  return { movies, loading, error };
}
