import { launcherIconSvg, wordpressIconSvg } from './icons.mjs';

export function phpRegisterFrontendLauncherFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_frontend_launcher_should_render() {
\tif ( is_admin() || ! is_user_logged_in() || portfolio_light_is_app_request() ) {
\t\treturn false;
\t}

\treturn true;
}

function portfolio_light_frontend_launcher_current_edit_url() {
\t$post = get_queried_object();
\tif ( ! ( $post instanceof WP_Post ) || ! current_user_can( 'edit_post', $post->ID ) ) {
\t\treturn '';
\t}

\tif ( 'page' === $post->post_type ) {
\t\treturn home_url( '/app/pages/' . $post->ID );
\t}

\treturn admin_url( 'post.php?post=' . $post->ID . '&action=edit' );
}

function portfolio_light_frontend_launcher_items() {
\t$current_user = wp_get_current_user();
\t$items = [];
\t$edit_url = portfolio_light_frontend_launcher_current_edit_url();

\tif ( $edit_url ) {
\t\t$items[] = [
\t\t\t'key'   => 'edit',
\t\t\t'label' => __( 'Edit Page', 'portfolio-light' ),
\t\t\t'url'   => $edit_url,
\t\t\t'icon'  => '${launcherIconSvg('edit')}',
\t\t];
\t}

\t$items[] = [
\t\t'key'    => 'search',
\t\t'label'  => __( 'Search Site', 'portfolio-light' ),
\t\t'action' => 'search',
\t\t'icon'   => '${launcherIconSvg('search')}',
\t];

\t$items[] = [
\t\t'key'   => 'admin',
\t\t'label' => __( 'Go to Admin', 'portfolio-light' ),
\t\t'url'   => home_url( '/app' ),
\t\t'icon'  => '${launcherIconSvg('admin')}',
\t];

\t$items[] = [
\t\t'key'   => 'account',
\t\t'label' => __( 'User Account', 'portfolio-light' ),
\t\t'url'   => home_url( '/app/users/' . $current_user->ID ),
\t\t'icon'  => '${launcherIconSvg('account')}',
\t];

\treturn $items;
}

add_action(
\t'init',
\tfunction() {
\t\tif ( ! portfolio_light_frontend_launcher_should_render() ) {
\t\t\treturn;
\t\t}

\t\tadd_filter(
\t\t\t'show_admin_bar',
\t\t\tfunction() {
\t\t\t\treturn false;
\t\t\t},
\t\t\t100
\t\t);
\t}
);

add_action(
\t'wp_enqueue_scripts',
\tfunction() {
\t\tif ( ! portfolio_light_frontend_launcher_should_render() ) {
\t\t\treturn;
\t\t}

\t\t$plugin_file = glob( dirname( __DIR__ ) . '/*.php' )[0] ?? __FILE__;
\t\t$style_path  = dirname( $plugin_file ) . '/assets/frontend-launcher.css';
\t\t$style_url   = plugins_url( 'assets/frontend-launcher.css', $plugin_file );
\t\t$style_ver   = file_exists( $style_path ) ? (string) filemtime( $style_path ) : null;
\t\t$script_path = dirname( $plugin_file ) . '/assets/frontend-launcher.js';
\t\t$script_url  = plugins_url( 'assets/frontend-launcher.js', $plugin_file );
\t\t$script_ver  = file_exists( $script_path ) ? (string) filemtime( $script_path ) : null;

\t\tif ( file_exists( $style_path ) ) {
\t\t\twp_enqueue_style( 'wplite-frontend-launcher', $style_url, [], $style_ver );
\t\t}

\t\tif ( file_exists( $script_path ) ) {
\t\t\twp_enqueue_script( 'wplite-frontend-launcher', $script_url, [], $script_ver, true );
\t\t}
\t}
);

add_action(
\t'wp_footer',
\tfunction() {
\t\tif ( ! portfolio_light_frontend_launcher_should_render() ) {
\t\t\treturn;
\t\t}

\t\t$items = portfolio_light_frontend_launcher_items();
\t\tif ( empty( $items ) ) {
\t\t\treturn;
\t\t}
\t\t?>
\t\t<div
\t\t\tclass="wplite-frontend-launcher"
\t\t\tdata-wplite-launcher
\t\t\tdata-wplite-search-url="<?php echo esc_url( home_url( '/' ) ); ?>"
\t\t\tstyle="--wplite-launcher-items: <?php echo (int) count( $items ); ?>;"
\t\t>
\t\t\t<div class="wplite-frontend-launcher__dock">
\t\t\t\t<button
\t\t\t\t\ttype="button"
\t\t\t\t\tclass="wplite-frontend-launcher__toggle"
\t\t\t\t\tdata-wplite-launcher-toggle
\t\t\t\t\tdata-tooltip="<?php echo esc_attr__( 'WordPress tools', 'portfolio-light' ); ?>"
\t\t\t\t\taria-expanded="false"
\t\t\t\t\taria-label="<?php echo esc_attr__( 'Open WordPress tools', 'portfolio-light' ); ?>"
\t\t\t\t>
\t\t\t\t\t${wordpressIconSvg({ width: 17, height: 17 })}
\t\t\t\t</button>
\t\t\t\t<nav class="wplite-frontend-launcher__menu" aria-label="<?php echo esc_attr__( 'WordPress tools', 'portfolio-light' ); ?>">
\t\t\t\t\t<?php foreach ( $items as $item ) : ?>
\t\t\t\t\t\t<?php if ( ! empty( $item['action'] ) ) : ?>
\t\t\t\t\t\t\t<button
\t\t\t\t\t\t\t\ttype="button"
\t\t\t\t\t\t\t\tclass="wplite-frontend-launcher__item"
\t\t\t\t\t\t\t\tdata-tooltip="<?php echo esc_attr( $item['label'] ); ?>"
\t\t\t\t\t\t\t\tdata-wplite-launcher-action="<?php echo esc_attr( $item['action'] ); ?>"
\t\t\t\t\t\t\t\taria-label="<?php echo esc_attr( $item['label'] ); ?>"
\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t<span class="wplite-frontend-launcher__item-icon" aria-hidden="true"><?php echo $item['icon']; ?></span>
\t\t\t\t\t\t\t\t<span class="wplite-frontend-launcher__item-label"><?php echo esc_html( $item['label'] ); ?></span>
\t\t\t\t\t\t\t</button>
\t\t\t\t\t\t<?php else : ?>
\t\t\t\t\t\t\t<a
\t\t\t\t\t\t\t\tclass="wplite-frontend-launcher__item"
\t\t\t\t\t\t\t\thref="<?php echo esc_url( $item['url'] ); ?>"
\t\t\t\t\t\t\t\tdata-tooltip="<?php echo esc_attr( $item['label'] ); ?>"
\t\t\t\t\t\t\t\taria-label="<?php echo esc_attr( $item['label'] ); ?>"
\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t<span class="wplite-frontend-launcher__item-icon" aria-hidden="true"><?php echo $item['icon']; ?></span>
\t\t\t\t\t\t\t\t<span class="wplite-frontend-launcher__item-label"><?php echo esc_html( $item['label'] ); ?></span>
\t\t\t\t\t\t\t</a>
\t\t\t\t\t\t<?php endif; ?>
\t\t\t\t\t<?php endforeach; ?>
\t\t\t\t</nav>
\t\t\t</div>
\t\t</div>
\t\t<?php
\t}
);
`;
}

export function frontendLauncherCss() {
  return `.wplite-frontend-launcher {
  --wplite-launcher-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  --wplite-launcher-surface: #1d2327;
  --wplite-launcher-surface-hover: #2c3338;
  --wplite-launcher-border: #3c434a;
  --wplite-launcher-icon: #ffffff;
  --wplite-launcher-icon-muted: rgba(255, 255, 255, 0.82);
  --wplite-launcher-focus: #72aee6;
  --wplite-launcher-tooltip-bg: #f6f7f7;
  --wplite-launcher-tooltip-border: #dcdcde;
  --wplite-launcher-tooltip-text: #1d2327;
  --wplite-launcher-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
  --wplite-launcher-radius: 999px;
  position: fixed;
  left: 24px;
  bottom: 24px;
  z-index: 99998;
  font-family: var(--wplite-launcher-font);
  pointer-events: none;
}

.wplite-frontend-launcher * {
  box-sizing: border-box;
}

.wplite-frontend-launcher__dock {
  display: flex;
  align-items: center;
  min-height: 46px;
  padding: 2px;
  border: 1px solid var(--wplite-launcher-border);
  border-radius: var(--wplite-launcher-radius);
  background: var(--wplite-launcher-surface);
  box-shadow: var(--wplite-launcher-shadow);
  overflow: hidden;
  pointer-events: auto;
  transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

.wplite-frontend-launcher__toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--wplite-launcher-icon);
  cursor: pointer;
  appearance: none;
  transition: background-color 160ms ease, color 160ms ease;
}

.wplite-frontend-launcher__toggle:hover,
.wplite-frontend-launcher__toggle:focus-visible,
.wplite-frontend-launcher.is-open .wplite-frontend-launcher__toggle,
.wplite-frontend-launcher:hover .wplite-frontend-launcher__toggle {
  background: var(--wplite-launcher-surface-hover);
}

.wplite-frontend-launcher__toggle:focus-visible,
.wplite-frontend-launcher__item:focus-visible {
  outline: 2px solid var(--wplite-launcher-focus);
  outline-offset: 2px;
}

.wplite-frontend-launcher__toggle::after {
  content: attr(data-tooltip);
  position: absolute;
  left: 50%;
  bottom: calc(100% + 10px);
  transform: translate(-50%, 4px);
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--wplite-launcher-tooltip-bg);
  border: 1px solid var(--wplite-launcher-tooltip-border);
  color: var(--wplite-launcher-tooltip-text);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease, transform 140ms ease;
}

.wplite-frontend-launcher__toggle:hover::after,
.wplite-frontend-launcher__toggle:focus-visible::after {
  opacity: 1;
  transform: translate(-50%, 0);
}

.wplite-frontend-launcher__toggle svg,
.wplite-frontend-launcher__item svg {
  display: block;
}

.wplite-frontend-launcher__menu {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 0;
  overflow: hidden;
  padding: 0 0 0 2px;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-4px);
  transition:
    max-width 220ms cubic-bezier(0.2, 0.7, 0, 1),
    opacity 140ms ease,
    transform 220ms cubic-bezier(0.2, 0.7, 0, 1),
    padding-inline 220ms cubic-bezier(0.2, 0.7, 0, 1);
}

.wplite-frontend-launcher:hover .wplite-frontend-launcher__menu,
.wplite-frontend-launcher:focus-within .wplite-frontend-launcher__menu,
.wplite-frontend-launcher.is-open .wplite-frontend-launcher__menu {
  max-width: min(520px, calc(100vw - 84px));
  overflow: visible;
  padding-right: 10px;
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
}

.wplite-frontend-launcher__item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  width: auto;
  min-width: 42px;
  height: 42px;
  flex: 0 0 auto;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--wplite-launcher-icon-muted);
  text-decoration: none;
  box-shadow: none;
  transition:
    opacity 140ms ease,
    color 140ms ease,
    background-color 140ms ease;
}

.wplite-frontend-launcher__item:hover,
.wplite-frontend-launcher__item:focus-visible {
  background: var(--wplite-launcher-surface-hover);
  color: var(--wplite-launcher-icon);
  opacity: 1;
}

.wplite-frontend-launcher__item::after {
  content: attr(data-tooltip);
  position: absolute;
  left: 50%;
  bottom: calc(100% + 10px);
  transform: translate(-50%, 4px);
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--wplite-launcher-tooltip-bg);
  border: 1px solid var(--wplite-launcher-tooltip-border);
  color: var(--wplite-launcher-tooltip-text);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.01em;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease, transform 140ms ease;
}

.wplite-frontend-launcher__item:hover::after,
.wplite-frontend-launcher__item:focus-visible::after {
  opacity: 1;
  transform: translate(-50%, 0);
}

.wplite-frontend-launcher__item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 16px;
}

.wplite-frontend-launcher__item-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .wplite-frontend-launcher {
    left: 16px;
    bottom: 16px;
  }

  .wplite-frontend-launcher:hover .wplite-frontend-launcher__menu,
  .wplite-frontend-launcher:focus-within .wplite-frontend-launcher__menu,
  .wplite-frontend-launcher.is-open .wplite-frontend-launcher__menu {
    max-width: calc(100vw - 84px);
  }
}
`;
}

export function frontendLauncherJs() {
  return `(() => {
  const launchers = document.querySelectorAll('[data-wplite-launcher]');
  if (!launchers.length) {
    return;
  }

  launchers.forEach((launcher) => {
    const toggle = launcher.querySelector('[data-wplite-launcher-toggle]');
    if (!toggle) {
      return;
    }

    const setOpen = (nextOpen) => {
      launcher.classList.toggle('is-open', nextOpen);
      toggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    };
    const searchUrl = launcher.getAttribute('data-wplite-search-url') || window.location.origin + '/';

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      setOpen(!launcher.classList.contains('is-open'));
    });

    const actionButtons = launcher.querySelectorAll('[data-wplite-launcher-action]');
    actionButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        const action = button.getAttribute('data-wplite-launcher-action');
        if (action !== 'search') {
          return;
        }

        event.preventDefault();
        const query = window.prompt('Search this site');
        if (!query || !query.trim()) {
          return;
        }

        const target = new URL(searchUrl, window.location.href);
        target.searchParams.set('s', query.trim());
        window.location.assign(target.toString());
      });
    });

    launcher.addEventListener('mouseleave', () => {
      if (!launcher.matches(':focus-within')) {
        setOpen(false);
      }
    });

    document.addEventListener('click', (event) => {
      if (!launcher.contains(event.target)) {
        setOpen(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    });
  });
})();`;
}
