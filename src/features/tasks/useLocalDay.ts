import { useEffect, useState } from 'react';
import { localDateKey } from './planning';

export function useLocalDay(): Date {
  const [day, setDay] = useState(() => new Date());
  useEffect(() => {
    function refresh() {
      const now = new Date();
      setDay((current) => localDateKey(current) === localDateKey(now) ? current : now);
    }
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return day;
}
