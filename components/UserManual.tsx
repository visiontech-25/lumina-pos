import React, { useEffect, useMemo, useState } from 'react';

// Vite raw import for local documentation (bundled into the app)
import userManualText from '../USER_MANUAL.md?raw';

function buildToc(md: string): Array<{ level: number; title: string; line: number }> {
  const lines = md.split('\n');
  const toc: Array<{ level: number; title: string; line: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,3})\s+(.*)$/.exec(lines[i]);
    if (!m) continue;
    toc.push({ level: m[1].length, title: m[2].trim(), line: i + 1 });
  }
  return toc;
}

const UserManual: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setIsLoading(false), 450);
    return () => window.clearTimeout(t);
  }, []);

  const toc = useMemo(() => buildToc(userManualText), []);

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 h-full overflow-y-auto bg-gray-50/30">
      <header className="mb-6">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none uppercase">User Manual</h1>
        <p className="text-sm text-gray-500 mt-2 font-medium">Friendly help, workflows, and hardware setup</p>
      </header>

      {isLoading ? (
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-8 lg:p-12">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-56 bg-slate-100 rounded" />
            <div className="h-4 w-80 bg-slate-100 rounded" />
            <div className="h-4 w-full bg-slate-100 rounded" />
            <div className="h-4 w-full bg-slate-100 rounded" />
            <div className="h-4 w-3/4 bg-slate-100 rounded" />
          </div>
          <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Loading manual…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1 bg-white rounded-[32px] shadow-sm border border-slate-200 p-6 h-fit sticky top-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Contents</p>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {toc.slice(0, 30).map((t, idx) => (
                <div key={idx} className={`text-[11px] font-bold text-slate-700 ${t.level === 1 ? '' : t.level === 2 ? 'pl-3' : 'pl-6'}`}>
                  {t.title}
                </div>
              ))}
            </div>
          </aside>

          <div className="lg:col-span-3 bg-white rounded-[32px] shadow-sm border border-slate-200 p-6 lg:p-10">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 font-sans">
              {userManualText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManual;

