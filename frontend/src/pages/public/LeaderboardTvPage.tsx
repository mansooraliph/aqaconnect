import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Flame, BookOpenCheck } from 'lucide-react';
import { api } from '../../lib/api';

interface ToppersEntry {
  studentId: string;
  name: string;
  halqaName: string | null;
  targetAyahs: number;
  actualAyahs: number;
  excessAyahs: number;
}

interface TopicsEntry {
  studentId: string;
  name: string;
  halqaName: string | null;
  topicsCount: number;
}

interface LeaderboardResponse {
  branch: { id: string; name: string };
  weeklyToppers: ToppersEntry[];
  monthlyToppers: ToppersEntry[];
  mostTopicsCovered: TopicsEntry[];
  generatedAt: string;
}

const REFRESH_MS = 2 * 60 * 1000;
const SLIDE_MS = 9 * 1000;

const RANK_STYLES = [
  'border-amber-400/60 bg-amber-400/10 text-amber-300',
  'border-slate-300/50 bg-slate-300/10 text-slate-200',
  'border-orange-400/50 bg-orange-400/10 text-orange-300',
];

function RankBadge({ rank }: { rank: number }) {
  const style = RANK_STYLES[rank] ?? 'border-white/15 bg-white/5 text-white/70';
  return (
    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-2xl font-bold ${style}`}>
      {rank + 1}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center text-2xl text-white/40">
      No {label} yet — check back soon.
    </div>
  );
}

function ToppersSlide({ title, icon: Icon, entries }: { title: string; icon: typeof Trophy; entries: ToppersEntry[] }) {
  return (
    <div className="flex h-full flex-col gap-8 px-16 py-12">
      <div className="flex items-center gap-4">
        <Icon className="h-12 w-12 text-amber-400" />
        <h2 className="text-5xl font-bold tracking-tight text-white">{title}</h2>
      </div>
      {entries.length === 0 ? (
        <EmptyState label="toppers" />
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-4">
          {entries.map((e, i) => (
            <div
              key={e.studentId}
              className="flex items-center gap-6 rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-5"
            >
              <RankBadge rank={i} />
              <div className="flex-1">
                <p className="text-3xl font-semibold text-white">{e.name}</p>
                {e.halqaName && <p className="text-lg text-white/50">{e.halqaName}</p>}
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-emerald-400">+{e.excessAyahs}</p>
                <p className="text-sm uppercase tracking-wide text-white/40">ayahs ahead</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopicsSlide({ entries }: { entries: TopicsEntry[] }) {
  return (
    <div className="flex h-full flex-col gap-8 px-16 py-12">
      <div className="flex items-center gap-4">
        <BookOpenCheck className="h-12 w-12 text-sky-400" />
        <h2 className="text-5xl font-bold tracking-tight text-white">Most Surahs Covered</h2>
      </div>
      {entries.length === 0 ? (
        <EmptyState label="progress" />
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-4">
          {entries.map((e, i) => (
            <div
              key={e.studentId}
              className="flex items-center gap-6 rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-5"
            >
              <RankBadge rank={i} />
              <div className="flex-1">
                <p className="text-3xl font-semibold text-white">{e.name}</p>
                {e.halqaName && <p className="text-lg text-white/50">{e.halqaName}</p>}
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-sky-400">{e.topicsCount}</p>
                <p className="text-sm uppercase tracking-wide text-white/40">surahs</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LeaderboardTvPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const [slide, setSlide] = useState(0);

  const query = useQuery({
    queryKey: ['tv-leaderboard', branchId],
    queryFn: async () => (await api.get<LeaderboardResponse>(`/public/leaderboard/${branchId}`)).data,
    enabled: Boolean(branchId),
    refetchInterval: REFRESH_MS,
  });

  const slides = query.data
    ? [
        { key: 'weekly', node: <ToppersSlide title="This Week's Toppers" icon={Flame} entries={query.data.weeklyToppers} /> },
        { key: 'monthly', node: <ToppersSlide title="This Month's Toppers" icon={Trophy} entries={query.data.monthlyToppers} /> },
        { key: 'topics', node: <TopicsSlide entries={query.data.mostTopicsCovered} /> },
      ]
    : [];

  useEffect(() => {
    if (slides.length === 0) return;
    const timer = setInterval(() => setSlide((s) => (s + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (query.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0b0f1a] text-2xl text-white/50">
        Loading leaderboard…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0b0f1a] text-2xl text-red-400">
        Could not load this branch's leaderboard.
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0b0f1a] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-16 py-8">
        <div className="flex items-center gap-4">
          <Trophy className="h-10 w-10 text-amber-400" />
          <h1 className="text-3xl font-bold">{query.data.branch.name} — Leaderboard</h1>
        </div>
        <div className="flex gap-2">
          {slides.map((s, i) => (
            <span
              key={s.key}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${i === slide ? 'bg-amber-400' : 'bg-white/20'}`}
            />
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">{slides[slide]?.node}</div>
    </div>
  );
}
