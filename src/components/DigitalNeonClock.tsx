import { useState, useEffect } from 'react';

export default function DigitalNeonClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center justify-center p-6 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
      <div className="font-mono text-5xl text-cyan-400 tracking-widest drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">
        {time.toLocaleTimeString('pt-BR', { hour12: false })}
      </div>
    </div>
  );
}
