import { Link } from 'react-router-dom';
import { Movie } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Star, Play } from 'lucide-react';

interface MovieCardProps {
  movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
  const statusColors = {
    now_showing: 'bg-seat-available text-accent-foreground',
    coming_soon: 'bg-accent text-accent-foreground',
    ended: 'bg-muted text-muted-foreground',
  };

  const statusLabels = {
    now_showing: 'Now Showing',
    coming_soon: 'Coming Soon',
    ended: 'Ended',
  };

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
            <Link to={`/movies/${movie.id}`}>Book Now</Link>
          </Button>
        </div>

        {/* Status Badge */}
        <Badge className={`absolute top-3 left-3 ${statusColors[movie.status]}`}>
          {statusLabels[movie.status]}
        </Badge>
      </div>

      {/* Info */}
      <div className="p-4 space-y-2">
        <h3 className="font-display text-xl tracking-wide line-clamp-1">{movie.title}</h3>
        
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {movie.rating && (
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-accent text-accent" />
              {movie.rating.toFixed(1)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {movie.duration_minutes} min
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {movie.genre.slice(0, 2).map((g) => (
            <Badge key={g} variant="secondary" className="text-xs">
              {g}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
