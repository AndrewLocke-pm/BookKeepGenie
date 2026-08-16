import { useUser } from '@clerk/clerk-react';

export function useAuth() {
  const { isLoaded, isSignedIn, user } = useUser();
  return {
    isLoading: !isLoaded,
    isAuthenticated: !!isSignedIn,
    user: user ?? null,
  };
}
