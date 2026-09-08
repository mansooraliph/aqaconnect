import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil } from 'lucide-react';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';
import { DataTable } from './ui/DataTable';
import { CrudFormModal, type FieldDef } from './CrudFormModal';
import { toast } from './ui/toast';

interface CrudPageProps<T extends { id: string }> {
  title: string;
  description?: string;
  data: T[] | undefined;
  loading: boolean;
  columns: ColumnDef<T, unknown>[];
  fields: FieldDef[];
  onCreate: (values: Record<string, unknown>) => Promise<unknown>;
  onUpdate: (id: string, values: Record<string, unknown>) => Promise<unknown>;
  extraActions?: React.ReactNode;
  canManage: boolean;
  /** Hides the header "Add" button/modal-create flow for screens where records are only created via import (e.g. Surahs). */
  hideAddButton?: boolean;
  /** Add/edit form position: 'center' (default) or 'right' (full-height drawer). */
  formPosition?: 'center' | 'right';
}

/**
 * Generic list + add/edit pattern reused across the CRUD-heavy Configuration
 * screens (Academic Classes/Sections, Fee Types, etc.). Screens with real
 * custom behavior (reordering, generation previews) compose this or build
 * their own layout instead of forcing it through here.
 */
export function CrudPage<T extends { id: string }>({
  title,
  description,
  data,
  loading,
  columns,
  fields,
  onCreate,
  onUpdate,
  extraActions,
  canManage,
  hideAddButton = false,
  formPosition = 'center',
}: CrudPageProps<T>) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (record: T) => {
    setEditing(record);
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      if (editing) {
        await onUpdate(editing.id, values);
        toast.success('Updated');
      } else {
        await onCreate(values);
        toast.success('Created');
      }
      setModalOpen(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const allColumns: ColumnDef<T, unknown>[] = canManage
    ? [
        ...columns,
        {
          id: 'actions',
          header: '',
          cell: ({ row }) => (
            <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
          ),
        },
      ]
    : columns;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title}
        actions={
          <>
            {extraActions}
            {canManage && !hideAddButton && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            )}
          </>
        }
        variant="plain"
      />
      {description && <p className="-mt-2 text-sm text-text-muted">{description}</p>}
      <DataTable<T> columns={allColumns} data={data ?? []} isLoading={loading} />
      <CrudFormModal
        open={modalOpen}
        title={editing ? `Edit ${title}` : `Add ${title}`}
        fields={fields}
        initialValues={editing ?? undefined}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        position={formPosition}
      />
    </div>
  );
}
