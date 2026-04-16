import React, { useState } from 'react';
import { Button, Card, CardBody, CardHeader } from '@wordpress/components';
import { Copy } from '@carbon/icons-react';

const FILE_TREE_SNIPPET = String.raw`sites/my-site/
  app/
    site.json
    models/
      project.json
      testimonial.json
    singletons/
      contact.json
      profile.json
      seo.json
    routes/
      home.json
      about.json
      contact.json
    menus/
      primary.json
      footer.json
  content/
    projects/acme-rebrand.md
    posts/welcome.md
    singletons/
      contact.json
      profile.json
      seo.json
    pages/
      about.md          # only when page sync is enabled
    media/
      hero.jpg
      hero.json
  theme/
    theme.json
    templates/
    patterns/
    parts/
    style.css
    fonts.json          # optional
  blocks/
    contact-form/
  admin/
    project.form.json
    project.view.json
  generated/
    site-schema.json
    admin-schema/
    wp-content/plugins/<plugin-slug>/
    wp-content/themes/<theme-slug>/`;

const SITE_CONFIG_SNIPPET = String.raw`{
  "id": "studio-site",
  "title": "Studio Name",
  "tagline": "Calm spaces, precise systems.",
  "mode": "light",
  "content": {
    "mode": "files",
    "format": "markdown",
    "pull": true,
    "push": true,
    "databaseFirst": false,
    "collections": {
      "project": { "sync": true },
      "testimonial": { "sync": true },
      "post": { "sync": true },
      "page": { "sync": false }
    }
  },
  "frontPage": "home",
  "postsPage": "journal",
  "theme": {
    "slug": "studio-theme",
    "sourceDir": "theme"
  },
  "plugin": {
    "slug": "studio-app"
  }
}`;

const COLLECTION_MODEL_SNIPPET = String.raw`{
  "id": "project",
  "label": "Projects",
  "icon": "Portfolio",
  "type": "collection",
  "postType": "project",
  "archiveSlug": "work",
  "public": true,
  "supports": ["title", "editor", "excerpt", "thumbnail", "revisions"],
  "taxonomies": ["project_type", "technology"],
  "fields": {
    "client_name": { "type": "text", "label": "Client" },
    "client_url": { "type": "url", "label": "Client URL" },
    "year": { "type": "integer", "label": "Year" },
    "role": { "type": "text", "label": "Role" },
    "featured": { "type": "boolean", "label": "Featured" },
    "status": {
      "type": "select",
      "label": "Status",
      "options": ["live", "archived", "concept"]
    },
    "external_url": { "type": "url", "label": "Live URL" },
    "repo_url": { "type": "url", "label": "Repository URL" },
    "metrics": {
      "type": "repeater",
      "label": "Metrics",
      "item": {
        "label": { "type": "text" },
        "value": { "type": "text" }
      }
    }
  },
  "editorTemplate": [
    ["core/paragraph", { "placeholder": "One-line summary" }],
    ["core/image", {}],
    ["core/heading", { "content": "Challenge", "level": 2 }],
    ["core/paragraph", { "placeholder": "Describe the problem" }],
    ["core/heading", { "content": "Approach", "level": 2 }],
    ["core/paragraph", { "placeholder": "Describe the solution" }],
    ["core/heading", { "content": "Outcome", "level": 2 }],
    ["core/list", {}]
  ],
  "templateLock": "insert"
}`;

const COLLECTION_ENTRY_SNIPPET = String.raw`---
model: project
sourceId: project.acme-rebrand
slug: acme-rebrand
title: Acme Rebrand Platform
excerpt: A modular marketing platform and design system for a global rebrand launch.
status: publish
fields:
  client_name: Acme
  client_url: 'https://example.com'
  year: '2026'
  role: Lead Product Engineer
  featured: true
  status: live
  external_url: 'https://example.com/work/acme'
  repo_url: 'https://github.com/example/acme'
  metrics:
    - label: Launch speed
      value: 3x faster
    - label: Design reuse
      value: 80% shared components
---
Acme needed a modern publishing and campaign system that could support a global rebrand across multiple teams.

## Challenge

The existing stack was fragmented, slow to update, and difficult for non-technical teams to use consistently.

## Approach

I designed a block-based editorial system, a shared design language, and a deployment workflow optimized for repeatable campaign launches.

## Outcome

-   Faster campaign creation
-   Lower maintenance cost
-   More consistent brand output`;

const COLLECTION_FORM_SNIPPET = String.raw`{
  "layout": {
    "type": "card",
    "children": [
      {
        "id": "basics",
        "label": "Basics",
        "children": ["title", "excerpt", "year", "role", "featured", "status"]
      },
      {
        "id": "links",
        "label": "Links",
        "children": ["client_name", "client_url", "external_url", "repo_url"]
      },
      {
        "id": "taxonomy",
        "label": "Categorization",
        "children": ["project_type", "technology"]
      },
      {
        "id": "metrics",
        "label": "Metrics",
        "children": ["metrics"]
      }
    ]
  }
}`;

const ROUTE_SNIPPET = String.raw`{
  "id": "about",
  "type": "page",
  "slug": "about",
  "title": "About",
  "template": "about",
  "seed": {
    "createPageShell": true,
    "status": "publish"
  }
}`;

const MENU_SNIPPET = String.raw`[
  {
    "label": "Work",
    "type": "archive",
    "object": "project"
  },
  {
    "label": "About",
    "type": "page",
    "object": "about"
  },
  {
    "label": "Writing",
    "type": "page",
    "object": "writing"
  },
  {
    "label": "Contact",
    "type": "page",
    "object": "contact"
  }
]`;

const SINGLETON_SCHEMA_SNIPPET = String.raw`{
  "id": "profile",
  "label": "Profile",
  "icon": "UserAvatar",
  "type": "singleton",
  "storage": "option",
  "fields": {
    "full_name": { "type": "text", "label": "Full Name" },
    "role_line": { "type": "text", "label": "Role Line" },
    "short_bio": { "type": "richtext", "label": "Short Bio" },
    "location": { "type": "text", "label": "Location" },
    "availability": {
      "type": "select",
      "label": "Availability",
      "options": ["open", "limited", "closed"]
    },
    "resume_url": { "type": "url", "label": "Resume URL" },
    "avatar": { "type": "image", "label": "Avatar" }
  }
}`;

const SINGLETON_DATA_SNIPPET = String.raw`{
  "singleton": "profile",
  "data": {
    "full_name": "Jane Doe",
    "role_line": "Designer, developer, and AI builder",
    "short_bio": "<p>I build digital products, creative systems, and AI-powered workflows.</p>",
    "location": "New York, NY",
    "availability": "open",
    "resume_url": "https://example.com/resume.pdf",
    "avatar": 0
  }
}`;

const SINGLETON_FORM_SNIPPET = String.raw`{
  "layout": {
    "type": "card",
    "children": [
      {
        "id": "identity",
        "label": "Identity",
        "children": ["full_name", "role_line", "short_bio", "location"]
      },
      {
        "id": "presence",
        "label": "Presence",
        "children": ["availability", "resume_url", "avatar"]
      }
    ]
  }
}`;

const THEME_JSON_SNIPPET = String.raw`{
  "$schema": "https://schemas.wp.org/trunk/theme.json",
  "version": 3,
  "settings": {
    "appearanceTools": true,
    "color": {
      "palette": [
        { "slug": "base", "name": "Base", "color": "#111111" },
        { "slug": "surface", "name": "Surface", "color": "#ffffff" },
        { "slug": "muted", "name": "Muted", "color": "#6b7280" },
        { "slug": "accent", "name": "Accent", "color": "#2563eb" }
      ]
    },
    "layout": { "contentSize": "720px", "wideSize": "1200px" },
    "spacing": { "units": ["px", "rem", "%", "vh", "vw"] },
    "typography": { "fluid": true }
  },
  "styles": {
    "color": {
      "background": "var(--wp--preset--color--surface)",
      "text": "var(--wp--preset--color--base)"
    },
    "typography": {
      "fontFamily": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "lineHeight": "1.5"
    },
    "elements": {
      "heading": { "typography": { "fontWeight": "700" } },
      "link": { "color": { "text": "var(--wp--preset--color--accent)" } }
    }
  },
  "customTemplates": [
    { "name": "about", "title": "About" },
    { "name": "contact", "title": "Contact" }
  ],
  "templateParts": [
    { "name": "header", "title": "Header", "area": "header" },
    { "name": "footer", "title": "Footer", "area": "footer" }
  ]
}`;

const THEME_TEMPLATE_SNIPPET = String.raw`<!-- wp:template-part {"slug":"header","tagName":"header"} /-->

<!-- wp:group {"tagName":"main","layout":{"type":"constrained"}} -->
<main class="wp-block-group">
  <!-- wp:post-title {"level":1} /-->
  <!-- wp:post-excerpt /-->
  <!-- wp:post-featured-image /-->

  <!-- wp:columns -->
  <div class="wp-block-columns">
    <!-- wp:column {"width":"65%"} -->
    <div class="wp-block-column" style="flex-basis:65%">
      <!-- wp:post-content /-->
    </div>
    <!-- /wp:column -->

    <!-- wp:column {"width":"35%"} -->
    <div class="wp-block-column" style="flex-basis:35%">
      <!-- wp:heading {"level":6} -->
      <h6>Year</h6>
      <!-- /wp:heading -->
      <!-- wp:paragraph {"metadata":{"bindings":{"content":{"source":"core/post-meta","args":{"key":"year"}}}}} -->
      <p>Year</p>
      <!-- /wp:paragraph -->
    </div>
    <!-- /wp:column -->
  </div>
  <!-- /wp:columns -->
</main>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->`;

const BLOCK_METADATA_SNIPPET = String.raw`{
  "apiVersion": 3,
  "name": "studio/contact-form",
  "title": "Contact Form",
  "category": "widgets",
  "icon": "email",
  "description": "A minimal contact form.",
  "supports": {
    "html": false
  },
  "viewScript": "file:./view.js",
  "render": "file:./render.php"
}`;

const BLOCK_RENDER_SNIPPET = String.raw`<?php
?>
<form class="portfolio-contact-form" data-portfolio-contact-form>
  <p>
    <label>Name</label>
    <input type="text" name="name" required />
  </p>

  <p>
    <label>Email</label>
    <input type="email" name="email" required />
  </p>

  <p>
    <label>Company</label>
    <input type="text" name="company" />
  </p>

  <p>
    <label>Message</label>
    <textarea name="message" rows="6" required></textarea>
  </p>

  <p>
    <button type="submit">Send</button>
  </p>

  <div data-form-status></div>
</form>`;

const VIEW_OVERRIDE_SNIPPET = String.raw`{
  "columns": ["title", "year", "featured", "status", "modified"],
  "filters": ["featured", "status", "year", "project_type", "technology"],
  "defaultSort": {
    "field": "modified",
    "direction": "desc"
  },
  "defaultLayout": "table"
}`;

const PLUGIN_SNIPPET = String.raw`<?php
/**
 * Plugin Name: Portfolio Enhancements
 * Description: Example custom hooks that live outside the generated runtime.
 */

add_action( 'init', function () {
  register_post_meta(
    'project',
    'project_health',
    [
      'show_in_rest' => true,
      'single'       => true,
      'type'         => 'string',
      'default'      => 'green',
    ]
  );
} );`;

const COMMANDS_SNIPPET = String.raw`npx wp-lite init
# Display the current site.json for the active site root.

npx wp-lite build
# Compile site schema, generated plugin/theme output, and the /app admin bundle.

npx wp-lite apply
# Build, boot the local target, activate generated runtime, and seed content.

npx wp-lite dev
# Watch the source tree, rebuild, reseed, and refresh the local site.

npx wp-lite pull
# Write synced WordPress content back into markdown and singleton JSON files.

npx wp-lite eject
# Mark the project as graduated out of the light layer.`;

const NPM_SCRIPTS_SNIPPET = String.raw`npm run build          # Full compile
npm run apply          # Build, boot target, activate, seed
npm run dev            # Watch mode with live rebuilds
npm run pull           # Sync supported WordPress content back to files
npm run eject          # Record that the site has graduated from the light layer

npm run wp-env:start   # Build then start the Docker environment
npm run wp-env:stop    # Stop the Docker environment
npm run wp-env:destroy # Tear down the Docker environment

npm run seed           # Re-seed content into a running wp-env instance
npm run rebuild        # Build + seed in one step`;

const ADMIN_APP_SNIPPET = String.raw`admin-app/src/
  main.jsx              # Entry point and bootstrap fetch
  docs.jsx              # This in-app documentation page
  styles.css            # Global styles

  components/
    shell.jsx           # App shell, routing, sidebar navigation
    collections.jsx     # DataViews list + DataForm editor
    pages.jsx           # WordPress core pages management
    comments.jsx        # WordPress core comments moderation
    settings.jsx        # Singleton settings editors
    media.jsx           # Media library
    users.jsx           # User management
    workspace.jsx       # Domains, API, Logs screens
    block-editor.jsx    # Gutenberg block editor frame
    controls.jsx        # Shared form controls and utilities
    skeletons.jsx       # Loading skeleton components

  lib/
    config.js           # Runtime configuration and paths
    helpers.js          # API fetching, field builders, and routing helpers
    blocks.jsx          # Runtime block registration
    spa-nav.js          # SPA bridge for injected same-origin links
    icons.jsx           # Icon component wrapper`;

const sectionLinks = [
  { id: 'structure', label: 'File Structure' },
  { id: 'contract', label: 'Contract' },
  { id: 'collections', label: 'Collections' },
  { id: 'pages', label: 'Pages' },
  { id: 'settings', label: 'Settings' },
  { id: 'themes', label: 'Themes' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'schemas', label: 'Schemas' },
  { id: 'admin-app', label: 'Admin App' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'plugins', label: 'Plugins' },
];

function DocsMetric({ label, value, detail }) {
  return (
    <div className="docs-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function DocsSnippet({ title, path, summary, code, copied, onCopy, snippetId }) {
  return (
    <div className="docs-snippet">
      <div className="docs-snippet__meta">
        <div>
          <h4 className="docs-snippet__title">{title}</h4>
          <p className="docs-snippet__path"><code>{path}</code></p>
          {summary ? <p className="field-hint docs-snippet__summary">{summary}</p> : null}
        </div>
        <Button
          variant="tertiary"
          size="compact"
          icon={<Copy size={16} />}
          label="Copy code to clipboard"
          onClick={() => onCopy(code, snippetId)}
        >
          {copied === snippetId ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="api-code-block"><code>{code}</code></pre>
    </div>
  );
}

export function DocsPage({ bootstrap }) {
  const [copied, setCopied] = useState(null);
  const site = bootstrap?.site ?? {};
  const pageSyncEnabled = site.content?.collections?.page?.sync !== false;
  const models = bootstrap?.models ?? [];
  const singletons = bootstrap?.singletons ?? [];
  const routes = bootstrap?.routes ?? [];
  const blocks = bootstrap?.blocks ?? [];

  function copyToClipboard(text, snippetId) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(snippetId);
      window.setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  }

  return (
    <div className="screen docs-screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Docs</h1>
          <p className="screen-header__lede">
            Source-first documentation for the current authoring contract: schema, sync modes, themes,
            blocks, admin overrides, and where complexity belongs.
          </p>
        </div>
      </header>

      <div className="docs-hero">
        <div className="docs-hero__copy">
          <h2>
            Edit the source tree, keep the frontend native to WordPress, and let the compiler generate the runtime plugin, theme mount, and admin schemas.
          </h2>
          <nav className="docs-anchor-nav" aria-label="Table of Contents">
            {sectionLinks.map((link) => (
              <a key={link.id} href={`#${link.id}`} className="docs-anchor-link">
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="docs-hero__rail">
          <div className="docs-metrics">
            <DocsMetric label="Collections" value={models.length} />
            <DocsMetric label="Settings" value={singletons.length} />
            <DocsMetric label="Routes" value={routes.length} />
            <DocsMetric label="Blocks" value={blocks.length} />
          </div>
          <div className="docs-runtime">
            <div><span>Theme</span> <strong>{site.theme?.slug ?? 'portfolio-light-theme'}</strong></div>
            <div><span>Plugin</span> <strong>{site.plugin?.slug ?? 'portfolio-light-app'}</strong></div>
            <div><span>Content</span> <strong>{site.content?.mode ?? 'files'}</strong></div>
          </div>
        </div>
      </div>

      <div className="docs-grid">
        <section id="structure" className="docs-section" aria-labelledby="structure-heading">
          <Card className="surface-card docs-card">
            <CardHeader><h3 id="structure-heading">Project Shape</h3></CardHeader>
            <CardBody className="docs-card__body">
              <p className="field-hint">
                The light layer is intentionally flat. Edit source files, rebuild, and let the generator write
                the runtime plugin, theme, site schema, and admin schema for you.
              </p>
              <div className="docs-two-column">
                <DocsSnippet
                  snippetId="file-tree"
                  title="Source and generated directories"
                  path="sites/<site-name>/"
                  summary="Edit the source layer and treat generated output as build artifacts."
                  code={FILE_TREE_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
                <DocsSnippet
                  snippetId="site-config"
                  title="Global site contract"
                  path="app/site.json"
                  summary="Front page, posts page, sync behavior, theme slug, and runtime plugin slug all live here."
                  code={SITE_CONFIG_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
              </div>
              <div className="docs-callout">
                <strong>Rule of thumb:</strong> <code>app/</code> describes structure, <code>content/</code> seeds data,
                <code>theme/</code> stays a native block theme, <code>blocks/</code> is for public runtime behavior,
                and <code>admin/</code> only reshapes generated UI. The canonical repo docs for new-site authoring live in <code>docs/schema/</code> and <code>docs/flat-site-contract.md</code>.
              </div>
            </CardBody>
          </Card>
        </section>

        <section id="contract" className="docs-section" aria-labelledby="contract-heading">
          <Card className="surface-card docs-card">
            <CardHeader><h3 id="contract-heading">Flat Site Contract</h3></CardHeader>
            <CardBody className="docs-card__body">
              <ul className="docs-list">
                <li>Model content once in <code>app/</code> or <code>content/</code>; do not duplicate it in templates.</li>
                <li>Prefer native WordPress theme primitives such as templates, patterns, parts, <code>wp:navigation</code>, and core post blocks.</li>
                <li>Use <code>blocks/</code> for genuine public runtime needs, not for admin dashboards or duplicated content retrieval.</li>
                <li>Keep dashboard and workspace behavior in compiler-owned <code>/app</code> code rather than per-site admin widgets.</li>
                <li>Make sync mode explicit per site instead of assuming page-body markdown is always enabled.</li>
              </ul>
              <div className="docs-callout">
                <strong>Current boundary:</strong> collection meta already maps cleanly into native WordPress patterns such as <code>core/post-meta</code>. Exposing singleton data into theme files still needs a better compiler-owned bridge in some cases; that should be treated as system debt, not as a reason to hardcode duplicate literals into the site.
              </div>
            </CardBody>
          </Card>
        </section>

        <section id="collections" className="docs-section" aria-labelledby="collections-heading">
          <Card className="surface-card docs-card">
            <CardHeader><h3 id="collections-heading">Add a New Collection</h3></CardHeader>
            <CardBody className="docs-card__body">
              <ul className="docs-list">
                <li>Create <code>app/models/&lt;id&gt;.json</code> to define the post type, fields, supports, taxonomies, and editor template.</li>
                <li>Seed records with markdown files in <code>content/&lt;plural-id&gt;/</code> when that collection is sync-enabled.</li>
                <li>Optionally reshape the generated UI with <code>admin/&lt;id&gt;.form.json</code> and <code>admin/&lt;id&gt;.view.json</code>.</li>
              </ul>
              <div className="docs-snippet-stack">
                <DocsSnippet
                  snippetId="collection-model"
                  title="Collection schema"
                  path="app/models/project.json"
                  summary="Drives post type registration, meta registration, editor template, DataViews, DataForm, and REST shape."
                  code={COLLECTION_MODEL_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
                <DocsSnippet
                  snippetId="collection-entry"
                  title="Collection content seed"
                  path="content/projects/acme-rebrand.md"
                  summary="Front matter becomes fields, terms, slug, and title. Markdown body compiles into native Gutenberg blocks."
                  code={COLLECTION_ENTRY_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
                <DocsSnippet
                  snippetId="collection-form"
                  title="Collection editor override"
                  path="admin/project.form.json"
                  summary="Use admin overrides to rearrange fields into grouped sections without changing storage or schema."
                  code={COLLECTION_FORM_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
              </div>
            </CardBody>
          </Card>
        </section>

        <section id="pages" className="docs-section" aria-labelledby="pages-heading">
          <Card className="surface-card docs-card">
            <CardHeader><h3 id="pages-heading">Make Pages</h3></CardHeader>
            <CardBody className="docs-card__body">
              <p className="field-hint">
                Routes are page shells, not long-form content. A route seeds a WordPress page, assigns a template,
                and gives the page a stable site-level identity.
              </p>
              <div className="docs-snippet-stack">
                <DocsSnippet
                  snippetId="route"
                  title="Page route"
                  path="app/routes/about.json"
                  summary="Set the route id, slug, title, template, and whether wp-lite should create the shell page."
                  code={ROUTE_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
                <DocsSnippet
                  snippetId="menu"
                  title="Navigation wiring"
                  path="app/menus/primary.json"
                  summary="Menus are declarative and can point at routes, archives, and other site objects."
                  code={MENU_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
              </div>
              <div className="docs-callout">
                <strong>Page content workflow:</strong>{' '}
                {pageSyncEnabled ? (
                  <>this site has <code>content.collections.page.sync</code> enabled, so route-backed page bodies can round-trip through <code>content/pages/*.md</code>.</>
                ) : (
                  <>this site has <code>content.collections.page.sync</code> disabled, so routes act as page shells and template assignments rather than markdown-backed page files.</>
                )}
              </div>
            </CardBody>
          </Card>
        </section>

        <section id="settings" className="docs-section" aria-labelledby="settings-heading">
          <Card className="surface-card docs-card">
            <CardHeader><h3 id="settings-heading">Add Custom Settings</h3></CardHeader>
            <CardBody className="docs-card__body">
              <p className="field-hint">
                Singletons are option-backed settings surfaces. They compile into REST endpoints, generated forms,
                and seeded data.
              </p>
              <div className="docs-callout">
                <strong>Use Site settings for native WordPress settings:</strong>{' '}
                homepage behavior, posts-per-page, timezone, and discussion defaults like comment enablement
                belong in <code>/app/settings/site</code>, not in a singleton.
              </div>
              <div className="docs-callout">
                <strong>Use users for user preferences:</strong>{' '}
                logged-in WordPress profile settings such as admin color, locale, editor toggles, password, and admin-bar visibility
                belong on the user record under <code>/app/users</code>, not in a singleton.
              </div>
              <div className="docs-snippet-stack">
                <DocsSnippet
                  snippetId="singleton-schema"
                  title="Settings schema"
                  path="app/singletons/profile.json"
                  summary="Define fields exactly once and let the generated settings screen render them."
                  code={SINGLETON_SCHEMA_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
                <DocsSnippet
                  snippetId="singleton-data"
                  title="Seed data"
                  path="content/singletons/profile.json"
                  summary="Seeded singleton data ships with the project and can be pulled back from WordPress when sync is enabled."
                  code={SINGLETON_DATA_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
                <DocsSnippet
                  snippetId="singleton-form"
                  title="Settings form override"
                  path="admin/settings-profile.form.json"
                  summary="Group fields into editorial sections without changing the underlying option structure."
                  code={SINGLETON_FORM_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
              </div>
            </CardBody>
          </Card>
        </section>

        <section id="themes" className="docs-section" aria-labelledby="themes-heading">
          <Card className="surface-card docs-card">
            <CardHeader><h3 id="themes-heading">Create or Change the Theme</h3></CardHeader>
            <CardBody className="docs-card__body">
              <ul className="docs-list">
                <li><code>theme/theme.json</code> defines design tokens, layout constraints, fluid typography, and custom templates.</li>
                <li><code>theme/templates/*.html</code> renders front-end pages, single posts, archives, and page templates.</li>
                <li><code>theme/patterns/*.html</code> holds reusable sections. <code>theme/parts/*.html</code> holds shared headers and footers.</li>
              </ul>
              <div className="docs-two-column">
                <DocsSnippet
                  snippetId="theme-json"
                  title="Theme settings and styles"
                  path="theme/theme.json"
                  summary="Define palette, spacing, typography, layout, global styles, template parts, and custom templates here."
                  code={THEME_JSON_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
                <DocsSnippet
                  snippetId="theme-template"
                  title="Native single template"
                  path="theme/templates/single-project.html"
                  summary="Prefer native post blocks and post-meta bindings before adding site-specific theme logic."
                  code={THEME_TEMPLATE_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
              </div>
              <div className="docs-callout">
                <strong>Theme rule:</strong> keep the frontend native to WordPress. Render menus through <code>app/menus/*.json</code> plus real <code>wp:navigation</code> blocks, and render modeled collection fields through native post blocks and meta bindings before reaching for custom blocks.
              </div>
            </CardBody>
          </Card>
        </section>

        <section id="blocks" className="docs-section" aria-labelledby="blocks-heading">
          <Card className="surface-card docs-card">
            <CardHeader><h3 id="blocks-heading">Add Blocks</h3></CardHeader>
            <CardBody className="docs-card__body">
              <p className="field-hint">
                Each folder in <code>blocks/</code> is a standard WordPress block. Use <code>block.json</code> for metadata,
                <code>render.php</code> for dynamic output, and <code>view.js</code> when the block needs frontend behavior. Keep this directory focused on public runtime behavior rather than admin or dashboard-only code.
              </p>
              <div className="docs-snippet-stack">
                <DocsSnippet
                  snippetId="block-json"
                  title="Block metadata"
                  path="blocks/contact-form/block.json"
                  summary="Register the block and point WordPress at its server render and optional frontend script."
                  code={BLOCK_METADATA_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
                <DocsSnippet
                  snippetId="block-render"
                  title="Dynamic render callback"
                  path="blocks/contact-form/render.php"
                  summary="Server-rendered blocks are ideal when output depends on runtime data or form processing."
                  code={BLOCK_RENDER_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
              </div>
            </CardBody>
          </Card>
        </section>

        <section id="schemas" className="docs-section" aria-labelledby="schemas-heading">
          <Card className="surface-card docs-card">
            <CardHeader><h3 id="schemas-heading">Schemas and Overrides</h3></CardHeader>
            <CardBody className="docs-card__body">
              <p className="field-hint">
                The compiler turns your source layer into generated site and admin schemas. Override files only reshape the UI,
                while the generated schema in <code>generated/site-schema.json</code> captures the full compiled contract.
              </p>
              <DocsSnippet
                snippetId="view-override"
                title="List view override"
                path="admin/project.view.json"
                summary="Pick columns, filters, layout, and default sort for the generated DataViews table."
                code={VIEW_OVERRIDE_SNIPPET}
                copied={copied}
                onCopy={copyToClipboard}
              />
              <div className="docs-callout">
                <strong>Compile outputs:</strong> <code>generated/site-schema.json</code> stores the merged site contract,
                <code>generated/admin-schema/*.json</code> stores generated list and form schemas, and
                <code>generated/wp-content/</code> contains the mounted plugin and theme used by the local target.
              </div>
            </CardBody>
          </Card>
        </section>

        <section id="admin-app" className="docs-section" aria-labelledby="admin-app-heading">
          <Card className="surface-card docs-card">
            <CardHeader><h3 id="admin-app-heading">Admin App Architecture</h3></CardHeader>
            <CardBody className="docs-card__body">
              <p className="field-hint">
                The admin is a standalone React app that boots from a single <code>GET /wp-json/portfolio/v1/bootstrap</code>
                call. That payload contains models, singletons, routes, blocks, records, navigation, theme config, and
                admin schemas. The <code>portfolio/v1</code> namespace and related runtime globals are legacy names that still exist in the current implementation.
              </p>
              <div className="docs-two-column">
                <DocsSnippet
                  snippetId="admin-app-tree"
                  title="Component and library layout"
                  path="packages/compiler/admin-app/src/"
                  summary="Each screen is its own component. Shared utilities live in lib/. The entry point is minimal — it fetches bootstrap data and renders the shell."
                  code={ADMIN_APP_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
                <div className="docs-snippet-stack">
                  <div className="docs-callout">
                    <strong>Key patterns:</strong>
                    <ul className="docs-list" style={{ marginTop: '8px' }}>
                      <li><code>shell.jsx</code> owns React Router and the sidebar. All screens are lazy routes.</li>
                      <li><code>collections.jsx</code> uses <code>@wordpress/dataviews</code> for list views and DataForm for editors.</li>
                      <li><code>helpers.js</code> provides <code>apiFetch</code>, field builders, and routing utilities used across all screens.</li>
                    </ul>
                  </div>
                  <div className="docs-callout">
                    <strong>Adding a screen:</strong> create a component in <code>components/</code>,
                    add a route in <code>shell.jsx</code>, and add a navigation entry to the sidebar config.
                    The bootstrap payload already contains all the data most screens need.
                  </div>
                  <div className="docs-callout">
                    <strong>Global navigation:</strong> the admin shell exposes a shared command bar on <code>Cmd/Ctrl + K</code>.
                    It merges local route commands, bootstrapped records, and live WordPress REST search for users, media, and comments.
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </section>

        <section id="workflow" className="docs-section" aria-labelledby="workflow-heading">
          <Card className="surface-card docs-card">
            <CardHeader><h3 id="workflow-heading">Development Workflow</h3></CardHeader>
            <CardBody className="docs-card__body">
              <p className="field-hint">
                The CLI wraps the full build, sync, and watch pipeline. Site-level npm scripts proxy the most common operations and optionally support a Docker-based <code>wp-env</code> flow.
              </p>
              <div className="docs-two-column">
                <DocsSnippet
                  snippetId="commands"
                  title="wp-lite CLI commands"
                  path="packages/compiler/wp-lite.mjs"
                  summary="The core pipeline: init, build, apply, dev, pull, and eject."
                  code={COMMANDS_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
                <DocsSnippet
                  snippetId="npm-scripts"
                  title="npm script shortcuts"
                  path="sites/<site-name>/package.json"
                  summary="Day-to-day commands including wp-env lifecycle and reseeding."
                  code={NPM_SCRIPTS_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
              </div>
              <div className="docs-callout">
                <strong>Typical workflow:</strong> run <code>npm run dev</code> to start watching for changes.
                Use <code>npm run rebuild</code> to do a clean build and re-seed. Use <code>npm run pull</code>
                to write WordPress content back into your markdown and JSON source files.
              </div>
            </CardBody>
          </Card>
        </section>

        <section id="plugins" className="docs-section" aria-labelledby="plugins-heading">
          <Card className="surface-card docs-card">
            <CardHeader><h3 id="plugins-heading">Extend with Plugins</h3></CardHeader>
            <CardBody className="docs-card__body">
              <p className="field-hint">
                The generated runtime plugin is <code>{site.plugin?.slug ?? 'portfolio-light-app'}</code>. That plugin is what
                the local Playground mounts automatically. If you need custom hooks, extra REST endpoints, or code that should
                live outside the generated runtime, add a sibling plugin and promote it in the target environment as the project grows.
              </p>
              <DocsSnippet
                snippetId="plugin"
                title="Example custom plugin"
                path="plugins/portfolio-enhancements/portfolio-enhancements.php"
                summary="Use a custom plugin for durable WordPress hooks and extensions that should not be regenerated."
                code={PLUGIN_SNIPPET}
                copied={copied}
                onCopy={copyToClipboard}
              />
              <div className="docs-callout">
                <strong>Current local behavior:</strong> the source tree already tracks a <code>plugins/</code> directory in the dev workflow,
                but the built-in Playground mount is still the generated runtime plugin plus the generated theme. Treat custom plugins as an escape hatch for deployment targets or post-eject projects.
              </div>
            </CardBody>
          </Card>
        </section>
      </div>
    </div>
  );
}
