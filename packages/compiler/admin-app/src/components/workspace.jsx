import React, { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  __experimentalToggleGroupControl as ToggleGroupControl,
  __experimentalToggleGroupControlOption as ToggleGroupControlOption,
  Button,
  Card,
  CardBody,
  CardHeader,
  Modal,
  SelectControl,
  Spinner,
  TextControl,
} from '@wordpress/components';
import { DataViews, filterSortAndPaginate } from '@wordpress/dataviews';
import {
  Add,
  CheckmarkFilled,
  Close,
  Copy,
  Debug,
  Email,
  Integration,
  Locked,
  Renew,
  Search,
  WarningAlt,
} from '@carbon/icons-react';
import { runtimeConfig } from '../lib/config.js';
import { apiFetch, toTitleCase } from '../lib/helpers.js';
import { SkeletonBox } from './skeletons.jsx';

/* ── Domains Page ── */
export function DomainsPage({ bootstrap, pushNotice }) {
  const siteName = bootstrap?.site?.title || 'my-site';
  const slugifiedName = siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [primaryDomain, setPrimaryDomain] = useState(`${slugifiedName}.wplite.app`);
  const [connectedDomains, setConnectedDomains] = useState([
    {
      id: `${slugifiedName}.wplite.app`,
      domain: `${slugifiedName}.wplite.app`,
      type: 'default',
      ssl: true,
      status: 'active',
      isPrimary: true,
      connectedAt: '2026-01-01',
    },
  ]);
  const [dnsOpenFor, setDnsOpenFor] = useState(null);
  const [isAddDomainOpen, setIsAddDomainOpen] = useState(false);

  function handleSearch() {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const query = searchQuery.trim().replace(/\s+/g, '').toLowerCase();
    const baseName = query.replace(/\.(com|net|org|io|dev|co|app|site|blog|xyz)$/, '');

    setTimeout(() => {
      setSearchResults([
        { domain: `${baseName}.com`, available: Math.random() > 0.4, price: '$12.99/yr' },
        { domain: `${baseName}.io`, available: true, price: '$39.99/yr' },
        { domain: `${baseName}.dev`, available: true, price: '$14.99/yr' },
        { domain: `${baseName}.co`, available: Math.random() > 0.5, price: '$29.99/yr' },
        { domain: `${baseName}.app`, available: true, price: '$16.99/yr' },
        { domain: `${baseName}.site`, available: true, price: '$3.99/yr' },
        { domain: `${baseName}.blog`, available: true, price: '$3.99/yr' },
        { domain: `${baseName}.org`, available: Math.random() > 0.3, price: '$10.99/yr' },
      ]);
      setIsSearching(false);
    }, 800);
  }

  function handleRegister(result) {
    const newDomain = {
      id: result.domain,
      domain: result.domain,
      type: 'registered',
      ssl: true,
      status: 'provisioning',
      isPrimary: false,
      connectedAt: new Date().toISOString().split('T')[0],
    };
    setConnectedDomains((prev) => [...prev, newDomain]);
    setSearchResults((prev) => prev.filter((r) => r.domain !== result.domain));
    pushNotice({ status: 'success', message: `${result.domain} is being registered — DNS may take a few minutes.` });

    setTimeout(() => {
      setConnectedDomains((prev) =>
        prev.map((d) => d.domain === result.domain ? { ...d, status: 'active' } : d)
      );
    }, 3000);
  }

  function handleSetPrimary(domain) {
    setPrimaryDomain(domain);
    setConnectedDomains((prev) =>
      prev.map((d) => ({ ...d, isPrimary: d.domain === domain }))
    );
    pushNotice({ status: 'success', message: `${domain} is now your primary domain.` });
  }

  function handleRemoveDomain(domain) {
    setConnectedDomains((prev) => prev.filter((d) => d.domain !== domain));
    pushNotice({ status: 'info', message: `${domain} has been disconnected.` });
  }

  const fields = useMemo(() => [
    {
      id: 'domain',
      label: 'Domain',
      enableGlobalSearch: true,
      enableSorting: true,
      enableHiding: false,
      getValue: ({ item }) => item.domain,
      render: ({ item }) => (
        <div className="domain-cell">
          <strong className="row-title">{item.domain}</strong>
          {item.isPrimary && <span className="status-badge status-badge--publish">Primary</span>}
        </div>
      ),
    },
    {
      id: 'type',
      label: 'Type',
      type: 'text',
      enableSorting: true,
      elements: [
        { value: 'default', label: 'Default' },
        { value: 'registered', label: 'Registered' },
        { value: 'mapped', label: 'Mapped' },
      ],
      filterBy: {},
      getValue: ({ item }) => item.type,
      render: ({ item }) => <span className="domain-type-cell">{toTitleCase(item.type)}</span>,
    },
    {
      id: 'ssl',
      label: 'SSL',
      enableSorting: false,
      getValue: ({ item }) => (item.ssl ? 'Active' : '—'),
      render: ({ item }) => item.ssl ? (
        <span className="domain-ssl-cell"><Locked size={16} /> Active</span>
      ) : (
        <span className="domain-ssl-cell domain-ssl-cell--none">—</span>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      type: 'text',
      enableSorting: true,
      elements: [
        { value: 'active', label: 'Active' },
        { value: 'provisioning', label: 'Provisioning' },
        { value: 'error', label: 'Error' },
      ],
      filterBy: {},
      getValue: ({ item }) => item.status,
      render: ({ item }) => {
        if (item.status === 'active') {
          return <span className="domain-status domain-status--active"><CheckmarkFilled size={14} /> Active</span>;
        }
        if (item.status === 'provisioning') {
          return <span className="domain-status domain-status--pending"><Spinner className="domain-status__spinner" /> Provisioning</span>;
        }
        if (item.status === 'error') {
          return <span className="domain-status domain-status--error"><WarningAlt size={14} /> Error</span>;
        }
        return <span>{item.status}</span>;
      },
    },
    {
      id: 'connectedAt',
      label: 'Connected',
      type: 'datetime',
      enableSorting: true,
      getValue: ({ item }) => item.connectedAt,
    },
  ], []);

  const actions = useMemo(() => [
    {
      id: 'set-primary',
      label: 'Set primary',
      isPrimary: false,
      isEligible: (item) => !item.isPrimary && item.status === 'active',
      callback: (items) => handleSetPrimary(items[0].domain),
    },
    {
      id: 'view-dns',
      label: 'View DNS',
      isPrimary: true,
      callback: (items) => setDnsOpenFor(items[0].domain),
    },
    {
      id: 'disconnect',
      label: 'Disconnect',
      isPrimary: false,
      isEligible: (item) => item.type !== 'default',
      callback: (items) => handleRemoveDomain(items[0].domain),
    },
  ], []);

  const [view, setView] = useState({
    type: 'table',
    perPage: 20,
    page: 1,
    sort: { field: 'domain', direction: 'asc' },
    fields: ['type', 'ssl', 'status', 'connectedAt'],
    titleField: 'domain',
    layout: {},
    filters: [],
    search: '',
  });

  const deferredDomains = useDeferredValue(connectedDomains);
  const processed = useMemo(
    () => filterSortAndPaginate(deferredDomains, view, fields),
    [deferredDomains, view, fields]
  );

  const dnsDomain = connectedDomains.find((d) => d.domain === dnsOpenFor);

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Domains</h1>
          <p className="screen-header__lede">
            Connect a custom domain to this site.
          </p>
        </div>
        <div className="screen-header__actions">
          <Button
            variant="primary"
            icon={<Add size={16} />}
            onClick={() => setIsAddDomainOpen(true)}
          >
            Add domain
          </Button>
        </div>
      </header>

      <Card className="surface-card">
        <CardHeader><h2>Connected Domains</h2></CardHeader>
        <CardBody>
          <DataViews
            data={processed.data}
            fields={fields}
            view={view}
            onChangeView={setView}
            getItemId={(item) => item.id}
            paginationInfo={processed.paginationInfo}
            actions={actions}
            defaultLayouts={{ table: {} }}
            search
            empty={
              <div className="empty-state">
                <h2>No connected domains</h2>
                <p>Register or map a domain to get started.</p>
              </div>
            }
          >
            <div className="dataviews-shell">
              <div className="dataviews-toolbar">
                <DataViews.Search label="Search domains" />
                <DataViews.FiltersToggle />
                <div className="dataviews-toolbar__spacer" />
                <DataViews.ViewConfig />
              </div>
              <DataViews.FiltersToggled />
              <DataViews.Layout className="dataviews-layout" />
              <div className="dataviews-footer">
                <span>{processed.paginationInfo.totalItems} domains</span>
                <DataViews.Pagination />
              </div>
            </div>
          </DataViews>
        </CardBody>
      </Card>

      {dnsDomain && (
        <Card className="surface-card">
          <CardHeader>
            <h2>DNS Records — {dnsDomain.domain}</h2>
            <Button variant="tertiary" size="compact" onClick={() => setDnsOpenFor(null)}>Close</Button>
          </CardHeader>
          <CardBody>
            <div className="dns-panel">
              <p className="field-hint">Point your domain to this site by adding these records at your registrar.</p>
              <table className="dns-records-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Value</th>
                    <th>TTL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>A</code></td>
                    <td><code>@</code></td>
                    <td><code>76.76.21.21</code></td>
                    <td>3600</td>
                  </tr>
                  <tr>
                    <td><code>CNAME</code></td>
                    <td><code>www</code></td>
                    <td><code>cname.wplite.app</code></td>
                    <td>3600</td>
                  </tr>
                  <tr>
                    <td><code>TXT</code></td>
                    <td><code>@</code></td>
                    <td><code>wplite-verify={slugifiedName}</code></td>
                    <td>3600</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {isAddDomainOpen && (
        <Modal
          title="Add a domain"
          onRequestClose={() => setIsAddDomainOpen(false)}
          className="domain-add-modal"
          size="medium"
        >
          <div className="domain-search-row">
            <TextControl
              placeholder="Search for a domain name..."
              value={searchQuery}
              onChange={setSearchQuery}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              __next40pxDefaultSize
              __nextHasNoMarginBottom
            />
            <Button
              variant="primary"
              icon={<Search size={16} />}
              isBusy={isSearching}
              onClick={handleSearch}
            >
              Search
            </Button>
          </div>

          {searchResults && (
            <div className="domain-results">
              {searchResults.map((result) => (
                <div key={result.domain} className={`domain-result ${result.available ? '' : 'is-unavailable'}`}>
                  <div className="domain-result__info">
                    <span className="domain-result__name">{result.domain}</span>
                    {result.available ? (
                      <span className="domain-result__badge domain-result__badge--available">Available</span>
                    ) : (
                      <span className="domain-result__badge domain-result__badge--taken">Taken</span>
                    )}
                  </div>
                  <div className="domain-result__actions">
                    <span className="domain-result__price">{result.price}</span>
                    {result.available && (
                      <Button
                        variant="primary"
                        size="compact"
                        onClick={() => {
                          handleRegister(result);
                          setIsAddDomainOpen(false);
                        }}
                      >
                        Register
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ── API Page ── */
export function ApiPage({ bootstrap }) {
  const models = bootstrap?.models ?? [];
  const singletons = bootstrap?.singletons ?? [];
  const [appPassword, setAppPassword] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(models[0]?.id ?? singletons[0]?.id ?? '');
  const [language, setLanguage] = useState('javascript');
  const [copied, setCopied] = useState(null);
  const siteUrl = window.location.origin;

  useEffect(() => {
    let cancelled = false;
    async function loadPassword() {
      try {
        const data = await apiFetch('app-password');
        if (!cancelled && data.password) {
          setAppPassword(data.password);
        }
      } catch {}
    }
    loadPassword();
    return () => { cancelled = true; };
  }, []);

  async function generatePassword() {
    setIsGenerating(true);
    try {
      const data = await apiFetch('app-password', { method: 'POST' });
      if (data.password) {
        setAppPassword(data.password);
      }
    } catch (err) {
      console.error('Failed to generate app password:', err);
    }
    setIsGenerating(false);
  }

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const selectedModel = models.find((m) => m.id === selectedEntity);
  const selectedSingleton = singletons.find((s) => s.id === selectedEntity);
  const isCollection = !!selectedModel;
  const entityLabel = selectedModel?.label || selectedSingleton?.label || selectedEntity;
  const singularLabel = selectedModel?.singularLabel || entityLabel;
  const authPlaceholder = appPassword || 'YOUR_APP_PASSWORD';
  const username = runtimeConfig.currentUser ?? 'admin';

  function getFields(entity) {
    if (!entity?.fields) return [];
    return Object.entries(entity.fields).map(([id, field]) => ({
      id,
      type: field.type || 'text',
      label: field.label || toTitleCase(id),
    }));
  }

  const fields = getFields(selectedModel || selectedSingleton);

  function generateReadSnippet() {
    if (language === 'javascript') {
      if (isCollection) {
        return `// Fetch all ${entityLabel}
async function fetch${toTitleCase(selectedEntity).replace(/\s/g, '')}() {
  const response = await fetch('${siteUrl}/wp-json/portfolio/v1/collection/${selectedEntity}', {
    headers: {
      'Authorization': 'Basic ' + btoa('${username}:${authPlaceholder}'),
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  console.log(data.items);
  return data.items;
}`;
      }
      return `// Fetch ${entityLabel} settings
async function fetch${toTitleCase(selectedEntity).replace(/\s/g, '')}() {
  const response = await fetch('${siteUrl}/wp-json/portfolio/v1/singleton/${selectedEntity}', {
    headers: {
      'Authorization': 'Basic ' + btoa('${username}:${authPlaceholder}'),
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  console.log(data.item);
  return data.item;
}`;
    }
    if (isCollection) {
      return `# Fetch all ${entityLabel}
import requests
from requests.auth import HTTPBasicAuth

def fetch_${selectedEntity}():
    response = requests.get(
        '${siteUrl}/wp-json/portfolio/v1/collection/${selectedEntity}',
        auth=HTTPBasicAuth('${username}', '${authPlaceholder}')
    )
    data = response.json()
    print(data['items'])
    return data['items']`;
    }
    return `# Fetch ${entityLabel} settings
import requests
from requests.auth import HTTPBasicAuth

def fetch_${selectedEntity}():
    response = requests.get(
        '${siteUrl}/wp-json/portfolio/v1/singleton/${selectedEntity}',
        auth=HTTPBasicAuth('${username}', '${authPlaceholder}')
    )
    data = response.json()
    print(data['item'])
    return data['item']`;
  }

  function generateWriteSnippet() {
    const fieldEntries = fields.slice(0, 3);
    if (language === 'javascript') {
      if (isCollection) {
        const bodyFields = [
          `    title: 'New ${singularLabel}'`,
          ...fieldEntries.map((f) => `    ${f.id}: ${f.type === 'boolean' ? 'true' : f.type === 'integer' ? '0' : `'...'`}`),
        ].join(',\n');
        return `// Create or update a ${singularLabel}
async function update${toTitleCase(selectedEntity).replace(/\s/g, '')}(id, updateData) {
  const url = id
    ? '${siteUrl}/wp-json/portfolio/v1/collection/${selectedEntity}/' + id
    : '${siteUrl}/wp-json/portfolio/v1/collection/${selectedEntity}';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa('${username}:${authPlaceholder}'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData ?? {
${bodyFields}
    })
  });
  const data = await response.json();
  return data.item;
}`;
      }
      const bodyFields = fieldEntries.map(
        (f) => `    ${f.id}: ${f.type === 'boolean' ? 'true' : f.type === 'integer' ? '0' : `'...'`}`
      ).join(',\n');
      return `// Update ${entityLabel} settings
async function update${toTitleCase(selectedEntity).replace(/\s/g, '')}(updateData) {
  const response = await fetch('${siteUrl}/wp-json/portfolio/v1/singleton/${selectedEntity}', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa('${username}:${authPlaceholder}'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData ?? {
${bodyFields}
    })
  });
  const data = await response.json();
  return data.item;
}`;
    }
    if (isCollection) {
      const bodyFields = [
        `        'title': 'New ${singularLabel}'`,
        ...fieldEntries.map((f) => `        '${f.id}': ${f.type === 'boolean' ? 'True' : f.type === 'integer' ? '0' : `'...'`}`),
      ].join(',\n');
      return `# Create or update a ${singularLabel}
import requests
from requests.auth import HTTPBasicAuth

def update_${selectedEntity}(entity_id=None, update_data=None):
    url = f'${siteUrl}/wp-json/portfolio/v1/collection/${selectedEntity}/{entity_id}' \\
        if entity_id else '${siteUrl}/wp-json/portfolio/v1/collection/${selectedEntity}'
    payload = update_data or {
${bodyFields}
    }
    response = requests.post(
        url,
        json=payload,
        auth=HTTPBasicAuth('${username}', '${authPlaceholder}')
    )
    return response.json()['item']`;
    }
    const bodyFields = fieldEntries.map(
      (f) => `        '${f.id}': ${f.type === 'boolean' ? 'True' : f.type === 'integer' ? '0' : `'...'`}`
    ).join(',\n');
    return `# Update ${entityLabel} settings
import requests
from requests.auth import HTTPBasicAuth

def update_${selectedEntity}(update_data=None):
    payload = update_data or {
${bodyFields}
    }
    response = requests.post(
        '${siteUrl}/wp-json/portfolio/v1/singleton/${selectedEntity}',
        json=payload,
        auth=HTTPBasicAuth('${username}', '${authPlaceholder}')
    )
    return response.json()['item']`;
  }

  function generateDeleteSnippet() {
    if (!isCollection) return null;
    if (language === 'javascript') {
      return `// Delete a ${singularLabel}
async function delete${toTitleCase(selectedEntity).replace(/\s/g, '')}(id) {
  const response = await fetch(
    '${siteUrl}/wp-json/portfolio/v1/collection/${selectedEntity}/' + id,
    {
      method: 'DELETE',
      headers: {
        'Authorization': 'Basic ' + btoa('${username}:${authPlaceholder}')
      }
    }
  );
  return response.json();
}`;
    }
    return `# Delete a ${singularLabel}
import requests
from requests.auth import HTTPBasicAuth

def delete_${selectedEntity}(entity_id):
    response = requests.delete(
        f'${siteUrl}/wp-json/portfolio/v1/collection/${selectedEntity}/{entity_id}',
        auth=HTTPBasicAuth('${username}', '${authPlaceholder}')
    )
    return response.json()`;
  }

  const readSnippet = generateReadSnippet();
  const writeSnippet = generateWriteSnippet();
  const deleteSnippet = generateDeleteSnippet();

  const entityOptions = [
    ...models.map((m) => ({ label: `${m.label} (collection)`, value: m.id })),
    ...singletons.map((s) => ({ label: `${s.label} (singleton)`, value: s.id })),
  ];

  // Endpoints table → DataViews (static).
  const endpointRows = useMemo(() => {
    const rows = [];
    rows.push({
      id: 'bootstrap',
      method: 'GET',
      path: '/wp-json/portfolio/v1/bootstrap',
      description: 'Full app state (models, records, settings)',
      resource: 'core',
    });
    models.forEach((m) => {
      const singular = m.singularLabel?.toLowerCase() || m.id;
      rows.push(
        { id: `coll-list-${m.id}`, method: 'GET', path: `/wp-json/portfolio/v1/collection/${m.id}`, description: `List all ${m.label.toLowerCase()}`, resource: m.label },
        { id: `coll-create-${m.id}`, method: 'POST', path: `/wp-json/portfolio/v1/collection/${m.id}`, description: `Create ${singular}`, resource: m.label },
        { id: `coll-get-${m.id}`, method: 'GET', path: `/wp-json/portfolio/v1/collection/${m.id}/:id`, description: `Get single ${singular}`, resource: m.label },
        { id: `coll-upd-${m.id}`, method: 'POST', path: `/wp-json/portfolio/v1/collection/${m.id}/:id`, description: `Update ${singular}`, resource: m.label },
        { id: `coll-del-${m.id}`, method: 'DELETE', path: `/wp-json/portfolio/v1/collection/${m.id}/:id`, description: `Delete ${singular}`, resource: m.label },
      );
    });
    singletons.forEach((s) => {
      rows.push(
        { id: `sing-get-${s.id}`, method: 'GET', path: `/wp-json/portfolio/v1/singleton/${s.id}`, description: `Get ${s.label.toLowerCase()} settings`, resource: s.label },
        { id: `sing-upd-${s.id}`, method: 'POST', path: `/wp-json/portfolio/v1/singleton/${s.id}`, description: `Update ${s.label.toLowerCase()} settings`, resource: s.label },
      );
    });
    return rows;
  }, [models, singletons]);

  const resourceElements = useMemo(() => {
    const set = new Set();
    set.add('core');
    models.forEach((m) => set.add(m.label));
    singletons.forEach((s) => set.add(s.label));
    return Array.from(set).map((v) => ({ value: v, label: v }));
  }, [models, singletons]);

  const endpointFields = useMemo(() => [
    {
      id: 'method',
      label: 'Method',
      type: 'text',
      enableSorting: true,
      elements: [
        { value: 'GET', label: 'GET' },
        { value: 'POST', label: 'POST' },
        { value: 'DELETE', label: 'DELETE' },
      ],
      filterBy: {},
      getValue: ({ item }) => item.method,
      render: ({ item }) => (
        <span className={`api-method api-method--${item.method.toLowerCase()}`}>{item.method}</span>
      ),
    },
    {
      id: 'path',
      label: 'Endpoint',
      enableGlobalSearch: true,
      enableSorting: false,
      getValue: ({ item }) => item.path,
      render: ({ item }) => <code>{item.path}</code>,
    },
    {
      id: 'description',
      label: 'Description',
      enableGlobalSearch: true,
      getValue: ({ item }) => item.description,
    },
    {
      id: 'resource',
      label: 'Resource',
      type: 'text',
      enableSorting: true,
      filterBy: {},
      elements: resourceElements,
      getValue: ({ item }) => item.resource,
    },
  ], [resourceElements]);

  const [endpointView, setEndpointView] = useState({
    type: 'table',
    perPage: 50,
    page: 1,
    sort: { field: 'method', direction: 'asc' },
    fields: ['method', 'path', 'description', 'resource'],
    layout: {},
    filters: [],
    search: '',
  });

  const endpointProcessed = useMemo(
    () => filterSortAndPaginate(endpointRows, endpointView, endpointFields),
    [endpointRows, endpointView, endpointFields]
  );

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>API</h1>
          <p className="screen-header__lede">
            Copy-paste code examples for integrating with your site's REST API.
          </p>
        </div>
      </header>

      <Card className="surface-card">
        <CardHeader><h2>Authentication</h2></CardHeader>
        <CardBody>
          <p className="field-hint api-auth__hint">
            Use an application password to authenticate API requests. This password is scoped to your user account.
          </p>
          <div className="api-auth-row">
            <div className="api-password-display">
              <code className="api-password-value">
                {appPassword ? `${username}:${appPassword}` : 'No password generated yet'}
              </code>
              {appPassword && (
                <Button
                  variant="tertiary"
                  size="compact"
                  icon={<Copy size={16} />}
                  label="Copy credentials"
                  onClick={() => copyToClipboard(`${username}:${appPassword}`, 'auth')}
                >
                  {copied === 'auth' ? 'Copied' : 'Copy'}
                </Button>
              )}
            </div>
            <Button
              variant="secondary"
              icon={<Renew size={16} />}
              isBusy={isGenerating}
              onClick={generatePassword}
            >
              {appPassword ? 'Regenerate' : 'Generate Password'}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="surface-card">
        <CardHeader><h2>API Operations</h2></CardHeader>
        <CardBody>
          <div className="api-operations-controls">
            <SelectControl
              label="Entity"
              hideLabelFromVision
              value={selectedEntity}
              options={entityOptions}
              onChange={setSelectedEntity}
              __next40pxDefaultSize
              __nextHasNoMarginBottom
            />
            <ToggleGroupControl
              label="Language"
              hideLabelFromVision
              value={language}
              onChange={(v) => v && setLanguage(v)}
              isBlock
              __next40pxDefaultSize
              __nextHasNoMarginBottom
            >
              <ToggleGroupControlOption value="javascript" label="JavaScript" />
              <ToggleGroupControlOption value="python" label="Python" />
            </ToggleGroupControl>
          </div>

          <div className="api-operations-body">
            {fields.length > 0 && (
              <div className="api-fields-ref">
                <strong>Available fields:</strong>{' '}
                <span>{fields.map((f) => f.id).join(', ')}</span>
              </div>
            )}

            <div className="api-snippet-group">
              <div className="api-snippet-header">
                <h3>Read</h3>
                <Button
                  variant="tertiary"
                  size="compact"
                  icon={<Copy size={16} />}
                  onClick={() => copyToClipboard(readSnippet, 'read')}
                >
                  {copied === 'read' ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <pre className="api-code-block"><code>{readSnippet}</code></pre>
            </div>

            <div className="api-snippet-group">
              <div className="api-snippet-header">
                <h3>Write</h3>
                <Button
                  variant="tertiary"
                  size="compact"
                  icon={<Copy size={16} />}
                  onClick={() => copyToClipboard(writeSnippet, 'write')}
                >
                  {copied === 'write' ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <pre className="api-code-block"><code>{writeSnippet}</code></pre>
            </div>

            {deleteSnippet && (
              <div className="api-snippet-group">
                <div className="api-snippet-header">
                  <h3>Delete</h3>
                  <Button
                    variant="tertiary"
                    size="compact"
                    icon={<Copy size={16} />}
                    onClick={() => copyToClipboard(deleteSnippet, 'delete')}
                  >
                    {copied === 'delete' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <pre className="api-code-block"><code>{deleteSnippet}</code></pre>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Card className="surface-card">
        <CardHeader><h2>Endpoints Reference</h2></CardHeader>
        <CardBody>
          <DataViews
            data={endpointProcessed.data}
            fields={endpointFields}
            view={endpointView}
            onChangeView={setEndpointView}
            getItemId={(item) => item.id}
            paginationInfo={endpointProcessed.paginationInfo}
            defaultLayouts={{ table: {} }}
            search
            empty={
              <div className="empty-state">
                <h2>No endpoints</h2>
                <p>Define a collection or singleton to expose endpoints.</p>
              </div>
            }
          >
            <div className="dataviews-shell">
              <div className="dataviews-toolbar">
                <DataViews.Search label="Search endpoints" />
                <DataViews.FiltersToggle />
                <div className="dataviews-toolbar__spacer" />
                <DataViews.ViewConfig />
              </div>
              <DataViews.FiltersToggled />
              <DataViews.Layout className="dataviews-layout" />
              <div className="dataviews-footer">
                <span>{endpointProcessed.paginationInfo.totalItems} endpoints</span>
                <DataViews.Pagination />
              </div>
            </div>
          </DataViews>
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Logs Page ── */

// Matches a typical PHP debug.log timestamp like `[12-Apr-2026 14:30:05 UTC]`
const LOG_TIMESTAMP_RE = /^\[(\d{1,2}-[A-Za-z]{3}-\d{4}\s+\d{1,2}:\d{2}:\d{2}(?:\s+[A-Z]{2,5})?)\]\s*/;
// Matches an explicit severity/source prefix at the start of a line (after timestamp).
// Covers: PHP Fatal error:, PHP Warning:, PHP Notice:, PHP Parse error:, PHP Deprecated:,
// WordPress database error, [wplite], [plugin-slug], or a generic "Error:" / "Fatal error:" style.
const LOG_SOURCE_RE = /^(PHP\s+(?:Fatal error|Parse error|Warning|Notice|Deprecated|Strict Standards)(?:\s*:)?|WordPress database error|Fatal error|Error|Warning|Notice|Deprecated|\[[^\]]+\])\s*:?\s*/;

// Continuation detection — indented text, stack-trace frames (#0 /path), "at ClassName..." lines.
function isContinuationLine(line) {
  if (!line) return false;
  if (/^\s/.test(line)) return true;
  if (/^#\d+\s/.test(line)) return true;
  if (/^(thrown|Stack trace|PHP\s+\d+\.\s|at\s+)/i.test(line)) return true;
  return false;
}

function detectLevel(line) {
  if (/fatal\s+error|^\s*Fatal\s+error/i.test(line)) return 'fatal';
  if (/database error|\bPHP\s+Parse error|\bPHP\s+Error\b|(^|[^a-z])error[:\s]/i.test(line)) return 'error';
  if (/warning/i.test(line)) return 'warning';
  if (/notice|deprecated|strict\s+standards/i.test(line)) return 'notice';
  return 'info';
}

function parseLogLine(line) {
  let rest = line ?? '';
  let timestamp = null;
  const tsMatch = rest.match(LOG_TIMESTAMP_RE);
  if (tsMatch) {
    timestamp = tsMatch[1];
    rest = rest.slice(tsMatch[0].length);
  }
  let source = null;
  const srcMatch = rest.match(LOG_SOURCE_RE);
  if (srcMatch) {
    source = srcMatch[1].replace(/\s*:\s*$/, '');
    rest = rest.slice(srcMatch[0].length);
  }
  return { timestamp, source, message: rest };
}

// Group raw lines into entries. A line is a new entry when:
//   * it has a leading timestamp, OR
//   * it has an explicit PHP/WordPress/[bracket] source prefix and is not a continuation
// Otherwise it's attached as a continuation to the previous entry.
function parseLogEntries(rawLines) {
  const entries = [];
  rawLines.forEach((raw) => {
    const hasTs = LOG_TIMESTAMP_RE.test(raw);
    const continuation = !hasTs && isContinuationLine(raw);
    if (!hasTs && continuation && entries.length > 0) {
      entries[entries.length - 1].continuations.push(raw);
      return;
    }
    // If no timestamp and no source prefix and we have a previous entry, treat as continuation
    const { timestamp, source, message } = parseLogLine(raw);
    if (!hasTs && !source && entries.length > 0 && raw.trim() !== '') {
      entries[entries.length - 1].continuations.push(raw);
      return;
    }
    entries.push({
      raw,
      timestamp,
      source,
      message,
      level: detectLevel(raw),
      continuations: [],
    });
  });
  return entries;
}

const LOG_LEVELS = [
  { id: 'fatal', label: 'Fatal' },
  { id: 'error', label: 'Error' },
  { id: 'warning', label: 'Warning' },
  { id: 'notice', label: 'Notice' },
  { id: 'info', label: 'Info' },
];

export function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filter, setFilter] = useState('');
  const [activeLevels, setActiveLevels] = useState(() => new Set(LOG_LEVELS.map((l) => l.id)));
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const logsEndRef = useRef(null);

  async function fetchLogs() {
    try {
      const data = await apiFetch('logs');
      setLogs(data.lines ?? []);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const entries = useMemo(() => parseLogEntries(logs), [logs]);

  const levelCounts = useMemo(() => {
    const counts = { fatal: 0, error: 0, warning: 0, notice: 0, info: 0 };
    entries.forEach((e) => { counts[e.level] = (counts[e.level] ?? 0) + 1; });
    return counts;
  }, [entries]);

  const deferredFilter = useDeferredValue(filter);

  const filteredEntries = useMemo(() => {
    const q = deferredFilter.trim().toLowerCase();
    return entries.filter((e) => {
      if (!activeLevels.has(e.level)) return false;
      if (!q) return true;
      if (e.raw.toLowerCase().includes(q)) return true;
      return e.continuations.some((c) => c.toLowerCase().includes(q));
    });
  }, [entries, deferredFilter, activeLevels]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredEntries.length]);

  async function clearLogs() {
    try {
      await apiFetch('logs', { method: 'DELETE' });
      setLogs([]);
    } catch {}
  }

  function toggleLevel(id) {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function setAllLevels() {
    setActiveLevels(new Set(LOG_LEVELS.map((l) => l.id)));
  }

  const allOn = activeLevels.size === LOG_LEVELS.length;
  const shownCount = filteredEntries.length;
  const linesLabel = `${shownCount.toLocaleString()} ${shownCount === 1 ? 'line' : 'lines'}`;

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Logs</h1>
          <p className="screen-header__lede">
            WordPress error log (<code>debug.log</code>)
          </p>
        </div>
        <div className="screen-header__actions">
          <Button
            variant="secondary"
            icon={<Renew size={16} />}
            onClick={fetchLogs}
          >
            Refresh
          </Button>
          <Button
            variant={autoRefresh ? 'primary' : 'secondary'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
          </Button>
          <Button variant="secondary" isDestructive onClick={clearLogs}>
            Clear Log
          </Button>
        </div>
      </header>

      <Card className="surface-card">
        <CardBody className="logs-card-body">
          <div className="dataviews-shell">
            <div className="logs-toolbar">
              <div className="logs-filter-input">
                <Search size={14} className="logs-filter-input__icon" aria-hidden="true" />
                <input
                  type="text"
                  className="logs-filter-input__field"
                  placeholder="Filter log entries…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                {filter && (
                  <button
                    type="button"
                    className="logs-filter-input__clear"
                    aria-label="Clear filter"
                    onClick={() => setFilter('')}
                  >
                    <Close size={14} />
                  </button>
                )}
              </div>
              <div className="logs-level-chips" role="group" aria-label="Filter by severity">
                <Button
                  variant="tertiary"
                  size="small"
                  isPressed={allOn}
                  onClick={setAllLevels}
                  className="logs-level-chip logs-level-chip--all"
                >
                  All <span className="logs-level-chip__count">{entries.length}</span>
                </Button>
                {LOG_LEVELS.map((lvl) => (
                  <Button
                    key={lvl.id}
                    variant="tertiary"
                    size="small"
                    isPressed={activeLevels.has(lvl.id)}
                    onClick={() => toggleLevel(lvl.id)}
                    className={`logs-level-chip logs-level-chip--${lvl.id}`}
                  >
                    <span className={`logs-level-chip__dot logs-level-chip__dot--${lvl.id}`} aria-hidden="true" />
                    {lvl.label}
                    <span className="logs-level-chip__count">{levelCounts[lvl.id] ?? 0}</span>
                  </Button>
                ))}
              </div>
              <div className="dataviews-toolbar__spacer" />
              <Button
                variant="tertiary"
                size="small"
                isPressed={showLineNumbers}
                onClick={() => setShowLineNumbers((v) => !v)}
              >
                #
              </Button>
              <span className="logs-count">{linesLabel}</span>
            </div>
            {loading ? (
              <div className="skeleton-logs">
                {Array.from({ length: 15 }, (_, i) => (
                  <div key={i} className="skeleton-log-line">
                    <SkeletonBox height={14} style={{ width: 30 }} />
                    <SkeletonBox height={14} style={{ width: `${40 + (i % 5) * 12}%` }} />
                  </div>
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="empty-state">
                <Debug size={32} className="empty-state__icon" />
                <h2>No log entries</h2>
                <p>{filter || !allOn ? 'No entries match your filters.' : 'The error log is empty — your site is running clean.'}</p>
              </div>
            ) : (
              <div className={`logs-viewer${showLineNumbers ? '' : ' logs-viewer--no-numbers'}`}>
                {filteredEntries.map((entry, index) => (
                  <div key={index} className={`log-entry log-entry--${entry.level}`}>
                    <span className="log-entry__bar" aria-hidden="true" />
                    {showLineNumbers && (
                      <span className="log-entry__number">{index + 1}</span>
                    )}
                    <div className="log-entry__meta">
                      <span className={`log-entry__level log-entry__level--${entry.level}`}>
                        {entry.level}
                      </span>
                      {entry.timestamp && (
                        <span className="log-entry__timestamp">{entry.timestamp}</span>
                      )}
                    </div>
                    <div className="log-entry__body">
                      <div className="log-entry__message">
                        {entry.source && (
                          <span className="log-entry__source">{entry.source}</span>
                        )}
                        <span className="log-entry__text">
                          {entry.message || (!entry.source && !entry.timestamp ? entry.raw : '')}
                        </span>
                      </div>
                      {entry.continuations.length > 0 && (
                        <pre className="log-entry__continuation">
                          {entry.continuations.join('\n')}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Integrations Page ── */
/* ── Brand marks: square-only. Wikimedia multicolor where a square asset exists,
     otherwise simple-icons monochrome (24x24 viewBox) filled with the brand hex. ── */
const BrandGoogleAnalytics = (props) => (
  // Wikimedia: Google_Analytics_logo_2022.svg — mark bars are in a 48x48 square region.
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" {...props}>
    <path fill="#F9AB00" d="M45.3,41.6c0,3.2-2.6,5.9-5.8,5.9c-0.2,0-0.5,0-0.7,0c-3-0.4-5.2-3.1-5.1-6.1V6.6c-0.1-3,2.1-5.6,5.1-6.1 c3.2-0.4,6.1,1.9,6.5,5.1c0,0.2,0,0.5,0,0.7V41.6z" />
    <path fill="#E37400" d="M8.6,35.9c3.2,0,5.8,2.6,5.8,5.8c0,3.2-2.6,5.8-5.8,5.8s-5.8-2.6-5.8-5.8c0,0,0,0,0,0 C2.7,38.5,5.4,35.9,8.6,35.9z M23.9,18.2c-3.2,0.2-5.7,2.9-5.7,6.1V40c0,4.2,1.9,6.8,4.6,7.4c3.2,0.6,6.2-1.4,6.9-4.6 c0.1-0.4,0.1-0.8,0.1-1.2V24.1c0-3.2-2.6-5.9-5.8-5.9C24,18.2,23.9,18.2,23.9,18.2z" />
  </svg>
);

const BrandMailchimp = (props) => (
  // simple-icons: mailchimp (Freddie head, monochrome). Brand hex #FFE01B.
  // Square 24x24 viewBox.
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFE01B" {...props}>
    <path d="M7.676 13.703c-.176-.044-.352-.044-.528-.044-.968.132-1.541.924-1.5 2.024.088.968 1.145 1.761 2.113 1.761.132 0 .264 0 .352-.044.968-.176 1.32-1.32 1.188-2.288-.133-.968-.969-1.365-1.625-1.409zm.792 2.816c-.132.176-.264.22-.44.22-.264 0-.572-.22-.572-.572-.044-.176.044-.352.088-.528.044-.22-.044-.44-.22-.572a.623.623 0 00-.44-.088c-.132 0-.264.088-.352.22-.044.088-.088.176-.132.264 0 0 0 .044-.044.044-.044.132-.132.176-.176.176-.044 0-.088-.044-.088-.132-.044-.22 0-.528.308-.88.264-.264.616-.352.924-.264.264.044.528.22.704.484.132.264.088.572-.088.968 0 0-.044.088-.044.088-.044.132-.088.264 0 .352.044.088.176.132.22.132.088 0 .132 0 .176-.044.088 0 .176-.044.22 0 .044.044.044.088 0 .132zM23.335 15.452c0-.704-.396-1.012-.66-1.012 0-.044-.044-.22-.132-.44a4.205 4.205 0 00-.132-.396c.264-.396.264-.792.22-1.012-.044-.264-.176-.484-.396-.704-.22-.264-.704-.484-1.32-.66-.088 0-.308-.088-.352-.088 0-.176-.044-.88-.044-1.145-.044-.704-.088-1.761-.44-2.245-.308-.484-.88-.704-1.584-.704-.132 0-.264 0-.396.044-.264.044-.528.132-.792.264-.528.308-1.01.66-1.761.66h-.132c-.352 0-.704-.044-1.188-.088-.088 0-.132-.044-.22-.044-.044 0-.088 0-.176-.044-1.32-.132-2.288.616-2.552 1.805-.264 1.232.132 2.2.88 3.037-.264.264-.308.572-.308.88.044.264.22.484.264.572-.484.572-.968 1.277-1.188 2.024-.308 1.232-.22 2.332.176 3.389.396.968 1.1 1.85 2.069 2.376.484.264 1.1.396 1.717.396.264 0 .528 0 .792-.044.572-.088 1.1-.264 1.584-.484.484-.22.968-.528 1.453-.924.66-.572 1.232-1.32 1.672-2.2.308-.66.572-1.498.572-2.332 0-.264 0-.396-.044-.484zM9.041 8.25c.484-.572 1.1-1.054 1.672-1.453.044 0 .044 0 .044.044-.044.088-.088.264-.132.352 0 .044.044.088.088.044.352-.22.748-.396 1.145-.528.044 0 .088.044.044.088-.088.088-.176.22-.264.264-.044.044 0 .088.044.088.44-.044.88 0 1.364.088.044 0 .044.088 0 .088-1.364.264-2.728.749-3.917 1.761 0-.044-.044-.044-.088-.044.044-.264.088-.528.176-.792.044-.088 0-.088-.176 0z" />
  </svg>
);

const BrandStripe = (props) => (
  // simple-icons: stripe (monochrome "S" glyph). Brand hex #635BFF. Square 24x24.
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#635BFF" {...props}>
    <path d="M13.479 9.883c-1.626-.604-2.512-1.067-2.512-1.803 0-.622.511-.977 1.425-.977 1.683 0 3.409.645 4.604 1.226l.683-4.204c-.947-.446-2.878-1.182-5.536-1.182-1.9 0-3.482.496-4.611 1.424-1.181.973-1.79 2.386-1.79 4.091 0 3.089 1.895 4.444 4.938 5.566 1.99.709 2.65 1.237 2.65 2.018 0 .759-.648 1.218-1.865 1.218-1.562 0-4.106-.773-5.78-1.762l-.698 4.256c1.443.813 4.083 1.658 6.809 1.658 2.008 0 3.67-.48 4.826-1.398 1.278-.998 1.936-2.484 1.936-4.373 0-3.213-1.903-4.551-5.074-5.697h-.005z" />
  </svg>
);

const BrandCloudflare = (props) => (
  // simple-icons: cloudflare (cloud mark only, monochrome). Brand hex #F38020. Square 24x24.
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F38020" {...props}>
    <path d="M16.5088 16.8447c.1475-.5068.0908-.9766-.1553-1.3223-.2276-.3164-.6055-.498-1.0654-.5205l-8.6758-.1123a.1777.1777 0 0 1-.1357-.0703.1617.1617 0 0 1-.0166-.1553.2226.2226 0 0 1 .1943-.1494l8.7549-.1133c1.0381-.0469 2.166-.8887 2.5605-1.9209l.5-1.3047c.0224-.0566.0263-.1123.0263-.168-.0009-.03-.005-.0605-.0117-.0908-.5615-2.5439-2.832-4.4395-5.543-4.4395-2.501 0-4.6231 1.6143-5.3799 3.8574a2.5645 2.5645 0 0 0-1.7988-.498c-1.2979.1299-2.3408 1.1729-2.4707 2.4707a2.583 2.583 0 0 0 .0664.9541C.9277 13.4727 0 14.5918 0 15.9307c0 .1123.0068.2236.0205.333a.156.156 0 0 0 .1543.1357h15.9531c.002 0 .0049-.001.0068-.001a.2114.2114 0 0 0 .1904-.1504l.1836-.625Zm2.8321-2.7491c-.0791 0-.168.0029-.2471.0107a.1384.1384 0 0 0-.123.0996l-.3418 1.1787c-.1475.5068-.0908.9756.1553 1.3213.2275.3164.6055.498 1.0654.5205l1.8496.1123c.0557 0 .1045.0263.1357.0703a.1644.1644 0 0 1 .0176.1553.2249.2249 0 0 1-.1943.1484l-1.9219.1123c-1.043.0479-2.166.8896-2.5605 1.9219l-.1397.3594c-.0273.0703.0225.1406.0987.1406h6.6171a.164.164 0 0 0 .1582-.1221 4.7132 4.7132 0 0 0 .1748-1.29c0-2.6057-2.123-4.7256-4.7344-4.7256" />
  </svg>
);

const BrandSlack = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127 127" {...props}>
    <path d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z" fill="#E01E5A" />
    <path d="M47 27c-7.3 0-13.2-5.9-13.2-13.2C33.8 6.5 39.7.6 47 .6c7.3 0 13.2 5.9 13.2 13.2V27H47zm0 6.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H13.9C6.6 60.1.7 54.2.7 46.9c0-7.3 5.9-13.2 13.2-13.2H47z" fill="#36C5F0" />
    <path d="M99.9 46.9c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V46.9zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V13.8C66.9 6.5 72.8.6 80.1.6c7.3 0 13.2 5.9 13.2 13.2v33.1z" fill="#2EB67D" />
    <path d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.8h13.2zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80.1z" fill="#ECB22E" />
  </svg>
);

const BrandGitHub = (props) => (
  // simple-icons: github (Octocat mark, monochrome). Brand hex #1B1F23. Square 24x24.
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1B1F23" {...props}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const BrandOpenAI = (props) => (
  // simple-icons: openai (spiral mark only, monochrome). Brand hex #0A0A0A. Square 24x24.
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0A0A0A" {...props}>
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4069-.6813zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
  </svg>
);

const BRAND_SVGS = {
  'google-analytics': BrandGoogleAnalytics,
  mailchimp: BrandMailchimp,
  stripe: BrandStripe,
  cloudflare: BrandCloudflare,
  slack: BrandSlack,
  github: BrandGitHub,
  openai: BrandOpenAI,
};

function BrandIcon({ id, size = 24 }) {
  if (id === 'smtp') return <Email size={size} />;
  const Component = BRAND_SVGS[id];
  if (!Component) return <Integration size={size} />;
  return (
    <span className="integration-brand-icon" aria-hidden="true">
      <Component width={size} height={size} />
    </span>
  );
}

const INTEGRATIONS_CATALOG = [
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    description: 'Track visitors, page views, and user behavior with GA4.',
    category: 'Analytics',
    configFields: ['measurement_id'],
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Sync newsletter subscribers and manage email campaigns.',
    category: 'Marketing',
    configFields: ['api_key', 'list_id'],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Accept payments and manage subscriptions.',
    category: 'Commerce',
    configFields: ['publishable_key', 'secret_key'],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    description: 'CDN, DDoS protection, and DNS management.',
    category: 'Performance',
    configFields: ['zone_id', 'api_token'],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get real-time notifications for form submissions and site events.',
    category: 'Notifications',
    configFields: ['webhook_url'],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Deploy from a repository and manage version-controlled content.',
    category: 'Development',
    configFields: ['repo', 'token'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'AI-powered content generation and smart assistants.',
    category: 'AI',
    configFields: ['api_key', 'model'],
  },
  {
    id: 'smtp',
    name: 'Custom SMTP',
    description: 'Route transactional emails through your own mail server.',
    category: 'Email',
    configFields: ['host', 'port', 'username', 'password'],
  },
];

function IntegrationConfigModal({ integration, initialConfig, isConnected, onSave, onClose }) {
  const [draft, setDraft] = useState(() => {
    const seed = {};
    integration.configFields.forEach((f) => {
      seed[f] = initialConfig?.[f] ?? '';
    });
    return seed;
  });

  function handleSave() {
    onSave(draft);
  }

  return (
    <div className="integration-config-modal">
      <p className="field-hint">{integration.description}</p>
      <div className="integration-config-fields">
        {integration.configFields.map((field) => (
          <TextControl
            key={field}
            label={toTitleCase(field.replace(/_/g, ' '))}
            value={draft[field] ?? ''}
            onChange={(v) => setDraft((prev) => ({ ...prev, [field]: v }))}
            __next40pxDefaultSize
            __nextHasNoMarginBottom
          />
        ))}
      </div>
      <div className="integration-config-modal__footer">
        <Button variant="tertiary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave}>
          {isConnected ? 'Save Changes' : 'Connect'}
        </Button>
      </div>
    </div>
  );
}

export function IntegrationsPage({ pushNotice }) {
  const [connected, setConnected] = useState([
    { integrationId: 'google-analytics', config: { measurement_id: 'G-XXXXXXXXXX' }, connectedAt: '2026-03-10' },
  ]);

  const connectedMap = useMemo(() => {
    const m = new Map();
    connected.forEach((c) => m.set(c.integrationId, c));
    return m;
  }, [connected]);

  // Flatten catalog into rows including status/connectedAt for DataViews.
  const rows = useMemo(() => {
    return INTEGRATIONS_CATALOG.map((integration) => {
      const conn = connectedMap.get(integration.id);
      return {
        ...integration,
        status: conn ? 'connected' : 'available',
        connectedAt: conn?.connectedAt ?? null,
        config: conn?.config ?? null,
      };
    });
  }, [connectedMap]);

  const categoryElements = useMemo(() => {
    const cats = Array.from(new Set(INTEGRATIONS_CATALOG.map((i) => i.category))).sort();
    return cats.map((c) => ({ value: c, label: c }));
  }, []);

  function handleConnect(integration, draft) {
    const hasEmpty = integration.configFields.some((f) => !String(draft[f] ?? '').trim());
    if (hasEmpty) {
      pushNotice({ status: 'warning', message: 'Please fill in all fields.' });
      return false;
    }
    setConnected((prev) => [
      ...prev.filter((c) => c.integrationId !== integration.id),
      {
        integrationId: integration.id,
        config: { ...draft },
        connectedAt: new Date().toISOString().split('T')[0],
      },
    ]);
    pushNotice({ status: 'success', message: `${integration.name} connected successfully.` });
    return true;
  }

  function handleSaveConfig(integration, draft) {
    const hasEmpty = integration.configFields.some((f) => !String(draft[f] ?? '').trim());
    if (hasEmpty) {
      pushNotice({ status: 'warning', message: 'Please fill in all fields.' });
      return false;
    }
    setConnected((prev) => prev.map((c) =>
      c.integrationId === integration.id ? { ...c, config: { ...draft } } : c
    ));
    pushNotice({ status: 'success', message: `${integration.name} updated.` });
    return true;
  }

  function handleDisconnect(integrationIds) {
    const ids = Array.isArray(integrationIds) ? integrationIds : [integrationIds];
    setConnected((prev) => prev.filter((c) => !ids.includes(c.integrationId)));
    const label = ids.length === 1
      ? (INTEGRATIONS_CATALOG.find((i) => i.id === ids[0])?.name || 'Integration')
      : `${ids.length} integrations`;
    pushNotice({ status: 'info', message: `${label} disconnected.` });
  }

  const fields = useMemo(() => [
    {
      id: 'name',
      label: 'Service',
      enableGlobalSearch: true,
      enableSorting: true,
      enableHiding: false,
      getValue: ({ item }) => item.name,
    },
    {
      id: 'media',
      label: 'Icon',
      enableSorting: false,
      enableHiding: true,
      enableGlobalSearch: false,
      getValue: ({ item }) => item.id,
      render: ({ item }) => <BrandIcon id={item.id} size={24} />,
    },
    {
      id: 'description',
      label: 'Description',
      enableGlobalSearch: true,
      enableSorting: false,
      getValue: ({ item }) => item.description,
    },
    {
      id: 'category',
      label: 'Category',
      type: 'text',
      enableSorting: true,
      elements: categoryElements,
      filterBy: {},
      getValue: ({ item }) => item.category,
    },
    {
      id: 'status',
      label: 'Status',
      type: 'text',
      enableSorting: true,
      elements: [
        { value: 'connected', label: 'Connected' },
        { value: 'available', label: 'Available' },
      ],
      filterBy: {},
      getValue: ({ item }) => item.status,
      render: ({ item }) => (
        item.status === 'connected'
          ? <span className="integration-status integration-status--connected"><CheckmarkFilled size={14} /> Connected</span>
          : <span className="integration-status integration-status--available">Available</span>
      ),
    },
    {
      id: 'connectedAt',
      label: 'Connected at',
      type: 'datetime',
      enableSorting: true,
      getValue: ({ item }) => item.connectedAt,
      render: ({ item }) => item.connectedAt
        ? <span>{item.connectedAt}</span>
        : <span className="integration-muted">—</span>,
    },
  ], [categoryElements]);

  const actions = useMemo(() => [
    {
      id: 'connect',
      label: 'Connect',
      isPrimary: true,
      icon: <Add size={16} />,
      isEligible: (item) => item.status !== 'connected',
      RenderModal: ({ items, closeModal }) => {
        const integration = items[0];
        return (
          <IntegrationConfigModal
            integration={integration}
            initialConfig={null}
            isConnected={false}
            onClose={closeModal}
            onSave={(draft) => {
              if (handleConnect(integration, draft)) {
                closeModal();
              }
            }}
          />
        );
      },
      modalHeader: (items) => `Connect ${items[0]?.name}`,
      modalSize: 'medium',
    },
    {
      id: 'configure',
      label: 'Configure',
      isPrimary: true,
      isEligible: (item) => item.status === 'connected',
      RenderModal: ({ items, closeModal }) => {
        const integration = items[0];
        return (
          <IntegrationConfigModal
            integration={integration}
            initialConfig={integration.config}
            isConnected
            onClose={closeModal}
            onSave={(draft) => {
              if (handleSaveConfig(integration, draft)) {
                closeModal();
              }
            }}
          />
        );
      },
      modalHeader: (items) => `Configure ${items[0]?.name}`,
      modalSize: 'medium',
    },
    {
      id: 'disconnect',
      label: 'Disconnect',
      isPrimary: false,
      supportsBulk: true,
      isEligible: (item) => item.status === 'connected',
      callback: (items) => handleDisconnect(items.map((i) => i.id)),
    },
  ], []);

  const [view, setView] = useState({
    type: 'grid',
    perPage: 25,
    page: 1,
    sort: { field: 'name', direction: 'asc' },
    fields: ['category', 'status', 'connectedAt'],
    titleField: 'name',
    mediaField: 'media',
    descriptionField: 'description',
    layout: {},
    filters: [],
    search: '',
  });

  const [selection, setSelection] = useState([]);

  const deferredRows = useDeferredValue(rows);
  const processed = useMemo(
    () => filterSortAndPaginate(deferredRows, view, fields),
    [deferredRows, view, fields]
  );

  const connectedCount = connected.length;

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Integrations</h1>
          <p className="screen-header__lede">
            {connectedCount > 0
              ? `${connectedCount} connected — ${INTEGRATIONS_CATALOG.length} available`
              : 'Connect third-party services to extend your site\'s capabilities.'}
          </p>
        </div>
      </header>

      <Card className="surface-card">
        <CardBody>
          <DataViews
            data={processed.data}
            fields={fields}
            view={view}
            onChangeView={setView}
            getItemId={(item) => item.id}
            selection={selection}
            onChangeSelection={setSelection}
            paginationInfo={processed.paginationInfo}
            actions={actions}
            defaultLayouts={{ table: {}, grid: {} }}
            search
            empty={
              <div className="empty-state">
                <h2>No integrations</h2>
                <p>No services match your current filters.</p>
              </div>
            }
          >
            <div className="dataviews-shell">
              <div className="dataviews-toolbar">
                <DataViews.Search label="Search integrations" />
                <DataViews.FiltersToggle />
                <div className="dataviews-toolbar__spacer" />
                <DataViews.ViewConfig />
                <DataViews.LayoutSwitcher />
              </div>
              <DataViews.FiltersToggled />
              <DataViews.Layout className="dataviews-layout" />
              <div className="dataviews-footer">
                <span>{processed.paginationInfo.totalItems} services</span>
                <DataViews.Pagination />
              </div>
            </div>
          </DataViews>
        </CardBody>
      </Card>
    </div>
  );
}

export function PlaceholderPage({ eyebrow = 'Workspace', title, lede, summary }) {
  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="screen-header__lede">{lede}</p>
        </div>
      </header>

      <section className="dashboard-grid">
        <Card className="surface-card">
          <CardHeader><h2>Planned Surface</h2></CardHeader>
          <CardBody>
            <p className="field-hint">{summary}</p>
          </CardBody>
        </Card>
        <Card className="surface-card">
          <CardHeader><h2>About</h2></CardHeader>
          <CardBody>
            <p className="field-hint">
              This is a core part of your site management workspace.
            </p>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
