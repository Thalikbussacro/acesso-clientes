import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { authApi } from './services/api';

// Components
import ProtectedRoute from './components/layout/ProtectedRoute';
import Navbar from './components/layout/Navbar';
import WorkspaceSetup from './components/auth/WorkspaceSetup';
import Login from './components/auth/Login';
import Dashboard from './pages/Dashboard';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading component
const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-secondary-50">
    <div className="text-center">
      <svg className="animate-spin h-8 w-8 text-primary-600 mx-auto" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <p className="mt-2 text-sm text-secondary-600">Inicializando sistema...</p>
    </div>
  </div>
);

// App Router Component
const AppRouter: React.FC = () => {
  const { state } = useAuth();
  const [systemStatus, setSystemStatus] = useState<{
    hasWorkspace: boolean;
    needsSetup: boolean;
    loading: boolean;
  }>({
    hasWorkspace: false,
    needsSetup: true,
    loading: true,
  });

  // Check system status on mount and when auth state changes
  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        const status = await authApi.getStatus();
        setSystemStatus({
          hasWorkspace: status.hasWorkspace,
          needsSetup: status.needsSetup,
          loading: false,
        });
      } catch (error) {
        console.error('Error checking system status:', error);
        setSystemStatus(prev => ({ ...prev, loading: false }));
      }
    };

    checkSystemStatus();
  }, [state.isAuthenticated]); // Re-check quando autenticação muda

  // Show loading while checking system status
  if (systemStatus.loading || !state.isInitialized) {
    return <LoadingScreen />;
  }

  // If system needs setup (no workspace), show setup screen
  if (systemStatus.needsSetup) {
    return (
      <Routes>
        <Route path="/setup" element={<WorkspaceSetup />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  // Normal application routes
  return (
    <div className="min-h-screen bg-secondary-50">
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={
            state.isAuthenticated ? 
              <Navigate to="/dashboard" replace /> : 
              <Login />
          } 
        />
        
        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requireUnlocked>
              <>
                <Navbar />
                <Dashboard />
              </>
            </ProtectedRoute>
          }
        />

        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
};

export default App;