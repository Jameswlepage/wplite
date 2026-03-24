import React, { useState } from 'react';
import { Button, Card, CardBody, CardHeader } from '@wordpress/components';
import { Copy } from '@carbon/icons-react';

const FILE_TREE_SNIPPET = String.raw`app/
  site.json
  models/
    experience.json
    inquiry.json
    project.json
    testimonial.json
  singletons/
    contact.json
    profile.json
    seo.json
  routes/
    about.json
    contact.json
    home.json
    writing.json
  menus/
    footer.json
    primary.json
content/
  experiences/automattic.md
  posts/welcome.md
  projects/acme-rebrand.md
  testimonials/acme-ceo.md
  singletons/
    contact.json
    profile.json
    seo.json
theme/
  theme.json
  templates/
  patterns/
  parts/
blocks/
  contact-form/
  profile-hero/
  project-filter/
  project-metrics/
admin/
  project.form.json
  project.view.json
  settings-profile.form.json
  testimonial.view.json
admin-app/
  src/
    main.jsx
    docs.jsx
    styles.css
    components/
    lib/
scripts/
  compile.mjs
  wp-light.mjs
generated/
  site-schema.json
  admin-schema/
  wp-content/plugins/portfolio-light-app/
  wp-content/themes/portfolio-light-theme/`;

const SITE_CONFIG_SNIPPET = String.raw`{
  "id": "portfolio-site",
  "title": "Jane Doe",
  "tagline": "Designer, developer, and AI builder",
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
      "experience": { "sync": true },
      "post": { "sync": true },
      "page": { "sync": false }
    }
  },
  "frontPage": "home",
  "postsPage": "writing",
  "theme": {
    "slug": "portfolio-light-theme",
    "sourceDir": "theme"
  },
  "plugin": {
    "slug": "portfolio-light-app"
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
    "avatar": { "type": "image", "label": "Avatar" },
    "color_scheme": {
      "type": "select",
      "label": "Color Scheme",
      "options": ["default", "light", "midnight", "ocean", "sunrise", "coffee"]
    }
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
      },
      {
        "id": "appearance",
        "label": "Appearance",
        "children": ["color_scheme"]
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

<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group">
  <!-- wp:portfolio/profile-hero /-->

  <!-- wp:spacer {"height":"64px"} /-->

  <!-- wp:pattern {"slug":"portfolio-light-theme/featured-projects"} /-->

  <!-- wp:spacer {"height":"64px"} /-->

  <!-- wp:pattern {"slug":"portfolio-light-theme/contact-cta"} /-->
</div>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->`;

const BLOCK_METADATA_SNIPPET = String.raw`{
  "apiVersion": 3,
  "name": "portfolio/project-filter",
  "title": "Project Filter",
  "category": "widgets",
  "icon": "filter",
  "description": "Shows project taxonomy shortcuts.",
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

const COMMANDS_SNIPPET = String.raw`npx wp-light init
# Display current site.json and initialize the source tree.

npx wp-light build
# Compile site schemas, generated plugin/theme, and the /app admin bundle.

npx wp-light apply
# Build, boot the local target, activate generated runtime, and seed content.

npx wp-light dev
# Watch app/, content/, theme/, admin/, blocks/, admin-app/, and scripts/.

npx wp-light pull
# Write synced WordPress content back into markdown and singleton JSON files.

npx wp-light eject
# Mark the project as graduated out of the light layer.`;

const NPM_SCRIPTS_SNIPPET = String.raw`npm run build          # Full compile + admin bundle
npm run dev            # Watch mode with live rebuilds
npm run apply          # Build, boot target, activate, seed
npm run pull           # Sync WordPress content back to files

npm run wp-env:start   # Build then start the Docker environment
npm run wp-env:stop    # Stop the Docker environment
npm run wp-env:destroy # Tear down the Docker environment

npm run seed           # Re-seed content into running WordPress
npm run rebuild        # Build + seed in one step
npm run compile        # Compile schemas only (no admin bundle)
npm run build:admin    # Build admin bundle only (Vite)`;

const ADMIN_APP_SNIPPET = String.raw`admin-app/src/
  main.jsx              # Entry point (bootstraps React app)
  docs.jsx              # This documentation page
  styles.css            # Global styles

  components/
    shell.jsx           # App shell, routing, sidebar navigation
    dashboard.jsx       # Dashboard with sortable widget blocks
    collections.jsx     # DataViews list + DataForm editor
    pages.jsx           # WordPress core pages management
    settings.jsx        # Singleton settings editors
    media.jsx           # Media library
    users.jsx           # User management
    workspace.jsx       # Domains, API, Logs screens
    block-editor.jsx    # Gutenberg block editor frame
    controls.jsx        # Shared form controls and utilities
    skeletons.jsx       # Loading skeleton components

  lib/
    config.js           # Runtime configuration and paths
    helpers.js          # API fetching, field builders, routing
    blocks.jsx          # Block type registration and conversion
    icons.jsx           # Icon component wrapper`;

const sectionLinks = [
  { id: 'structure', label: 'File Structure' },
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
            Source-first documentation for extending this site: collections, routes, themes, settings,
            blocks, generated schemas, the admin app, and the runtime build flow.
          </p>
        </div>
      </header>

      <div className="docs-hero">
        <div className="docs-hero__copy">
          <h2>
            Edit source files, rebuild, and the generator writes the runtime plugin, theme, and admin schemas.
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
                  path="project root"
                  summary="Edit the source layer. Treat generated output as build artifacts."
                  code={FILE_TREE_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
                <DocsSnippet
                  snippetId="site-config"
                  title="Global site contract"
                  path="app/site.json"
                  summary="Front page, posts page, sync mode, theme slug, and runtime plugin slug all live here."
                  code={SITE_CONFIG_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
              </div>
              <div className="docs-callout">
                <strong>Rule of thumb:</strong> <code>app/</code> describes structure, <code>content/</code> seeds data,
                <code>theme/</code> renders the frontend, <code>blocks/</code> adds runtime blocks, <code>admin/</code>
                reshapes generated list and form behavior, and <code>admin-app/</code> is the React admin itself.
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
                  summary="Set the route id, slug, title, template, and whether wp-light should create the shell page."
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
                <strong>Page content workflow:</strong> in this site <code>content.collections.page.sync</code> is off,
                so layout stays theme-coded while editors manage page content and status through the Pages screen in <code>/app</code>.
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
                  title="Front-page template"
                  path="theme/templates/front-page.html"
                  summary="Theme templates compose template parts, patterns, and custom blocks into the public site."
                  code={THEME_TEMPLATE_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
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
                <code>render.php</code> for dynamic output, and <code>view.js</code> when the block needs frontend behavior.
              </p>
              <div className="docs-snippet-stack">
                <DocsSnippet
                  snippetId="block-json"
                  title="Block metadata"
                  path="blocks/project-filter/block.json"
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
                The admin is a standalone React app that boots from a single <code>POST /wp-json/portfolio/v1/bootstrap</code>
                call. That payload contains models, singletons, routes, blocks, records, navigation, theme config, and
                admin schemas. Every screen reads from this shared state.
              </p>
              <div className="docs-two-column">
                <DocsSnippet
                  snippetId="admin-app-tree"
                  title="Component and library layout"
                  path="admin-app/src/"
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
                      <li><code>dashboard.jsx</code> registers custom Gutenberg blocks as sortable widgets via <code>@dnd-kit</code>.</li>
                      <li><code>helpers.js</code> provides <code>apiFetch</code>, field builders, and routing utilities used across all screens.</li>
                    </ul>
                  </div>
                  <div className="docs-callout">
                    <strong>Adding a screen:</strong> create a component in <code>components/</code>,
                    add a route in <code>shell.jsx</code>, and add a navigation entry to the sidebar config.
                    The bootstrap payload already contains all the data most screens need.
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
                The CLI wraps the full build, sync, and watch pipeline. npm scripts provide shortcuts
                for the most common operations, including the Docker-based wp-env local environment.
              </p>
              <div className="docs-two-column">
                <DocsSnippet
                  snippetId="commands"
                  title="wp-light CLI commands"
                  path="scripts/wp-light.mjs"
                  summary="The core pipeline: init, build, apply, dev, pull, and eject."
                  code={COMMANDS_SNIPPET}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
                <DocsSnippet
                  snippetId="npm-scripts"
                  title="npm script shortcuts"
                  path="package.json"
                  summary="Day-to-day commands including wp-env lifecycle, seeding, and incremental builds."
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
