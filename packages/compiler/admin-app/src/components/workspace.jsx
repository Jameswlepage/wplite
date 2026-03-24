import React, { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  SelectControl,
  Spinner,
  TextControl,
} from '@wordpress/components';
import {
  Add,
  CheckmarkFilled,
  Copy,
  Debug,
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
      domain: `${slugifiedName}.wplite.app`,
      type: 'default',
      ssl: true,
      status: 'active',
      isPrimary: true,
    },
  ]);
  const [showDnsPanel, setShowDnsPanel] = useState(null);

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
      domain: result.domain,
      type: 'registered',
      ssl: true,
      status: 'provisioning',
      isPrimary: false,
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

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Domains</h1>
          <p className="screen-header__lede">
            Search, register, and manage custom domains for your site.
          </p>
        </div>
      </header>

      <Card className="surface-card">
        <CardHeader><h2>Find a Domain</h2></CardHeader>
        <CardBody>
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
                      <Button variant="primary" size="compact" onClick={() => handleRegister(result)}>
                        Register
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <h2>Connected Domains</h2>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          <table className="core-list-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Type</th>
                <th>SSL</th>
                <th>Status</th>
                <th style={{ width: 180 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {connectedDomains.map((d) => (
                <Fragment key={d.domain}>
                  <tr>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong className="row-title">{d.domain}</strong>
                        {d.isPrimary && (
                          <span className="status-badge status-badge--publish">Primary</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{d.type}</td>
                    <td>
                      {d.ssl ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#15803d' }}>
                          <Locked size={16} /> Active
                        </span>
                      ) : (
                        <span style={{ color: 'var(--wp-admin-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {d.status === 'active' && (
                        <span className="domain-status domain-status--active">
                          <CheckmarkFilled size={14} /> Active
                        </span>
                      )}
                      {d.status === 'provisioning' && (
                        <span className="domain-status domain-status--pending">
                          <Spinner style={{ width: 14, height: 14 }} /> Provisioning
                        </span>
                      )}
                      {d.status === 'error' && (
                        <span className="domain-status domain-status--error">
                          <WarningAlt size={14} /> Error
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {!d.isPrimary && d.status === 'active' && (
                          <Button variant="tertiary" size="compact" onClick={() => handleSetPrimary(d.domain)}>
                            Set Primary
                          </Button>
                        )}
                        <Button
                          variant="tertiary"
                          size="compact"
                          onClick={() => setShowDnsPanel(showDnsPanel === d.domain ? null : d.domain)}
                        >
                          DNS
                        </Button>
                        {d.type !== 'default' && (
                          <Button
                            variant="tertiary"
                            size="compact"
                            isDestructive
                            onClick={() => handleRemoveDomain(d.domain)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {showDnsPanel === d.domain && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <div className="dns-panel">
                          <h3>DNS Records</h3>
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
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card className="surface-card">
        <CardHeader><h2>Email Forwarding</h2></CardHeader>
        <CardBody>
          <p className="field-hint" style={{ marginBottom: 12 }}>
            Forward emails from your custom domain to an existing email address.
          </p>
          <div className="email-forwarding-row">
            <TextControl
              label="From"
              placeholder={`hello@${primaryDomain}`}
              __next40pxDefaultSize
              __nextHasNoMarginBottom
              disabled
            />
            <span className="email-arrow">→</span>
            <TextControl
              label="To"
              placeholder="you@gmail.com"
              __next40pxDefaultSize
              __nextHasNoMarginBottom
              disabled
            />
            <Button variant="secondary" disabled>
              Add Rule
            </Button>
          </div>
          <p className="field-hint" style={{ marginTop: 8 }}>
            Email forwarding will be available once a custom domain is active.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

/* ── API Page ── */
export function ApiPage({ bootstrap }) {
  const models = bootstrap?.models ?? [];
  const singletons = bootstrap?.singletons ?? [];
  const [appPassword, setAppPassword] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(models[0]?.id ?? '');
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
          <p className="field-hint" style={{ marginBottom: 12 }}>
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
        <CardHeader>
          <h2>API Operations</h2>
          <div className="api-controls">
            <SelectControl
              value={selectedEntity}
              options={entityOptions}
              onChange={setSelectedEntity}
              __next40pxDefaultSize
              __nextHasNoMarginBottom
            />
            <div className="api-lang-tabs">
              <button
                className={`api-lang-tab ${language === 'javascript' ? 'is-active' : ''}`}
                onClick={() => setLanguage('javascript')}
              >
                JavaScript
              </button>
              <button
                className={`api-lang-tab ${language === 'python' ? 'is-active' : ''}`}
                onClick={() => setLanguage('python')}
              >
                Python
              </button>
            </div>
          </div>
        </CardHeader>
        <CardBody style={{ display: 'grid', gap: 16 }}>
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
        </CardBody>
      </Card>

      <Card className="surface-card">
        <CardHeader><h2>Endpoints Reference</h2></CardHeader>
        <CardBody>
          <table className="core-list-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="api-method api-method--get">GET</span></td>
                <td><code>/wp-json/portfolio/v1/bootstrap</code></td>
                <td>Full app state (models, records, settings)</td>
              </tr>
              {models.map((m) => (
                <Fragment key={m.id}>
                  <tr>
                    <td><span className="api-method api-method--get">GET</span></td>
                    <td><code>/wp-json/portfolio/v1/collection/{m.id}</code></td>
                    <td>List all {m.label.toLowerCase()}</td>
                  </tr>
                  <tr>
                    <td><span className="api-method api-method--post">POST</span></td>
                    <td><code>/wp-json/portfolio/v1/collection/{m.id}</code></td>
                    <td>Create {m.singularLabel?.toLowerCase() || m.id}</td>
                  </tr>
                  <tr>
                    <td><span className="api-method api-method--get">GET</span></td>
                    <td><code>/wp-json/portfolio/v1/collection/{m.id}/:id</code></td>
                    <td>Get single {m.singularLabel?.toLowerCase() || m.id}</td>
                  </tr>
                  <tr>
                    <td><span className="api-method api-method--post">POST</span></td>
                    <td><code>/wp-json/portfolio/v1/collection/{m.id}/:id</code></td>
                    <td>Update {m.singularLabel?.toLowerCase() || m.id}</td>
                  </tr>
                  <tr>
                    <td><span className="api-method api-method--delete">DELETE</span></td>
                    <td><code>/wp-json/portfolio/v1/collection/{m.id}/:id</code></td>
                    <td>Delete {m.singularLabel?.toLowerCase() || m.id}</td>
                  </tr>
                </Fragment>
              ))}
              {singletons.map((s) => (
                <Fragment key={s.id}>
                  <tr>
                    <td><span className="api-method api-method--get">GET</span></td>
                    <td><code>/wp-json/portfolio/v1/singleton/{s.id}</code></td>
                    <td>Get {s.label.toLowerCase()} settings</td>
                  </tr>
                  <tr>
                    <td><span className="api-method api-method--post">POST</span></td>
                    <td><code>/wp-json/portfolio/v1/singleton/{s.id}</code></td>
                    <td>Update {s.label.toLowerCase()} settings</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Logs Page ── */
export function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filter, setFilter] = useState('');
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

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  async function clearLogs() {
    try {
      await apiFetch('logs', { method: 'DELETE' });
      setLogs([]);
    } catch {}
  }

  const deferredFilter = useDeferredValue(filter);
  const filteredLogs = useMemo(() => {
    if (!deferredFilter) return logs;
    const q = deferredFilter.toLowerCase();
    return logs.filter((line) => line.toLowerCase().includes(q));
  }, [logs, deferredFilter]);

  function getLineLevel(line) {
    if (/fatal error/i.test(line)) return 'fatal';
    if (/error/i.test(line)) return 'error';
    if (/warning/i.test(line)) return 'warning';
    if (/notice|deprecated/i.test(line)) return 'notice';
    return 'info';
  }

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

      <div className="logs-toolbar">
        <TextControl
          placeholder="Filter logs..."
          value={filter}
          onChange={setFilter}
          __next40pxDefaultSize
          __nextHasNoMarginBottom
        />
        <span className="logs-count">{filteredLogs.length} lines</span>
      </div>

      <Card className="surface-card">
        <CardBody style={{ padding: 0 }}>
          {loading ? (
            <div className="skeleton-logs">
              {Array.from({ length: 15 }, (_, i) => (
                <div key={i} className="skeleton-log-line">
                  <SkeletonBox height={14} style={{ width: 30 }} />
                  <SkeletonBox height={14} style={{ width: `${40 + (i % 5) * 12}%` }} />
                </div>
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="empty-state">
              <Debug size={32} style={{ color: 'var(--wp-admin-text-muted)' }} />
              <h2>No log entries</h2>
              <p>{filter ? 'No entries match your filter.' : 'The error log is empty — your site is running clean.'}</p>
            </div>
          ) : (
            <div className="logs-viewer">
              {filteredLogs.map((line, index) => (
                <div key={index} className={`log-line log-line--${getLineLevel(line)}`}>
                  <span className="log-line__number">{index + 1}</span>
                  <span className="log-line__text">{line}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Integrations Page ── */
const BRAND_ICONS = {
  'google-analytics': { hex: 'E37400', path: 'M22.84 2.9982v17.9987c.0086 1.6473-1.3197 2.9897-2.967 2.9984a2.9808 2.9808 0 01-.3677-.0208c-1.528-.226-2.6477-1.5558-2.6105-3.1V3.1204c-.0369-1.5458 1.0856-2.8762 2.6157-3.1 1.6361-.1915 3.1178.9796 3.3093 2.6158.014.1201.0208.241.0202.3619zM4.1326 18.0548c-1.6417 0-2.9726 1.331-2.9726 2.9726C1.16 22.6691 2.4909 24 4.1326 24s2.9726-1.3309 2.9726-2.9726-1.331-2.9726-2.9726-2.9726zm7.8728-9.0098c-.0171 0-.0342 0-.0513.0003-1.6495.0904-2.9293 1.474-2.891 3.1256v7.9846c0 2.167.9535 3.4825 2.3505 3.763 1.6118.3266 3.1832-.7152 3.5098-2.327.04-.1974.06-.3983.0593-.5998v-8.9585c.003-1.6474-1.33-2.9852-2.9773-2.9882z' },
  'stripe': { hex: '635BFF', path: 'M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z' },
  'cloudflare': { hex: 'F38020', path: 'M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727' },
  'github': { hex: '181717', path: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12' },
  'mailchimp': { hex: 'FFE01B', path: 'M18.824 14.168a2.264 2.264 0 00-.862-.52l-.092-.031c0-.008-.017-.738-.031-1.05-.01-.224-.03-.576-.138-.922-.13-.468-.356-.879-.64-1.143.78-.808 1.267-1.7 1.266-2.462-.003-1.469-1.806-1.914-4.03-.993l-.472.2s-.552-.403-.932-.677C12.612 6.368 12.266 6.254 11.88 6.254c-.376-.001-3.153.015-6.06 7.04-.568.11-1.07.434-1.377.879-.184-.153-.525-.45-.586-.564-.489-.93.534-2.736 1.25-3.758C6.715 7.783 9.197 5.977 10.58 5.977c.107 0 .197.023.27.068.198.121.804.8 1.062 1.108.062.073.152.044.109-.032a18.333 18.333 0 00-.763-1.323c-.082-.127-.222-.272-.418-.384a1.022 1.022 0 00-.532-.147c-1.856 0-5.27 2.539-7.165 6.295-1.4 2.777-1.13 4.925-.224 5.6.25.186.56.165.832-.008.317-.201.783-.6 1.39-1.204a5.266 5.266 0 002.13 1.186c1.69.503 3.834.124 5.384-.872.037-.024.092-.039.145-.019.099.038.222.08.434.137.496.14.79.28.975.462.155.15.22.35.22.598 0 .764-.648 1.512-1.7 1.963-1.072.46-2.42.597-3.616.367-1.38-.266-2.573-.947-3.253-1.857-.03-.04-.08-.045-.104-.01-.024.035-.014.09.017.128.63.801 1.78 1.512 3.123 1.92.877.267 1.8.364 2.697.29a6.108 6.108 0 002.508-.735c.889-.49 1.485-1.167 1.639-1.867.106-.48.015-.937-.25-1.287a2.056 2.056 0 00-.56-.504c.263-.395.268-.747.233-.948-.037-.247-.14-.458-.348-.676-.207-.218-.633-.441-1.229-.609l-.313-.087c-.001-.013-.017-.738-.03-1.05a5.092 5.092 0 00-.138-.922c-.13-.469-.356-.88-.639-1.143.78-.808 1.266-1.7 1.266-2.462-.003-1.469-1.807-1.914-4.031-.993l-.472.2s-.551-.402-.932-.677c-.281-.203-.627-.316-1.012-.317l.002-.002zm-.01 1.002l.04.007c.153.024.25.144.25.36.003.413-.294.985-.791 1.563a1.246 1.246 0 00-.43-.094c-.195 0-.44.082-.71.258-.22-.03-.423-.042-.61-.042-.395 0-.744.059-1.043.16l.001-.001c.29-.37.654-.72 1.05-.98.02-.013.04.002.037.013-.056.1-.162.314-.196.476-.005.024.023.044.044.03.431-.295 1.182-.61 1.84-.65l.039-.003c-.235.117-.5.278-.679.45a.028.028 0 00.022.047c.462.003 1.114.165 1.538.403.029.016.009.072-.024.065-.642-.148-1.694-.259-2.786.007-.974.238-1.72.606-2.263 1zm.015 1.56c.087.01.172.03.251.06.21.088.404.264.486.549.096.331.113.715.124.973.01.253.041.862.052 1.037.024.4.13.457.342.527.119.04.231.069.395.115.495.14.789.28.975.462.11.114.161.234.177.348.058.427-.331.955-1.363 1.433-1.128.523-2.496.656-3.442.551l-.33-.037c-.757-.102-1.189.874-.735 1.545.292.431 1.09.713 1.886.713 1.828 0 3.232-.78 3.756-1.454a.688.688 0 00.042-.06c.025-.038.004-.06-.028-.037-.427.292-2.323 1.452-4.352 1.103 0 0-.246-.04-.472-.128-.179-.07-.553-.241-.599-.626 1.637.505 2.668.028 2.668.028a.05.05 0 00.03-.05.047.047 0 00-.052-.043s-1.341.199-2.609-.265c.138-.449.505-.287 1.06-.242a7.748 7.748 0 002.56-.276c.574-.164 1.328-.489 1.914-.951.197.434.267.912.267.912s.154-.028.281.051c.121.075.21.229.15.628-.124.746-.441 1.352-.974 1.91a4.01 4.01 0 01-1.17.873c-.238.126-.494.234-.763.323-2.01.656-4.067-.065-4.73-1.614a2.49 2.49 0 01-.133-.366c-.283-1.022-.042-2.246.708-3.017.046-.049.093-.107.093-.18 0-.06-.039-.125-.072-.17-.262-.381-1.171-1.029-.989-2.285.131-.9.92-1.536 1.655-1.498.062.003.124.007.187.01.318.02.597.06.858.07.439.02.834-.044 1.301-.433.158-.131.284-.246.498-.282z' },
  'slack': { hex: '4A154B', path: 'M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z' },
  'openai': { hex: '412991', path: 'M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 10.68.348 6.048 6.048 0 0 0 4.63 3.28a5.986 5.986 0 0 0-3.998 2.9 6.05 6.05 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 12.87 23.1a6.043 6.043 0 0 0 6.05-2.934 5.99 5.99 0 0 0 4-2.9 6.05 6.05 0 0 0-.743-7.097l.105.553zM12.87 21.645a4.493 4.493 0 0 1-2.887-1.04l.143-.082 4.794-2.769a.778.778 0 0 0 .392-.68v-6.756l2.027 1.17a.072.072 0 0 1 .04.055v5.594a4.512 4.512 0 0 1-4.509 4.508zm-9.694-4.134a4.485 4.485 0 0 1-.537-3.02l.143.085 4.794 2.769a.78.78 0 0 0 .783 0l5.856-3.381v2.34a.072.072 0 0 1-.03.062l-4.85 2.8a4.512 4.512 0 0 1-6.16-1.655zM2.065 7.88a4.485 4.485 0 0 1 2.346-1.973V11.6a.778.778 0 0 0 .392.68l5.856 3.382-2.026 1.17a.072.072 0 0 1-.068.005l-4.85-2.8A4.508 4.508 0 0 1 2.065 7.88zm16.643 3.876l-5.857-3.381 2.027-1.17a.072.072 0 0 1 .068-.005l4.849 2.8a4.506 4.506 0 0 1-.699 8.129v-5.7a.778.778 0 0 0-.388-.673zm2.016-3.035l-.143-.085-4.793-2.77a.78.78 0 0 0-.785 0L9.148 9.249V6.91a.072.072 0 0 1 .03-.062l4.85-2.8a4.506 4.506 0 0 1 6.696 4.673zM8.072 12.862l-2.028-1.17a.072.072 0 0 1-.04-.056V6.044a4.507 4.507 0 0 1 7.395-3.46l-.143.082L8.46 5.435a.778.778 0 0 0-.392.68l.003 6.747zm1.1-2.368l2.608-1.506 2.608 1.506v3.012l-2.608 1.506-2.608-1.506V10.494z' },
  'smtp': { hex: '757575', path: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' },
};

function BrandIcon({ id, size = 24 }) {
  const icon = BRAND_ICONS[id];
  if (!icon) return <Integration size={size} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={`#${icon.hex}`} role="img">
      <path d={icon.path} />
    </svg>
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

export function IntegrationsPage({ pushNotice }) {
  const [connected, setConnected] = useState([
    { integrationId: 'google-analytics', config: { measurement_id: 'G-XXXXXXXXXX' }, connectedAt: '2026-03-10' },
  ]);
  const [configuring, setConfiguring] = useState(null);
  const [configDraft, setConfigDraft] = useState({});
  const [filterCategory, setFilterCategory] = useState('all');

  const categories = useMemo(() => {
    const cats = new Set(INTEGRATIONS_CATALOG.map((i) => i.category));
    return ['all', ...Array.from(cats).sort()];
  }, []);

  const connectedIds = new Set(connected.map((c) => c.integrationId));

  const filtered = filterCategory === 'all'
    ? INTEGRATIONS_CATALOG
    : INTEGRATIONS_CATALOG.filter((i) => i.category === filterCategory);

  function handleConnect(integration) {
    setConfiguring(integration.id);
    setConfigDraft(Object.fromEntries(integration.configFields.map((f) => [f, ''])));
  }

  function handleSaveConfig(integration) {
    const hasEmpty = integration.configFields.some((f) => !configDraft[f]?.trim());
    if (hasEmpty) {
      pushNotice({ status: 'warning', message: 'Please fill in all fields.' });
      return;
    }
    setConnected((prev) => [
      ...prev,
      {
        integrationId: integration.id,
        config: { ...configDraft },
        connectedAt: new Date().toISOString().split('T')[0],
      },
    ]);
    setConfiguring(null);
    setConfigDraft({});
    pushNotice({ status: 'success', message: `${integration.name} connected successfully.` });
  }

  function handleDisconnect(integrationId) {
    const integration = INTEGRATIONS_CATALOG.find((i) => i.id === integrationId);
    setConnected((prev) => prev.filter((c) => c.integrationId !== integrationId));
    if (configuring === integrationId) {
      setConfiguring(null);
      setConfigDraft({});
    }
    pushNotice({ status: 'info', message: `${integration?.name || 'Integration'} disconnected.` });
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Integrations</h1>
          <p className="screen-header__lede">
            Connect third-party services to extend your site's capabilities.
          </p>
        </div>
      </header>

      {connected.length > 0 && (
        <Card className="surface-card">
          <CardHeader><h2>Connected</h2></CardHeader>
          <CardBody style={{ padding: 0 }}>
            <table className="core-list-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Category</th>
                  <th>Connected</th>
                  <th style={{ width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {connected.map((conn) => {
                  const integration = INTEGRATIONS_CATALOG.find((i) => i.id === conn.integrationId);
                  if (!integration) return null;
                  return (
                    <Fragment key={conn.integrationId}>
                      <tr>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <BrandIcon id={integration.id} size={20} />
                            <strong className="row-title">{integration.name}</strong>
                          </div>
                        </td>
                        <td style={{ color: 'var(--wp-admin-text-muted)' }}>{integration.category}</td>
                        <td>
                          <span className="domain-status domain-status--active">
                            <CheckmarkFilled size={14} /> {conn.connectedAt}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <Button
                              variant="tertiary"
                              size="compact"
                              onClick={() => {
                                if (configuring === conn.integrationId) {
                                  setConfiguring(null);
                                } else {
                                  setConfiguring(conn.integrationId);
                                  setConfigDraft({ ...conn.config });
                                }
                              }}
                            >
                              Configure
                            </Button>
                            <Button
                              variant="tertiary"
                              size="compact"
                              isDestructive
                              onClick={() => handleDisconnect(conn.integrationId)}
                            >
                              Disconnect
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {configuring === conn.integrationId && (
                        <tr>
                          <td colSpan={4} style={{ padding: 0 }}>
                            <div className="dns-panel">
                              <h3>Configuration</h3>
                              <div className="integration-config-fields">
                                {integration.configFields.map((field) => (
                                  <TextControl
                                    key={field}
                                    label={toTitleCase(field.replace(/_/g, ' '))}
                                    value={configDraft[field] ?? conn.config[field] ?? ''}
                                    onChange={(v) => setConfigDraft((prev) => ({ ...prev, [field]: v }))}
                                    __next40pxDefaultSize
                                    __nextHasNoMarginBottom
                                  />
                                ))}
                              </div>
                              <div style={{ marginTop: 12 }}>
                                <Button variant="primary" size="compact" onClick={() => {
                                  setConnected((prev) => prev.map((c) =>
                                    c.integrationId === conn.integrationId ? { ...c, config: { ...configDraft } } : c
                                  ));
                                  setConfiguring(null);
                                  pushNotice({ status: 'success', message: `${integration.name} updated.` });
                                }}>
                                  Save Changes
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <Card className="surface-card">
        <CardHeader>
          <h2>Available Integrations</h2>
        </CardHeader>
        <CardBody>
          <div className="integration-filters">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={filterCategory === cat ? 'primary' : 'secondary'}
                size="compact"
                onClick={() => setFilterCategory(cat)}
              >
                {cat === 'all' ? 'All' : cat}
              </Button>
            ))}
          </div>

          <div className="integration-grid">
            {filtered.map((integration) => {
              const isConnected = connectedIds.has(integration.id);
              const isConfiguring = configuring === integration.id && !isConnected;
              return (
                <div key={integration.id} className={`integration-card${isConnected ? ' is-connected' : ''}`}>
                  <div className="integration-card__header">
                    <span className="integration-card__icon"><BrandIcon id={integration.id} size={28} /></span>
                    <div>
                      <strong className="integration-card__name">{integration.name}</strong>
                      <span className="integration-card__category">{integration.category}</span>
                    </div>
                  </div>
                  <p className="integration-card__description">{integration.description}</p>
                  {isConfiguring ? (
                    <div className="integration-card__config">
                      {integration.configFields.map((field) => (
                        <TextControl
                          key={field}
                          label={toTitleCase(field.replace(/_/g, ' '))}
                          value={configDraft[field] ?? ''}
                          onChange={(v) => setConfigDraft((prev) => ({ ...prev, [field]: v }))}
                          __next40pxDefaultSize
                          __nextHasNoMarginBottom
                        />
                      ))}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <Button variant="primary" size="compact" onClick={() => handleSaveConfig(integration)}>
                          Connect
                        </Button>
                        <Button variant="tertiary" size="compact" onClick={() => { setConfiguring(null); setConfigDraft({}); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="integration-card__footer">
                      {isConnected ? (
                        <span className="domain-status domain-status--active">
                          <CheckmarkFilled size={14} /> Connected
                        </span>
                      ) : (
                        <Button variant="secondary" size="compact" onClick={() => handleConnect(integration)}>
                          <Add size={16} /> Connect
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
