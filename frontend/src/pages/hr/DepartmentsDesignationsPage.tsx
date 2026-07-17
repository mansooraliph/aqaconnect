import { useState } from 'react';
import { Pencil, Plus, ArrowLeftRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../components/ui/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { cn } from '../../lib/utils/cn';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { api } from '../../lib/api';
import { CrudFormModal, type FieldDef } from '../../components/CrudFormModal';

interface OrgUnit {
  id: string;
  name: string;
  parentId: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

interface OrgUnitTreeProps {
  /** REST path segment under /branches/:branchId/<path>, e.g. "departments" */
  path: string;
  viewPermission: string;
  managePermission: string;
}

interface TreeNode {
  item: OrgUnit;
  children: TreeNode[];
}

function buildTree(items: OrgUnit[], parentId: string | null): TreeNode[] {
  return items
    .filter((item) => item.parentId === parentId)
    .map((item) => ({
      item,
      children: buildTree(items, item.id),
    }));
}

const FIELDS: FieldDef[] = [{ name: 'name', label: 'Name', type: 'text', required: true }];

function OrgUnitTreeNodeRow({
  node,
  depth,
  canManage,
  onEdit,
  onChangeParent,
}: {
  node: TreeNode;
  depth: number;
  canManage: boolean;
  onEdit: (item: OrgUnit) => void;
  onChangeParent: (item: OrgUnit) => void;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-card py-1.5 hover:bg-bg-page"
        style={{ paddingLeft: depth * 24 }}
      >
        <span className="text-sm text-text-primary">{node.item.name}</span>
        <Badge tone={node.item.status === 'ACTIVE' ? 'green' : 'gray'}>{node.item.status}</Badge>
        {canManage && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(node.item);
              }}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Change parent"
              onClick={(e) => {
                e.stopPropagation();
                onChangeParent(node.item);
              }}
            >
              <ArrowLeftRight size={14} />
            </Button>
          </div>
        )}
      </div>
      {node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <OrgUnitTreeNodeRow
              key={child.item.id}
              node={child}
              depth={depth + 1}
              canManage={canManage}
              onEdit={onEdit}
              onChangeParent={onChangeParent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Shared tree view for Departments/Designations — both are branch-scoped,
 * flat lists with an optional `parentId`, so the hierarchy is built client-side
 * and rendered as a simple indented tree (a more natural fit than a table for
 * arbitrary-depth hierarchies).
 */
function OrgUnitTree({ path, viewPermission, managePermission }: OrgUnitTreeProps) {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission(viewPermission);
  const canManage = hasPermission(managePermission);

  const { list, create, update } = useBranchResource<OrgUnit>(activeBranchId, path);
  const items = list.data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrgUnit | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [parentModalOpen, setParentModalOpen] = useState(false);
  const [movingItem, setMovingItem] = useState<OrgUnit | null>(null);
  const [movingSubmitting, setMovingSubmitting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (item: OrgUnit) => {
    setEditing(item);
    setModalOpen(true);
  };

  const openChangeParent = (item: OrgUnit) => {
    setMovingItem(item);
    setParentModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, payload: values });
        toast.success('Updated');
      } else {
        await create.mutateAsync(values);
        toast.success('Created');
      }
      setModalOpen(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeParent = async (values: Record<string, unknown>) => {
    if (!movingItem) return;
    setMovingSubmitting(true);
    try {
      await api.post(`/branches/${activeBranchId}/${path}/${movingItem.id}/change-parent`, {
        parentId: values.parentId ?? null,
      });
      toast.success('Parent updated');
      setParentModalOpen(false);
      list.refetch();
    } catch (err) {
      const responseMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(responseMessage ?? 'Failed to change parent');
    } finally {
      setMovingSubmitting(false);
    }
  };

  const parentOptions = items
    .filter((item) => item.id !== editing?.id)
    .map((item) => ({ label: item.name, value: item.id }));

  const editFields: FieldDef[] = editing
    ? [...FIELDS, { name: 'status', label: 'Status', type: 'select', required: true, options: [
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Inactive', value: 'INACTIVE' },
      ] }]
    : [...FIELDS, { name: 'parentId', label: 'Parent', type: 'select', options: parentOptions }];

  const changeParentFields: FieldDef[] = [
    {
      name: 'parentId',
      label: 'New parent',
      type: 'select',
      options: items
        .filter((item) => item.id !== movingItem?.id)
        .map((item) => ({ label: item.name, value: item.id })),
    },
  ];

  const treeData = buildTree(items, null);

  if (!canView) {
    return (
      <div className="rounded-card border border-border bg-white p-8 text-center text-sm text-text-muted">
        You do not have permission to view this
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border bg-white p-5">
      <div className="mb-3 flex items-center justify-end">
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} />
            Add
          </Button>
        )}
      </div>
      {treeData.length > 0 ? (
        <div>
          {treeData.map((node) => (
            <OrgUnitTreeNodeRow
              key={node.item.id}
              node={node}
              depth={0}
              canManage={canManage}
              onEdit={openEdit}
              onChangeParent={openChangeParent}
            />
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-text-muted">No records yet</div>
      )}
      <CrudFormModal
        open={modalOpen}
        title={editing ? 'Edit' : 'Add'}
        fields={editFields}
        initialValues={editing ? (editing as unknown as Record<string, unknown>) : undefined}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
      <CrudFormModal
        open={parentModalOpen}
        title="Change parent"
        fields={changeParentFields}
        initialValues={movingItem ? { parentId: movingItem.parentId ?? undefined } : undefined}
        confirmLoading={movingSubmitting}
        onCancel={() => setParentModalOpen(false)}
        onSubmit={handleChangeParent}
      />
    </div>
  );
}

const TABS = [
  {
    key: 'departments',
    label: 'Departments',
    path: 'departments',
    viewPermission: 'hr.departments.view',
    managePermission: 'hr.departments.manage',
  },
  {
    key: 'designations',
    label: 'Designations',
    path: 'designations',
    viewPermission: 'hr.designations.view',
    managePermission: 'hr.designations.manage',
  },
] as const;

export function DepartmentsDesignationsPage() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['key']>('departments');

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Departments & Designations" variant="plain" />
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'border-blue text-blue'
                : 'border-transparent text-text-muted hover:text-text-primary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {TABS.map((tab) =>
        tab.key === activeTab ? (
          <OrgUnitTree
            key={tab.key}
            path={tab.path}
            viewPermission={tab.viewPermission}
            managePermission={tab.managePermission}
          />
        ) : null,
      )}
    </div>
  );
}
