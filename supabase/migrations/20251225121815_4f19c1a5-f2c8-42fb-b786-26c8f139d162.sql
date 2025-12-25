-- Multi-user seat availability + atomic booking for app_bookings

CREATE OR REPLACE FUNCTION public.get_app_booked_seat_ids(
  _tmdb_movie_id TEXT,
  _theater_name TEXT,
  _show_date DATE,
  _show_time TIME
)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  seat_ids TEXT[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT s->>'id'), '{}')
  INTO seat_ids
  FROM public.app_bookings ab
  CROSS JOIN LATERAL jsonb_array_elements(ab.seats) s
  WHERE ab.tmdb_movie_id = _tmdb_movie_id
    AND ab.theater_name = _theater_name
    AND ab.show_date = _show_date
    AND ab.show_time = _show_time
    AND ab.status <> 'cancelled';

  RETURN seat_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.get_app_booked_seat_ids(TEXT, TEXT, DATE, TIME) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_app_booked_seat_ids(TEXT, TEXT, DATE, TIME) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.complete_app_booking(
  _tmdb_movie_id TEXT,
  _movie_title TEXT,
  _movie_poster_url TEXT,
  _theater_name TEXT,
  _theater_location TEXT,
  _screen_name TEXT,
  _show_date DATE,
  _show_time TIME,
  _seats JSONB,
  _total_amount NUMERIC
)
RETURNS TABLE(booking_id UUID, booking_reference TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_booking_ref TEXT;
  v_seat_ids TEXT[];
  v_conflict BOOLEAN;
  v_lock_key BIGINT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _seats IS NULL OR jsonb_typeof(_seats) <> 'array' OR jsonb_array_length(_seats) = 0 THEN
    RAISE EXCEPTION 'no_seats_selected';
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
    status
  )
  VALUES (
    v_user_id,
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
    'confirmed'
  )
  RETURNING id, booking_reference
  INTO booking_id, booking_reference;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_app_booking(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TIME, JSONB, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_app_booking(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TIME, JSONB, NUMERIC) TO authenticated;