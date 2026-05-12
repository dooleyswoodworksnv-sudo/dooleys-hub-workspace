import { createContext, useContext, ReactNode } from 'react';

// Stubbed auth context for the hub environment.
// The original Building Solutions app used Supabase auth which is not needed in the hub.
type AuthContextType = {
  user: null;
  session: null;
  loading: false;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  return (
    <AuthContext.Provider value={{ user: null, session: null, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};
