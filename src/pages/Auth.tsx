import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Film, Loader2 } from 'lucide-react';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().optional(),
});

export default function Auth() {
  const [searchParams] = useSearchParams();
  const isSignUp = searchParams.get('mode') === 'signup';
  const redirect = searchParams.get('redirect');
  const redirectTo = redirect && redirect.startsWith('/') ? redirect : '/';
  const redirectEncoded = redirect ? encodeURIComponent(redirect) : '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate input
    const validation = authSchema.safeParse({ email, password, fullName });
    if (!validation.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Account exists',
              description: 'This email is already registered. Please sign in instead.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Sign up failed',
              description: error.message,
              variant: 'destructive',
            });
          }
          return;
        }
        toast({
          title: 'Welcome to Cinemax!',
          description: 'Your account has been created successfully.',
        });
        navigate(redirectTo);
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: 'Sign in failed',
            description: error.message,
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: 'Welcome back!',
          description: 'You have signed in successfully.',
        });
        navigate(redirectTo);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 cinema-gradient">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative z-10 bg-card/95 backdrop-blur-xl border-border">
        <CardHeader className="text-center space-y-4">
          <Link to="/" className="flex items-center justify-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Film className="h-6 w-6 text-primary" />
            </div>
            <span className="font-display text-2xl tracking-wider">CINEMAX</span>
          </Link>
          <div>
            <CardTitle className="font-display text-3xl tracking-wide">
              {isSignUp ? 'CREATE ACCOUNT' : 'WELCOME BACK'}
            </CardTitle>
            <CardDescription className="mt-2">
              {isSignUp
                ? 'Sign up to start booking your favorite movies'
                : 'Sign in to access your bookings'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`bg-secondary/50 ${errors.email ? 'border-destructive' : ''}`}
                required
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`bg-secondary/50 ${errors.password ? 'border-destructive' : ''}`}
                required
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            {isSignUp ? (
              <p className="text-muted-foreground">
                Already have an account?{' '}
                <Link
                  to={redirectEncoded ? `/auth?redirect=${redirectEncoded}` : '/auth'}
                  className="text-primary hover:underline"
                >
                  Sign in
                </Link>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Don't have an account?{' '}
                <Link
                  to={redirectEncoded ? `/auth?mode=signup&redirect=${redirectEncoded}` : '/auth?mode=signup'}
                  className="text-primary hover:underline"
                >
                  Sign up
                </Link>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
