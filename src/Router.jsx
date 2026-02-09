import { useState, useEffect } from 'react';
import App from './App.jsx';
import CombinatorialApp from './components/CombinatorialApp.jsx';

/**
 * Simple hash-based router to switch between pages.
 */
function Router() {
  const [page, setPage] = useState(() => {
    const hash = window.location.hash.slice(1);
    return hash === 'combinatorial' ? 'combinatorial' : 'geometric';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setPage(hash === 'combinatorial' ? 'combinatorial' : 'geometric');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (page === 'combinatorial') {
    return <CombinatorialApp />;
  }

  return <App />;
}

export default Router;
