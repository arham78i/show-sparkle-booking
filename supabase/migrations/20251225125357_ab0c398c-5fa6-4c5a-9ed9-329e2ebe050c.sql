-- Add guest booking support to app_bookings table
ALTER TABLE public.app_bookings 
  ALTER COLUMN user_id DROP NOT NULL;

-- Add guest info columns
ALTER TABLE public.app_bookings 
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT,
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS is_guest_booking BOOLEAN DEFAULT false;

-- Create function for guest bookings (no auth required)
CREATE OR REPLACE FUNCTION public.complete_guest_booking(
  _tmdb_movie_id TEXT,
  _movie_title TEXT,
  _movie_poster_url TEXT,
  _theater_name TEXT,
  _theater_location TEXT,
  _screen_name TEXT,
  _show_date DATE,
  _show_time TIME,
  _seats JSONB,
  _total_amount NUMERIC,
  _guest_name TEXT,
  _guest_email TEXT,
  _guest_phone TEXT
)
RETURNS TABLE(booking_id UUID, booking_ref TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking_ref TEXT;
  v_seat_ids TEXT[];
  v_conflict BOOLEAN;
  v_lock_key BIGINT;
  v_booking_id UUID;
BEGIN
  -- Validate inputs
  IF _seats IS NULL OR jsonb_typeof(_seats) <> 'array' OR jsonb_array_length(_seats) = 0 THEN
    RAISE EXCEPTION 'no_seats_selected';
  END IF;

  IF _guest_name IS NULL OR trim(_guest_name) = '' THEN
    RAISE EXCEPTION 'guest_name_required';
  END IF;

  IF _guest_email IS NULL OR trim(_guest_email) = '' THEN
    RAISE EXCEPTION 'guest_email_required';
  END IF;

  -- Avoid race conditions for the same show
  v_lock_key := hashtext(
    _tmdb_movie_id || '|' || _theater_name || '|' || _show_date::text || '|' || _show_time::text
  )::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT array_agg(e->>'id')
  INTO v_seat_ids
  FROM jsonb_array_elements(_seats) e;

  SELECT EXISTS (
    SELECT 1
    FROM public.app_bookings ab
    WHERE ab.tmdb_movie_id = _tmdb_movie_id
      AND ab.theater_name = _theater_name
      AND ab.show_date = _show_date
      AND ab.show_time = _show_time
      AND ab.status <> 'cancelled'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(ab.seats) s
        WHERE (s->>'id') = ANY(v_seat_ids)
      )
  )
  INTO v_conflict;

  IF v_conflict THEN
    RAISE EXCEPTION 'seats_unavailable';
  END IF;

  v_booking_ref := public.generate_booking_reference();

  INSERT INTO public.app_bookings (
    user_id,
    tmdb_movie_id,
    movie_title,
    movie_poster_url,
    theater_name,
    theater_location,
    screen_name,
    show_date,
    show_time,
    seats,
    total_amount,
    booking_reference,
    status,
    is_guest_booking,
    guest_name,
    guest_email,
    guest_phone
  )
  VALUES (
    NULL, -- No user_id for guest bookings
    _tmdb_movie_id,
    _movie_title,
    _movie_poster_url,
    _theater_name,
    _theater_location,
    _screen_name,
    _show_date,
    _show_time,
    _seats,
    _total_amount,
    v_booking_ref,
    'confirmed',
    true,
    _guest_name,
    _guest_email,
    _guest_phone
  )
  RETURNING id INTO v_booking_id;

  booking_id := v_booking_id;
  booking_ref := v_booking_ref;
  RETURN NEXT;
END;
$$;

-- Update RLS policy to allow guest bookings to be viewed by reference lookup
CREATE POLICY "Anyone can view guest bookings by reference" 
ON public.app_bookings 
FOR SELECT 
USING (is_guest_booking = true);

-- Update lookup function to include guest info
CREATE OR REPLACE FUNCTION public.lookup_booking_by_reference(_booking_reference text)
 RETURNS TABLE(id uuid, booking_reference text, movie_title text, movie_poster_url text, theater_name text, theater_location text, screen_name text, show_date date, show_time time without time zone, seats jsonb, total_amount numeric, status text, created_at timestamp with time zone, cancelled_at timestamp with time zone, refund_amount numeric, customer_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ab.id,
    ab.booking_reference,
    ab.movie_title,
    ab.movie_poster_url,
    ab.theater_name,
    ab.theater_location,
    ab.screen_name,
    ab.show_date,
    ab.show_time,
    ab.seats,
    ab.total_amount,
    ab.status,
    ab.created_at,
    ab.cancelled_at,
    ab.refund_amount,
    COALESCE(ab.guest_name, p.full_name) as customer_name
  FROM app_bookings ab
  LEFT JOIN profiles p ON p.user_id = ab.user_id
  WHERE ab.booking_reference = upper(_booking_reference);
END;
$$;