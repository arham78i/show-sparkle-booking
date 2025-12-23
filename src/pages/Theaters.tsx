import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Theater } from '@/types/database';
import { MapPin, Phone, Search, Building2 } from 'lucide-react';

export default function Theaters() {
  const [theaters, setTheaters] = useState<Theater[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchTheaters();
  }, []);

  const fetchTheaters = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('theaters')
      .select('*')
      .order('name');

    if (data && !error) {
      setTheaters(data as Theater[]);
    }
    
    setLoading(false);
  };

  const filteredTheaters = theaters.filter(theater => {
    const searchLower = search.toLowerCase();
    return (
      theater.name.toLowerCase().includes(searchLower) ||
      theater.city.toLowerCase().includes(searchLower) ||
      theater.location.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl tracking-wider mb-2">THEATERS</h1>
          <p className="text-muted-foreground">
            Find a theater near you
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary/50"
          />
        </div>

        {/* Theaters Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : filteredTheaters.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="font-display text-2xl mb-2">No Theaters Found</h2>
            <p className="text-muted-foreground">
              {search ? 'Try a different search term' : 'No theaters available'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTheaters.map((theater) => (
              <Card key={theater.id} className="bg-card/80 hover:border-primary/50 transition-colors">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl tracking-wide">{theater.name}</h3>
                      <p className="text-sm text-muted-foreground">{theater.city}</p>
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
                        <span>{theater.phone}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
