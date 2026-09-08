import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, FileDown, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Modal } from '../../components/ui/Modal';
import { Field } from '../../components/ui/Input';
import { FilterSelect } from '../../components/ui/FilterSelect';
import { toast } from '../../components/ui/toast';
import { useAuthStore } from '../../store/auth';
import { CrudFormModal, type FieldDef } from '../../components/CrudFormModal';
import { api } from '../../lib/api';

interface Surah {
  id: string;
  number: number;
  nameEnglish: string;
}

interface PageLineRow {
  id: string;
  surahId: string;
  ayahNumber: number;
  juzNumber: number | null;
  lineFrom: number;
  lineTo: number;
  quranPage: { pageNumber: number };
}

export function SurahAyahPageLinesPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('configuration.surahs.manage');
  const queryClient = useQueryClient();

  const surahsQuery = useQuery({
    queryKey: ['surahs'],
    queryFn: async () => (await api.get<Surah[]>('/surahs')).data,
  });

  const [surahId, setSurahId] = useState('');
  const [juzNumber, setJuzNumber] = useState('');

  const linesQuery = useQuery({
    queryKey: ['surah-ayah-page-lines', surahId, juzNumber],
    queryFn: async () =>
      (
        await api.get<PageLineRow[]>('/surah-ayah-page-lines', {
          params: {
            ...(surahId && { surahId }),
            ...(juzNumber && { juzNumber }),
          },
        })
      ).data,
  });

  const juzOptions = Array.from({ length: 30 }, (_, i) => ({ label: `Juz ${i + 1}`, value: String(i + 1) }));

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PageLineRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PageLineRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const surahOptions = (surahsQuery.data ?? []).map((s) => ({
    label: `${s.number}. ${s.nameEnglish}`,
    value: s.id,
  }));

  const surahName = (id: string) => {
    const surah = surahsQuery.data?.find((s) => s.id === id);
    return surah ? `${surah.number}. ${surah.nameEnglish}` : id;
  };

  const FIELDS: FieldDef[] = [
    { name: 'surahId', label: 'Surah', type: 'select', required: true, options: surahOptions },
    { name: 'ayahNumber', label: 'Ayah number', type: 'number', required: true },
    { name: 'juzNumber', label: 'Juz number', type: 'number' },
    { name: 'pageNumber', label: 'Page number', type: 'number', required: true },
    { name: 'lineFrom', label: 'Line (from)', type: 'number', required: true },
    { name: 'lineTo', label: 'Line (to)', type: 'number', required: true },
  ];

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['surah-ayah-page-lines'] });

  // ---- Import ----
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Choose a file to import');
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const { data } = await api.post<{ imported: number }>('/surah-ayah-page-lines/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Imported ${data.imported} row(s), replacing the previous mapping`);
      setImportOpen(false);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      refetch();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to import file';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setImporting(false);
    }
  };

  // ---- Export ----
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await api.get('/surah-ayah-page-lines/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'surah-ayah-page-lines.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export file');
    } finally {
      setExporting(false);
    }
  };

  // ---- Download the originally imported workbook (as uploaded, not the DB-derived export) ----
  const [downloadingImport, setDownloadingImport] = useState(false);

  const handleDownloadImportedFile = async () => {
    setDownloadingImport(true);
    try {
      const response = await api.get('/surah-ayah-page-lines/import/file', { responseType: 'blob' });
      const disposition = response.headers['content-disposition'] as string | undefined;
      const filename = disposition?.match(/filename="(.+)"/)?.[1] ?? 'surah-ayah-page-lines-import.xlsx';
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(status === 404 ? 'No file has been imported yet' : 'Failed to download imported file');
    } finally {
      setDownloadingImport(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (record: PageLineRow) => {
    setEditing(record);
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      if (editing) {
        await api.patch(`/surah-ayah-page-lines/${editing.id}`, values);
        toast.success('Updated');
      } else {
        await api.post('/surah-ayah-page-lines', values);
        toast.success('Created');
      }
      setModalOpen(false);
      refetch();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/surah-ayah-page-lines/${deleteTarget.id}`);
      toast.success('Deleted');
      setDeleteTarget(null);
      refetch();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<PageLineRow, unknown>[] = [
    { header: 'Surah', id: 'surah', cell: ({ row }) => surahName(row.original.surahId) },
    { header: 'Ayah', accessorKey: 'ayahNumber' },
    { header: 'Juz', accessorKey: 'juzNumber' },
    { header: 'Page', id: 'page', cell: ({ row }) => row.original.quranPage.pageNumber },
    { header: 'Line From', accessorKey: 'lineFrom' },
    { header: 'Line To', accessorKey: 'lineTo' },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(row.original)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold text-text-primary">Surah Ayah Page Lines</h1>
          <p className="text-sm text-text-muted">
            Maps each ayah to its Mushaf page and line range, used to derive per-page/line memorization portions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} loading={exporting}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={handleDownloadImportedFile} loading={downloadingImport}>
            <FileDown className="h-4 w-4" />
            Download imported file
          </Button>
          {canManage && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          width="w-64"
          label="Filter by Surah"
          placeholder="All Surahs"
          placeholderSelectable
          value={surahId}
          onChange={setSurahId}
          options={surahOptions}
        />
        <FilterSelect
          width="w-40"
          label="Filter by Juz"
          placeholder="All Juz"
          placeholderSelectable
          value={juzNumber}
          onChange={setJuzNumber}
          options={juzOptions}
        />
      </div>
      <DataTable<PageLineRow> columns={columns} data={linesQuery.data ?? []} isLoading={linesQuery.isLoading} />
      <CrudFormModal
        open={modalOpen}
        title={editing ? 'Edit Page Line' : 'Add Page Line'}
        fields={FIELDS}
        initialValues={
          editing
            ? {
                surahId: editing.surahId,
                ayahNumber: editing.ayahNumber,
                juzNumber: editing.juzNumber ?? undefined,
                pageNumber: editing.quranPage.pageNumber,
                lineFrom: editing.lineFrom,
                lineTo: editing.lineTo,
              }
            : undefined
        }
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete page line"
        message={`Delete ayah ${deleteTarget?.ayahNumber} of ${deleteTarget ? surahName(deleteTarget.surahId) : ''}?`}
        confirmVariant="danger"
        confirmLabel="Delete"
        isLoading={deleting}
      />
      <Modal
        open={importOpen}
        title="Import Surah Ayah Page Lines"
        onClose={() => setImportOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={handleImport} loading={importing}>
              Import
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            Upload a spreadsheet with columns <code>Sura No</code>, <code>Sura Name</code>, <code>Ayath No</code>,{' '}
            <code>Juzh No</code>, <code>Page No</code>, <code>Line No</code>. Importing replaces the entire existing
            mapping.
          </p>
          <Field label="File (.xlsx)" required>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-card border border-border bg-white px-3 py-2 text-sm text-text-primary file:mr-3 file:rounded-card file:border-0 file:bg-table-alt file:px-3 file:py-1.5 file:text-sm"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
