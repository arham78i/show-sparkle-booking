-- Create a dedicated app_bookings table that works with TMDB movie data
-- This allows booking without requiring shows in the database

CREATE TABLE public.app_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tmdb_movie_id text NOT NULL,
  movie_title text NOT NULL,
  movie_poster_url text,
  theater_name text NOT NULL,
  theater_location text,
  screen_name text NOT NULL DEFAULT 'Screen 1',
  show_date date NOT NULL,
  show_time time NOT NULL,
  seats jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric NOT NULL,
  booking_reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'confirmed',
  cancelled_at timestamp with time zone,
  refund_amount numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_bookings ENABLE ROW LEVEL SECURITY;

-- Policies for app_bookings
CREATE POLICY "Users can view their own app bookings"
  ON public.app_bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own app bookings"
  ON public.app_bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own app bookings"
  ON public.app_bookings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all app bookings"
  ON public.app_bookings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_app_bookings_updated_at
  BEFORE UPDATE ON public.app_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to cancel app booking with refund logic
CREATE OR REPLACE FUNCTION public.cancel_app_booking(_booking_id uuid, _user_id uuid)
RETURNS TABLE(success boolean, message text, refund_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking_record RECORD;
  show_datetime TIMESTAMP WITH TIME ZONE;
  hours_until_show NUMERIC;
  calculated_refund NUMERIC;
BEGIN
  -- Get booking details
  SELECT * INTO booking_record
  FROM app_bookings
  WHERE id = _booking_id AND user_id = _user_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Booking not found'::TEXT, 0::NUMERIC;
    RETURN;
  END IF;
  
  IF booking_record.status = 'cancelled' THEN
    RETURN QUERY SELECT false, 'Booking already cancelled'::TEXT, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- Calculate show datetime
  show_datetime := (booking_record.show_date || ' ' || booking_record.show_time)::TIMESTAMP WITH TIME ZONE;
  hours_until_show := EXTRACT(EPOCH FROM (show_datetime - now())) / 3600;
  
  -- Time-based refund: full refund if 24+ hours before show
  IF hours_until_show >= 24 THEN
    calculated_refund := booking_record.total_amount;
  ELSE
    calculated_refund := 0;
  END IF;
  
  -- Update booking status
  UPDATE app_bookings 
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    refund_amount = calculated_refund,
    updated_at = now()
  WHERE id = _booking_id;
  
  RETURN QUERY SELECT true, 
    CASE 
      WHEN calculated_refund > 0 THEN 'Booking cancelled. Full refund will be processed.'
      ELSE 'Booking cancelled. No refund available (less than 24 hours before show).'
    END::TEXT,
    calculated_refund;
END;
$$;