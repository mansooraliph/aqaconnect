import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuthStore } from '../../store/auth';
import { useGlobalResource } from '../../hooks/useResource';
import { CrudPage } from '../../components/CrudPage';
import { api } from '../../lib/api';
import type { FieldDef } from '../../components/CrudFormModal';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { toast } from '../../components/ui/toast';

interface Surah {
  id: string;
  number: number;
  nameArabic: string;
  nameEnglish: string;
  totalAyahs: number;
  juzFrom: number | null;
  juzTo: number | null;
  pageNumberFrom: number | null;
  pageNumberTo: number | null;
  lineNumberFrom: number | null;
  lineNumberTo: number | null;
  revelationType: 'MAKKI' | 'MADANI' | null;
}

interface SurahStats {
  totalSurahs: number;
  totalAyahs: number;
  makkiCount: number;
  madaniCount: number;
}

const FIELDS: FieldDef[] = [
  { name: 'number', label: 'Number', type: 'number', required: true },
  { name: 'nameArabic', label: 'Name (Arabic)', type: 'text', required: true },
  { name: 'nameEnglish', label: 'Name (English)', type: 'text', required: true },
  { name: 'totalAyahs', label: 'Total ayahs', type: 'number', required: true },
  { name: 'juzFrom', label: 'Juz (from)', type: 'number' },
  { name: 'juzTo', label: 'Juz (to)', type: 'number' },
  { name: 'pageNumberFrom', label: 'Page number (from)', type: 'number' },
  { name: 'pageNumberTo', label: 'Page number (to)', type: 'number' },
  { name: 'lineNumberFrom', label: 'Line number (from)', type: 'number' },
  { name: 'lineNumberTo', label: 'Line number (to)', type: 'number' },
  {
    name: 'revelationType',
    label: 'Revelation type',
    type: 'select',
    options: [
      { label: 'Makki', value: 'MAKKI' },
      { label: 'Madani', value: 'MADANI' },
    ],
  },
];

export function SurahsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { list, create, update } = useGlobalResource<Surah>('surahs');

  const stats = useQuery({
    queryKey: ['surahs-stats'],
    queryFn: async () => (await api.get<SurahStats>('/surahs/stats')).data,
  });

  const handleImport = async () => {
    const { data } = await api.post<{ created: number; skipped: number }>('/surahs/import');
    toast.success(`Imported ${data.created} Surah(s), skipped ${data.skipped} already present`);
    list.refetch();
    stats.refetch();
  };

  const columns: ColumnDef<Surah, unknown>[] = [
    { header: 'Number', accessorKey: 'number' },
    { header: 'Name (Arabic)', accessorKey: 'nameArabic' },
    { header: 'Name (English)', accessorKey: 'nameEnglish' },
    { header: 'Total ayahs', accessorKey: 'totalAyahs' },
    {
      header: 'Juz',
      id: 'juz',
      cell: ({ row }) =>
        row.original.juzFrom
          ? row.original.juzFrom === row.original.juzTo
            ? row.original.juzFrom
            : `${row.original.juzFrom}-${row.original.juzTo}`
          : '-',
    },
    {
      header: 'Pages',
      id: 'pages',
      cell: ({ row }) =>
        row.original.pageNumberFrom
          ? `${row.original.pageNumberFrom}-${row.original.pageNumberTo}`
          : '-',
    },
    { header: 'Revelation type', accessorKey: 'revelationType' },
  ];

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Surahs" value={stats.data?.totalSurahs ?? 0} isLoading={stats.isLoading} />
        <StatCard title="Total Ayahs" value={stats.data?.totalAyahs ?? 0} isLoading={stats.isLoading} />
        <StatCard title="Makki" value={stats.data?.makkiCount ?? 0} isLoading={stats.isLoading} />
        <StatCard title="Madani" value={stats.data?.madaniCount ?? 0} isLoading={stats.isLoading} />
      </div>
      <CrudPage<Surah>
        title="Surahs"
        description="The 114 canonical Surahs of the Quran, used across memorization targets and schedules."
        data={list.data}
        loading={list.isLoading}
        columns={columns}
        fields={FIELDS}
        canManage={hasPermission('configuration.surahs.manage')}
        onCreate={(values) => create.mutateAsync(values)}
        onUpdate={(id, values) => update.mutateAsync({ id, payload: values })}
        extraActions={
          hasPermission('configuration.surahs.manage') && (
            <Button onClick={handleImport}>Import all 114 Surahs</Button>
          )
        }
      />
    </>
  );
}
