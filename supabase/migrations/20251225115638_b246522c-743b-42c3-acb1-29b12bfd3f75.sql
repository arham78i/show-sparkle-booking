-- Create a function to lookup booking by reference (public access)
CREATE OR REPLACE FUNCTION public.lookup_booking_by_reference(_booking_reference text)
RETURNS TABLE(
  id uuid,
  booking_reference text,
  movie_title text,
  movie_poster_url text,
  theater_name text,
  theater_location text,
  screen_name text,
  show_date date,
  show_time time,
  seats jsonb,
  total_amount numeric,
  status text,
  created_at timestamptz,
  cancelled_at timestamptz,
  refund_amount numeric,
  customer_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    p.full_name as customer_name
  FROM app_bookings ab
  LEFT JOIN profiles p ON p.user_id = ab.user_id
  WHERE ab.booking_reference = upper(_booking_reference);
END;
$$;