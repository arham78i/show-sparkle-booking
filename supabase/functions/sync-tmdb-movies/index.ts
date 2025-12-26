import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TMDB_API_KEY = '2dca580c2a14b55200e784d157207b4d';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

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

interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
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

function getGenreNames(genreIds: number[]): string[] {
  return genreIds.map(id => genreMap[id] || 'Other').filter(Boolean);
}

function getPosterUrl(path: string | null): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/w500${path}`;
}

function getBackdropUrl(path: string | null): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/w1280${path}`;
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

async function fetchMovieDetails(movieId: number): Promise<TMDBMovie> {
  return fetchTMDB(`/movie/${movieId}`, { append_to_response: 'videos' });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting TMDB movie sync...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch now playing movies
    console.log('Fetching now playing movies...');
    const nowPlaying = await fetchTMDB<{ results: TMDBMovie[] }>('/movie/now_playing', { page: '1' });
    const nowPlaying2 = await fetchTMDB<{ results: TMDBMovie[] }>('/movie/now_playing', { page: '2' });
    
    // Fetch upcoming movies
    console.log('Fetching upcoming movies...');
    const upcoming = await fetchTMDB<{ results: TMDBMovie[] }>('/movie/upcoming', { page: '1' });
    
    // Fetch popular movies for variety
    console.log('Fetching popular movies...');
    const popular = await fetchTMDB<{ results: TMDBMovie[] }>('/movie/popular', { page: '1' });

    const allMovies = [
      ...nowPlaying.results.map(m => ({ ...m, status: 'now_showing' as const })),
      ...nowPlaying2.results.map(m => ({ ...m, status: 'now_showing' as const })),
      ...upcoming.results.map(m => ({ ...m, status: 'coming_soon' as const })),
      ...popular.results.map(m => ({ ...m, status: 'now_showing' as const })),
    ];

    // Remove duplicates based on tmdb_id
    const uniqueMovies = allMovies.reduce((acc, movie) => {
      if (!acc.find(m => m.id === movie.id)) {
        acc.push(movie);
      }
      return acc;
    }, [] as typeof allMovies);

    console.log(`Processing ${uniqueMovies.length} unique movies...`);

    let syncedCount = 0;
    let errorCount = 0;

    // Process movies in batches
    for (const movie of uniqueMovies) {
      try {
        // Get detailed info for each movie
        const details = await fetchMovieDetails(movie.id);
        const trailer = details.videos?.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer');
        
        const genreNames = details.genres 
          ? details.genres.map(g => g.name)
          : getGenreNames(movie.genre_ids || []);

        // Determine status based on release date
        const releaseDate = movie.release_date ? new Date(movie.release_date) : null;
        const isUpcoming = releaseDate && releaseDate > new Date();
        const status = isUpcoming ? 'coming_soon' : 'now_showing';

        // Upsert movie into database
        const { error } = await supabase.rpc('upsert_tmdb_movie', {
          _tmdb_id: movie.id,
          _title: movie.title,
          _description: movie.overview || null,
          _genre: genreNames,
          _duration_minutes: details.runtime || 120,
          _release_date: movie.release_date || null,
          _poster_url: getPosterUrl(movie.poster_path),
          _backdrop_url: getBackdropUrl(movie.backdrop_path),
          _trailer_url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
          _rating: movie.vote_average || 0,
          _language: movie.original_language?.toUpperCase() || 'EN',
          _status: status,
        });

        if (error) {
          console.error(`Error upserting movie ${movie.title}:`, error);
          errorCount++;
        } else {
          syncedCount++;
          console.log(`Synced: ${movie.title}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`Error processing movie ${movie.title}:`, err);
        errorCount++;
      }
    }

    console.log(`Sync completed! Synced: ${syncedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${syncedCount} movies successfully`,
        synced: syncedCount,
        errors: errorCount,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
