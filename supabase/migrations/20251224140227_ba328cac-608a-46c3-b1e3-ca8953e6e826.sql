-- Add seat reservations table for seat locking
CREATE TABLE public.seat_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reserved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  UNIQUE(show_id, seat_id)
);

-- Enable RLS on seat_reservations
ALTER TABLE public.seat_reservations ENABLE ROW LEVEL SECURITY;

-- Anyone can view seat reservations (to see which seats are locked)
CREATE POLICY "Anyone can view seat reservations"
ON public.seat_reservations FOR SELECT
USING (true);

-- Users can create their own reservations
CREATE POLICY "Users can create seat reservations"
ON public.seat_reservations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reservations
CREATE POLICY "Users can delete their own reservations"
ON public.seat_reservations FOR DELETE
USING (auth.uid() = user_id);

-- Admins can manage all reservations
CREATE POLICY "Admins can manage all reservations"
ON public.seat_reservations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add refund_deadline and cancellation fields to bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;

-- Function to clean up expired seat reservations
CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.seat_reservations 
  WHERE expires_at < now();
END;
$$;

-- Function to check seat availability (including reservations)
CREATE OR REPLACE FUNCTION public.check_seat_availability(
  _show_id UUID,
  _seat_ids UUID[]
)
RETURNS TABLE(seat_id UUID, is_available BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First cleanup expired reservations
  PERFORM cleanup_expired_reservations();
  
  RETURN QUERY
  SELECT 
    s.id as seat_id,
    NOT EXISTS (
      SELECT 1 FROM booking_seats bs 
      WHERE bs.show_id = _show_id AND bs.seat_id = s.id
    ) AND NOT EXISTS (
      SELECT 1 FROM seat_reservations sr 
      WHERE sr.show_id = _show_id AND sr.seat_id = s.id
      AND sr.expires_at > now()
    ) as is_available
  FROM unnest(_seat_ids) AS s(id);
END;
$$;

-- Function to reserve seats atomically
CREATE OR REPLACE FUNCTION public.reserve_seats(
  _show_id UUID,
  _seat_ids UUID[],
  _user_id UUID
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unavailable_count INTEGER;
BEGIN
  -- Cleanup expired reservations first
  PERFORM cleanup_expired_reservations();
  
  -- Delete any existing reservations by this user for this show
  DELETE FROM seat_reservations 
  WHERE show_id = _show_id AND user_id = _user_id;
  
  -- Check if all seats are available
  SELECT COUNT(*) INTO unavailable_count
  FROM unnest(_seat_ids) AS seat_id
  WHERE EXISTS (
    SELECT 1 FROM booking_seats bs 
    WHERE bs.show_id = _show_id AND bs.seat_id = seat_id
  ) OR EXISTS (
    SELECT 1 FROM seat_reservations sr 
    WHERE sr.show_id = _show_id AND sr.seat_id = seat_id
    AND sr.expires_at > now()
  );
  
  IF unavailable_count > 0 THEN
    RETURN QUERY SELECT false, 'Some seats are no longer available'::TEXT;
    RETURN;
  END IF;
  
  -- Reserve all seats
  INSERT INTO seat_reservations (show_id, seat_id, user_id)
  SELECT _show_id, seat_id, _user_id
  FROM unnest(_seat_ids) AS seat_id;
  
  RETURN QUERY SELECT true, 'Seats reserved successfully'::TEXT;
END;
$$;

-- Function to complete booking (converts reservations to actual bookings)
CREATE OR REPLACE FUNCTION public.complete_booking(
  _show_id UUID,
  _seat_ids UUID[],
  _user_id UUID,
  _total_amount NUMERIC,
  _paypal_order_id TEXT DEFAULT NULL
)
RETURNS TABLE(booking_id UUID, booking_reference TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_booking_id UUID;
  new_booking_ref TEXT;
BEGIN
  -- Generate booking reference
  new_booking_ref := generate_booking_reference();
  
  -- Create the booking
  INSERT INTO bookings (user_id, show_id, total_amount, status, booking_reference, paypal_order_id)
  VALUES (_user_id, _show_id, _total_amount, 'confirmed', new_booking_ref, _paypal_order_id)
  RETURNING id INTO new_booking_id;
  
  -- Get seat prices and insert booking_seats
  INSERT INTO booking_seats (booking_id, show_id, seat_id, price)
  SELECT 
    new_booking_id,
    _show_id,
    s.id,
    (SELECT base_price FROM shows WHERE id = _show_id) * s.price_multiplier
  FROM seats s
  WHERE s.id = ANY(_seat_ids);
  
  -- Remove the reservations
  DELETE FROM seat_reservations 
  WHERE show_id = _show_id AND user_id = _user_id;
  
  RETURN QUERY SELECT new_booking_id, new_booking_ref;
END;
$$;

-- Function to cancel booking with refund check
CREATE OR REPLACE FUNCTION public.cancel_booking(
  _booking_id UUID,
  _user_id UUID
)
RETURNS TABLE(success BOOLEAN, message TEXT, refund_amount NUMERIC)
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
  SELECT b.*, s.show_date, s.show_time
  INTO booking_record
  FROM bookings b
  JOIN shows s ON s.id = b.show_id
  WHERE b.id = _booking_id AND b.user_id = _user_id;
  
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
  UPDATE bookings 
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    refund_amount = calculated_refund,
    updated_at = now()
  WHERE id = _booking_id;
  
  -- Delete booking seats to free them up
  DELETE FROM booking_seats WHERE booking_id = _booking_id;
  
  RETURN QUERY SELECT true, 
    CASE 
      WHEN calculated_refund > 0 THEN 'Booking cancelled. Full refund will be processed.'
      ELSE 'Booking cancelled. No refund available (less than 24 hours before show).'
    END::TEXT,
    calculated_refund;
END;
$$;

-- Enable realtime for seat_reservations and booking_seats
ALTER PUBLICATION supabase_realtime ADD TABLE public.seat_reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_seats;