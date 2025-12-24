
CREATE OR REPLACE FUNCTION public.cancel_app_booking(_booking_id uuid, _user_id uuid)
 RETURNS TABLE(success boolean, message text, refund_amount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  booking_record RECORD;
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
  
  -- 50% refund on cancellation
  calculated_refund := booking_record.total_amount * 0.5;
  
  -- Update booking status
  UPDATE app_bookings 
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    refund_amount = calculated_refund,
    updated_at = now()
  WHERE id = _booking_id;
  
  RETURN QUERY SELECT true, 
    'Booking cancelled. 50% refund (PKR ' || calculated_refund || ') will be processed. Cancellation fee: PKR ' || (booking_record.total_amount - calculated_refund),
    calculated_refund;
END;
$function$;
