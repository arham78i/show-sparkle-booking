export type MovieStatus = 'now_showing' | 'coming_soon' | 'ended';
export type SeatCategory = 'regular' | 'premium' | 'vip';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'refunded';
export type AppRole = 'admin' | 'moderator' | 'user';

export interface Movie {
  id: string;
  title: string;
  description: string | null;
  genre: string[];
  duration_minutes: number;
  release_date: string | null;
  poster_url: string | null;
  trailer_url: string | null;
  rating: number | null;
  language: string;
  status: MovieStatus;
  created_at: string;
  updated_at: string;
}

export interface Theater {
  id: string;
  name: string;
  location: string;
  city: string;
  address: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Screen {
  id: string;
  theater_id: string;
  name: string;
  total_seats: number;
  rows: number;
  columns: number;
  created_at: string;
  theater?: Theater;
}

export interface Seat {
  id: string;
  screen_id: string;
  row_label: string;
  seat_number: number;
  category: SeatCategory;
  price_multiplier: number;
  created_at: string;
}

export interface Show {
  id: string;
  movie_id: string;
  screen_id: string;
  show_date: string;
  show_time: string;
  base_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  movie?: Movie;
  screen?: Screen & { theater?: Theater };
}

export interface Booking {
  id: string;
  user_id: string | null;
  show_id: string;
  booking_reference: string;
  total_amount: number;
  status: BookingStatus;
  payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
  show?: Show;
}

export interface BookingSeat {
  id: string;
  booking_id: string;
  seat_id: string;
  show_id: string;
  price: number;
  created_at: string;
  seat?: Seat;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeatWithStatus extends Seat {
  isBooked: boolean;
  isSelected: boolean;
}
