/**
 * Interactivity API bridge for dashboard block-widgets.
 *
 * Server-rendered widgets emit HTML with data-wp-* directives and a JSON
 * state blob (emitted by wp_interactivity_state/wp_interactivity_config
 * on the PHP side). The global WP runtime auto-hydrates on DOMContentLoaded,
 * but block-widgets get injected after that event — we need to re-trigger
 * the scan each time a widget's HTML arrives.
 *
 * Import side effects register the runtime. `hydrateInteractivity(root)` is
 * a best-effort scan for the given subtree; it falls back to the global
 * hydrate when the scoped API isn't available on this WP version.
 */

let runtime;

async function getRuntime() {
  if (runtime) return runtime;
  try {
    runtime = await import('@wordpress/interactivity');
  } catch (error) {
    console.warn('[interactivity] runtime unavailable:', error);
    runtime = null;
  }
  return runtime;
}

export async function hydrateInteractivity(root) {
  const rt = await getRuntime();
  if (!rt || !root) return;

  // Consume any inline <script type="application/json" id="wp-interactivity-data">
  // blobs the server rendered inside this subtree, merging them into the runtime
  // store. This lets server-seeded wp_interactivity_state() reach the client.
  const dataScripts = root.querySelectorAll('script[type="application/json"][data-wp-interactivity-data]');
  for (const el of dataScripts) {
    try {
      const payload = JSON.parse(el.textContent || '{}');
      for (const [namespace, slice] of Object.entries(payload.state ?? {})) {
        if (typeof rt.store === 'function') {
          rt.store(namespace, { state: slice });
        }
      }
    } catch (error) {
      console.warn('[interactivity] bad data blob', error);
    }
  }

  // Kick the scanner. Newer versions expose `getInteractivityRouter` / auto-scan;
  // older ones re-run via a `wpInteractivityReady` custom event. Try both.
  if (typeof rt.__unstableHydrate === 'function') {
    rt.__unstableHydrate(root);
  } else {
    window.dispatchEvent(new CustomEvent('wp-interactivity:rescan', { detail: { root } }));
  }
}
