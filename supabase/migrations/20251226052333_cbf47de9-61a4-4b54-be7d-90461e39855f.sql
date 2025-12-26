-- Add tmdb_id column to movies table for mapping TMDB movies
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS tmdb_id integer UNIQUE;

-- Add backdrop_url for movie backgrounds
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS backdrop_url text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id ON public.movies(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_movies_status ON public.movies(status);

-- Create a function to upsert movies from TMDB
CREATE OR REPLACE FUNCTION public.upsert_tmdb_movie(
  _tmdb_id integer,
  _title text,
  _description text,
  _genre text[],
  _duration_minutes integer,
  _release_date date,
  _poster_url text,
  _backdrop_url text,
  _trailer_url text,
  _rating numeric,
  _language text,
  _status movie_status
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movie_id uuid;
BEGIN
  -- Try to find existing movie by tmdb_id
  SELECT id INTO v_movie_id FROM movies WHERE tmdb_id = _tmdb_id;
  
  IF v_movie_id IS NOT NULL THEN
    -- Update existing movie
    UPDATE movies SET
      title = _title,
      description = _description,
      genre = _genre,
      duration_minutes = _duration_minutes,
      release_date = _release_date,
      poster_url = _poster_url,
      backdrop_url = _backdrop_url,
      trailer_url = _trailer_url,
      rating = _rating,
      language = _language,
      status = _status,
      updated_at = now()
    WHERE id = v_movie_id;
  ELSE
    -- Insert new movie
    INSERT INTO movies (
      tmdb_id, title, description, genre, duration_minutes,
      release_date, poster_url, backdrop_url, trailer_url,
      rating, language, status
    ) VALUES (
      _tmdb_id, _title, _description, _genre, _duration_minutes,
      _release_date, _poster_url, _backdrop_url, _trailer_url,
      _rating, _language, _status
    )
    RETURNING id INTO v_movie_id;
  END IF;
  
  RETURN v_movie_id;
END;
$$;