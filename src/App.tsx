import { useCallback, useEffect, useState } from 'react';
import GroupApp from './GroupApp';
import { api, type User } from './lib/api';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { Landing } from './pages/Landing';

/** Hash routes, so the same build works from Docker, a static host or a phone's home screen. */
function useRoute(): [string, (to: string) => void] {
  const read = () => window.location.hash.replace(/^#/, '') || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((to: string) => { window.location.hash = to; }, []);
  return [route, go];
}

export default function App() {
  const [route, go] = useRoute();
  // undefined = still checking; null = signed out.
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
    go('/');
  };

  const needsLogin = route === '/groups' || route.startsWith('/g/');
  useEffect(() => {
    if (user === null && needsLogin) go('/login');
    if (user && (route === '/login' || route === '/signup')) go('/groups');
  }, [user, route, needsLogin, go]);

  if (route === '/demo') return <GroupApp key="demo" options={{ storageKey: 'app' }} onExit={() => go(user ? '/groups' : '/')} />;

  const group = /^\/g\/([\w-]+)$/.exec(route);
  if (group && user) {
    const id = group[1];
    return <GroupApp key={id} options={{ storageKey: `g:${id}`, remoteId: id }} onExit={() => go('/groups')} />;
  }
  if (route === '/groups' && user) return <Dashboard user={user} go={go} onLogout={logout} />;
  if ((route === '/login' || route === '/signup') && user === null) {
    return <AuthPage mode={route === '/signup' ? 'signup' : 'login'} go={go} onSignedIn={(u) => { setUser(u); go('/groups'); }} />;
  }
  if (needsLogin || user === undefined) {
    return (
      <div className="cloth grid min-h-screen place-items-center">
        <p className="font-display text-4xl text-patra">बोलता खाता</p>
      </div>
    );
  }
  return <Landing user={user} go={go} />;
}
