import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppMovie } from '@/hooks/useTMDBMovies';
import { Play, Star, Clock, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const statusLabels = {
  now_showing: 'Now Showing',
  coming_soon: 'Coming Soon',
  ended: 'Ended',
};

const statusColors = {
  now_showing: 'bg-seat-available text-background',
  coming_soon: 'bg-accent text-accent-foreground',
  ended: 'bg-muted text-muted-foreground',
};

interface MovieCardProps {
  movie: AppMovie;
}

export function MovieCard({ movie }: MovieCardProps) {
  return (
    <div className="group relative rounded-xl overflow-hidden bg-card border border-border hover:border-primary/50 transition-all duration-300">
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden">
        {movie.poster_url ? (
          <img
            src={movie.poster_url}
            alt={movie.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <Play className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Quick Book Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button asChild className="cinema-glow">
            <Link to={`/movies/${movie.tmdb_id}`}>Book Now</Link>
          </Button>
        </div>

        {/* Status Badge */}
        <Badge className={`absolute top-3 left-3 ${statusColors[movie.status]}`}>
          {statusLabels[movie.status]}
        </Badge>

        {/* Rating */}
        {movie.rating && movie.rating > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-full">
            <Star className="h-3 w-3 fill-accent text-accent" />
            <span className="text-xs font-medium">{movie.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-2">
        <h3 className="font-display text-lg tracking-wide line-clamp-1">{movie.title}</h3>
        
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {movie.duration_minutes} min
          </span>
          {movie.release_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(parseISO(movie.release_date), 'MMM yyyy')}
            </span>
          )}
        </div>
        
        <div className="flex flex-wrap gap-1">
          {movie.genre.slice(0, 2).map((g) => (
            <span key={g} className="text-xs px-2 py-0.5 bg-secondary/50 rounded">
              {g}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
