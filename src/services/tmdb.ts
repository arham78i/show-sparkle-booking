// TMDB API service - uses free API with public read access token
const TMDB_API_KEY = '2dca580c2a14b55200e784d157207b4d'; // Public demo key
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  original_language: string;
  runtime?: number;
  videos?: {
    results: Array<{
      key: string;
      site: string;
      type: string;
    }>;
  };
}

export interface TMDBGenre {
  id: number;
  name: string;
}

// Genre mapping from TMDB IDs to names
const genreMap: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

export function getGenreNames(genreIds: number[]): string[] {
  return genreIds.map(id => genreMap[id] || 'Other').filter(Boolean);
}

export function getPosterUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'original' = 'w500'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getBackdropUrl(path: string | null, size: 'w780' | 'w1280' | 'original' = 'w1280'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', TMDB_API_KEY);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }
  return response.json();
}

export async function getNowPlayingMovies(page = 1): Promise<{ results: TMDBMovie[]; total_pages: number }> {
  return fetchTMDB('/movie/now_playing', { page: page.toString() });
}

export async function getUpcomingMovies(page = 1): Promise<{ results: TMDBMovie[]; total_pages: number }> {
  return fetchTMDB('/movie/upcoming', { page: page.toString() });
}

export async function getPopularMovies(page = 1): Promise<{ results: TMDBMovie[]; total_pages: number }> {
  return fetchTMDB('/movie/popular', { page: page.toString() });
}

export async function getMovieDetails(movieId: number): Promise<TMDBMovie & { runtime: number; genres: TMDBGenre[] }> {
  return fetchTMDB(`/movie/${movieId}`, { append_to_response: 'videos' });
}

export async function searchMovies(query: string, page = 1): Promise<{ results: TMDBMovie[]; total_pages: number }> {
  return fetchTMDB('/search/movie', { query, page: page.toString() });
}

export async function getSimilarMovies(movieId: number): Promise<{ results: TMDBMovie[]; total_pages: number }> {
  return fetchTMDB(`/movie/${movieId}/similar`);
}

export async function getMoviesByGenre(genreIds: number[], page = 1): Promise<{ results: TMDBMovie[]; total_pages: number }> {
  return fetchTMDB('/discover/movie', { 
    with_genres: genreIds.join(','), 
    page: page.toString(),
    sort_by: 'popularity.desc'
  });
}

// Convert TMDB movie to our app's Movie format
export function tmdbToAppMovie(tmdb: TMDBMovie, status: 'now_showing' | 'coming_soon' = 'now_showing') {
  const trailer = tmdb.videos?.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer');
  
  return {
    id: tmdb.id.toString(),
    tmdb_id: tmdb.id,
    title: tmdb.title,
    description: tmdb.overview,
    genre: getGenreNames(tmdb.genre_ids),
    duration_minutes: tmdb.runtime || 120,
    release_date: tmdb.release_date,
    poster_url: getPosterUrl(tmdb.poster_path),
    backdrop_url: getBackdropUrl(tmdb.backdrop_path),
    trailer_url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    rating: tmdb.vote_average,
    language: tmdb.original_language?.toUpperCase() || 'EN',
    status,
  };
}
