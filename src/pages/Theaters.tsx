import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Theater } from '@/types/database';
import { MapPin, Phone, Search, Building2, ChevronRight, Film, Monitor } from 'lucide-react';

export default function Theaters() {
  const [theaters, setTheaters] = useState<Theater[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');

  useEffect(() => {
    fetchTheaters();
  }, []);

  const fetchTheaters = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('theaters')
      .select('*')
      .order('city')
      .order('name');

    if (data && !error) {
      setTheaters(data as Theater[]);
    }
    
    setLoading(false);
  };

  // Get unique cities
  const cities = useMemo(() => {
    const uniqueCities = [...new Set(theaters.map(t => t.city))];
    return uniqueCities.sort();
  }, [theaters]);

  const filteredTheaters = theaters.filter(theater => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      theater.name.toLowerCase().includes(searchLower) ||
      theater.city.toLowerCase().includes(searchLower) ||
      theater.location.toLowerCase().includes(searchLower);
    
    const matchesCity = selectedCity === 'all' || theater.city === selectedCity;
    
    return matchesSearch && matchesCity;
  });

  // Group theaters by city
  const theatersByCity = useMemo(() => {
    const grouped: Record<string, Theater[]> = {};
    filteredTheaters.forEach(theater => {
      if (!grouped[theater.city]) {
        grouped[theater.city] = [];
      }
      grouped[theater.city].push(theater);
    });
    return grouped;
  }, [filteredTheaters]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl tracking-wider mb-2">THEATERS</h1>
          <p className="text-muted-foreground">
            Find a cinema near you across Pakistan
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-secondary/50"
            />
          </div>

          {/* City Filter */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCity === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCity('all')}
            >
              All Cities
            </Button>
            {cities.map(city => (
              <Button
                key={city}
                variant={selectedCity === city ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCity(city)}
              >
                {city}
              </Button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{theaters.length}</p>
                <p className="text-xs text-muted-foreground">Total Theaters</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <MapPin className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{cities.length}</p>
                <p className="text-xs text-muted-foreground">Cities</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Monitor className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">3-5</p>
                <p className="text-xs text-muted-foreground">Screens/Theater</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Film className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">40+</p>
                <p className="text-xs text-muted-foreground">Movies Playing</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Theaters Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : filteredTheaters.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="font-display text-2xl mb-2">No Theaters Found</h2>
            <p className="text-muted-foreground">
              {search ? 'Try a different search term' : 'No theaters available in this area'}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(theatersByCity).map(([city, cityTheaters]) => (
              <div key={city}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="font-display text-2xl tracking-wide">{city.toUpperCase()}</h2>
                  <Badge variant="secondary">{cityTheaters.length} theaters</Badge>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cityTheaters.map((theater) => (
                    <Card 
                      key={theater.id} 
                      className="bg-card/80 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 group"
                    >
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                            <Building2 className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-display text-lg tracking-wide">{theater.name}</h3>
                            <p className="text-sm text-muted-foreground">{theater.location}</p>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{theater.address || theater.location}</span>
                          </div>
                          {theater.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 flex-shrink-0" />
                              <a 
                                href={`tel:${theater.phone}`} 
                                className="hover:text-primary transition-colors"
                              >
                                {theater.phone}
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Features */}
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs">Dolby Atmos</Badge>
                          <Badge variant="outline" className="text-xs">IMAX</Badge>
                          <Badge variant="outline" className="text-xs">3D</Badge>
                        </div>

                        <Button 
                          variant="ghost" 
                          className="w-full justify-between group-hover:bg-primary/10" 
                          asChild
                        >
                          <Link to="/movies">
                            <span className="flex items-center gap-2">
                              <Film className="h-4 w-4" />
                              View Movies
                            </span>
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}