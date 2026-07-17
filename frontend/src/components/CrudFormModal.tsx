import { useEffect, useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, Input, Textarea } from './ui/Input';
import { Select } from './ui/Select';
import { Checkbox } from './ui/Checkbox';

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { label: string; value: string | number }[];
}

interface CrudFormModalProps {
  open: boolean;
  title: string;
  fields: FieldDef[];
  initialValues?: Record<string, unknown>;
  confirmLoading?: boolean;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}

function emptyValueFor(field: FieldDef): unknown {
  if (field.type === 'checkbox') return false;
  if (field.type === 'number') return '';
  return '';
}

/** Generic add/edit form modal reused across all Configuration CRUD screens. */
export function CrudFormModal({
  open,
  title,
  fields,
  initialValues,
  confirmLoading,
  onCancel,
  onSubmit,
}: CrudFormModalProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const next: Record<string, unknown> = {};
      for (const field of fields) {
        next[field.name] = initialValues?.[field.name] ?? emptyValueFor(field);
      }
      setValues(next);
      setErrors({});
    }
  }, [open, initialValues, fields]);

  const setField = (name: string, value: unknown) => {
    setValues((v) => ({ ...v, [name]: value }));
  };

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required) {
        const v = values[field.name];
        if (v === undefined || v === null || v === '') {
          nextErrors[field.name] = `${field.label} is required`;
        }
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const converted: Record<string, unknown> = { ...values };
    for (const field of fields) {
      if (field.type === 'number' && converted[field.name] !== '') {
        converted[field.name] = Number(converted[field.name]);
      }
    }
    onSubmit(converted);
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={confirmLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={confirmLoading}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {fields.map((field) =>
          field.type === 'checkbox' ? (
            <label key={field.name} className="flex items-center gap-2">
              <Checkbox
                checked={Boolean(values[field.name])}
                onChange={(checked) => setField(field.name, checked)}
              />
              <span className="text-sm text-text-primary">{field.label}</span>
            </label>
          ) : (
            <Field
              key={field.name}
              label={field.label}
              required={field.required}
              error={errors[field.name]}
            >
              {field.type === 'number' && (
                <Input
                  type="number"
                  value={values[field.name] as string | number | undefined ?? ''}
                  onChange={(e) => setField(field.name, e.target.value)}
                />
              )}
              {field.type === 'date' && (
                <Input
                  type="date"
                  value={(values[field.name] as string) ?? ''}
                  onChange={(e) => setField(field.name, e.target.value)}
                />
              )}
              {field.type === 'textarea' && (
                <Textarea
                  rows={3}
                  value={(values[field.name] as string) ?? ''}
                  onChange={(e) => setField(field.name, e.target.value)}
                />
              )}
              {field.type === 'select' && (
                <Select
                  options={field.options ?? []}
                  value={values[field.name] as string | number | undefined ?? ''}
                  onChange={(e) => setField(field.name, e.target.value)}
                />
              )}
              {field.type === 'text' && (
                <Input
                  value={(values[field.name] as string) ?? ''}
                  onChange={(e) => setField(field.name, e.target.value)}
                />
              )}
            </Field>
          ),
        )}
      </div>
    </Modal>
  );
}
