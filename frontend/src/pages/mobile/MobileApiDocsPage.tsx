import { useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import { ChevronDown, ChevronRight, Search, Play } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Input, Textarea, Field } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils/cn';
import { api } from '../../lib/api';
import { MOBILE_API_CATALOG } from './apiCatalog';
import type { ApiEndpoint, ApiModule, DocsGroup } from './apiCatalog';
import { JsonView } from './JsonView';

const METHOD_STYLE: Record<ApiEndpoint['method'], string> = {
  GET: 'bg-blue-600 text-white',
  POST: 'bg-green-600 text-white',
  PATCH: 'bg-amber-500 text-white',
  DELETE: 'bg-red-600 text-white',
};

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function matches(endpoint: ApiEndpoint, query: string): boolean {
  if (!query) return true;
  const haystack = `${endpoint.method} ${endpoint.path} ${endpoint.summary}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

interface TryResult {
  status: number;
  data: unknown;
}

/** Lets a user fill in a live request for one endpoint and see the actual response, JSON-highlighted. */
function TryItPanel({ endpoint }: { endpoint: ApiEndpoint }) {
  const exampleIsQueryString = endpoint.request?.trim().startsWith('?') ?? false;
  const hasBodyField = Boolean(endpoint.request) && !exampleIsQueryString;

  const [path, setPath] = useState(endpoint.path + (exampleIsQueryString ? (endpoint.request ?? '').trim() : ''));
  const [body, setBody] = useState(hasBodyField ? formatJson(endpoint.request ?? '') : '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    let data: unknown;
    if (hasBodyField && body.trim()) {
      try {
        data = JSON.parse(body);
      } catch {
        setError('Request body is not valid JSON.');
        setResult(null);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await api.request({ method: endpoint.method, url: path, data });
      setResult({ status: response.status, data: response.data });
    } catch (err) {
      const axiosError = err as AxiosError;
      if (axiosError.response) {
        setResult({ status: axiosError.response.status, data: axiosError.response.data });
      } else {
        setError(axiosError.message || 'Request failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">Try it</p>

      <Field label="Path" hint="Replace any :param placeholders (and query string) with real values.">
        <Input value={path} onChange={(e) => setPath(e.target.value)} className="font-mono text-xs" />
      </Field>

      {hasBodyField && (
        <Field label="Request body (JSON)">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={Math.min(12, Math.max(4, body.split('\n').length))}
            className="font-mono text-xs"
          />
        </Field>
      )}

      <div>
        <Button size="sm" onClick={onSubmit} loading={loading}>
          <Play className="h-3.5 w-3.5" />
          Send request
        </Button>
      </div>

      {error && <p className="text-xs text-red">{error}</p>}

      {result && (
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">Response</p>
            <Badge tone={result.status < 300 ? 'green' : result.status < 500 ? 'amber' : 'red'}>{result.status}</Badge>
          </div>
          <JsonView value={result.data} />
        </div>
      )}
    </div>
  );
}

/**
 * The catalog also carries permission-only entries (no documented
 * endpoints) added purely for the Mobile Permissions role-edit modal's
 * checklist — e.g. "Add Halqa", "Mark Attendance". Those aren't real API
 * modules, so the docs page excludes anything with an empty endpoints list.
 */
const DOCUMENTED_MODULES = MOBILE_API_CATALOG.filter((m) => m.endpoints.length > 0);

const DOCS_GROUP_ORDER: DocsGroup[] = [
  'Core',
  'Academic',
  'Halqa & Teachers',
  'Students',
  'HR & Attendance',
  'Dashboard & Profile',
];

const modulesByGroup = new Map<DocsGroup, ApiModule[]>();
for (const group of DOCS_GROUP_ORDER) modulesByGroup.set(group, []);
for (const mod of DOCUMENTED_MODULES) {
  const group = mod.docsGroup ?? 'Core';
  modulesByGroup.get(group)!.push(mod);
}

export function MobileApiDocsPage() {
  const [search, setSearch] = useState('');
  const [activeKey, setActiveKey] = useState(DOCUMENTED_MODULES[0]?.key ?? '');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const activeModule = DOCUMENTED_MODULES.find((m) => m.key === activeKey) ?? DOCUMENTED_MODULES[0];

  const filteredEndpoints = useMemo(
    () => (activeModule ? activeModule.endpoints.filter((e) => matches(e, search)) : []),
    [activeModule, search],
  );

  const totalEndpoints = useMemo(() => DOCUMENTED_MODULES.reduce((sum, m) => sum + m.endpoints.length, 0), []);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Mobile API Documentation" variant="plain" />
      <p className="-mt-2 text-sm text-text-muted">
        Reference for the legacy-mirroring Mobile App API — {DOCUMENTED_MODULES.length} modules,{' '}
        {totalEndpoints} endpoints. All routes are under <code className="rounded bg-table-alt px-1 py-0.5">/api</code>{' '}
        and require a Bearer token, same as the rest of this API.
      </p>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
        <Input
          placeholder="Search endpoints..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
        {DOCS_GROUP_ORDER.flatMap((group) => modulesByGroup.get(group) ?? []).map((mod) => {
          const isActive = mod.key === activeKey;
          return (
            <button
              key={mod.key}
              onClick={() => setActiveKey(mod.key)}
              className={cn(
                'flex items-center gap-2 rounded-card px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue text-white'
                  : 'bg-table-alt text-text-muted hover:text-text-primary',
              )}
            >
              {mod.label}
              <Badge tone={isActive ? 'purple' : 'gray'}>{mod.endpoints.length}</Badge>
            </button>
          );
        })}
      </div>

      {activeModule && (
        <>
          <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">{activeModule.label}</p>
              <p className="text-xs text-text-muted">{activeModule.description}</p>
            </div>
            <code className="shrink-0 text-xs text-text-faint">{activeModule.basePath}</code>
          </div>

          <div className="flex flex-col gap-2">
            {filteredEndpoints.map((ep) => {
              const id = `${ep.method}-${ep.path}`;
              const isOpen = expanded.has(id);
              return (
                <div key={id} className="overflow-hidden rounded-card border border-border bg-white">
                  <button
                    onClick={() => toggle(id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-table-alt"
                  >
                    {isOpen ? (
                      <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-text-faint" />
                    ) : (
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-text-faint" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold',
                            METHOD_STYLE[ep.method],
                          )}
                        >
                          {ep.method}
                        </span>
                        <code className="break-all font-mono text-sm font-semibold text-text-primary">{ep.path}</code>
                        {ep.legacyNumbers && ep.legacyNumbers.length > 0 && (
                          <Badge tone="gray">{ep.legacyNumbers.map((n) => `#${n}`).join(', ')}</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-text-muted">{ep.summary}</p>
                    </div>
                  </button>

                  {isOpen && (
                    <>
                      {(ep.request || ep.response) && (
                        <div
                          className={cn(
                            'grid grid-cols-1 gap-3 border-t border-border bg-table-alt/40 p-4',
                            ep.request && ep.response && 'sm:grid-cols-2',
                          )}
                        >
                          {ep.request && (
                            <div className="min-w-0">
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-faint">Request</p>
                              <pre className="overflow-x-auto rounded-card border border-border bg-table-alt px-3 py-2 text-xs text-text-primary">
                                <code>{formatJson(ep.request)}</code>
                              </pre>
                            </div>
                          )}
                          {ep.response && (
                            <div className="min-w-0">
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-faint">Response</p>
                              <pre className="overflow-x-auto rounded-card border border-border bg-table-alt px-3 py-2 text-xs text-text-primary">
                                <code>{formatJson(ep.response)}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                      <TryItPanel endpoint={ep} />
                    </>
                  )}
                </div>
              );
            })}

            {filteredEndpoints.length === 0 && (
              <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-text-muted">
                No endpoints match "{search}".
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
