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
\t$items        = [];
\t$edit_url     = portfolio_light_frontend_launcher_current_edit_url();

\tif ( $edit_url ) {
\t\t$items[] = [
\t\t\t'key'            => 'edit',
\t\t\t'label'          => __( 'Edit Page', 'portfolio-light' ),
\t\t\t'subtitle'       => __( 'Jump directly into the current canvas', 'portfolio-light' ),
\t\t\t'url'            => $edit_url,
\t\t\t'icon'           => '${launcherIconSvg('edit')}',
\t\t\t'priority'       => 1180,
\t\t\t'empty_priority' => 1220,
\t\t];
\t}

\t$items[] = [
\t\t'key'    => 'search',
\t\t'label'  => __( 'Search Site', 'portfolio-light' ),
\t\t'action' => 'search',
\t\t'icon'   => '${launcherIconSvg('search')}',
\t];

\t$items[] = [
\t\t'key'            => 'admin',
\t\t'label'          => __( 'Go to Admin', 'portfolio-light' ),
\t\t'subtitle'       => __( 'Open the WPLite workspace', 'portfolio-light' ),
\t\t'url'            => home_url( '/app' ),
\t\t'icon'           => '${launcherIconSvg('admin')}',
\t\t'priority'       => 1080,
\t\t'empty_priority' => 1120,
\t];

\t$items[] = [
\t\t'key'            => 'account',
\t\t'label'          => __( 'User Account', 'portfolio-light' ),
\t\t'subtitle'       => __( 'Edit your profile, avatar, and preferences', 'portfolio-light' ),
\t\t'url'            => home_url( '/app/users/' . $current_user->ID ),
\t\t'icon'           => '${launcherIconSvg('account')}',
\t\t'avatar_url'     => get_avatar_url(
\t\t\t$current_user->ID,
\t\t\t[
\t\t\t\t'size' => 96,
\t\t\t]
\t\t),
\t\t'priority'       => 980,
\t\t'empty_priority' => 1020,
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
\t\t\tdata-wplite-bootstrap-url="<?php echo esc_url( rest_url( 'portfolio/v1/bootstrap' ) ); ?>"
\t\t\tdata-wplite-wp-rest-root="<?php echo esc_url( rest_url() ); ?>"
\t\t\tdata-wplite-rest-nonce="<?php echo esc_attr( wp_create_nonce( 'wp_rest' ) ); ?>"
\t\t\tdata-wplite-app-base="<?php echo esc_url( home_url( '/app' ) ); ?>"
\t\t\tdata-wplite-default-corner="bottom-left"
\t\t>
\t\t\t<div class="wplite-frontend-launcher__results" data-wplite-launcher-results aria-live="polite" hidden></div>
\t\t\t<div class="wplite-frontend-launcher__dock">
\t\t\t\t<button
\t\t\t\t\ttype="button"
\t\t\t\t\tclass="wplite-frontend-launcher__toggle"
\t\t\t\t\tdata-wplite-launcher-toggle
\t\t\t\t\tdata-tooltip="<?php echo esc_attr__( 'WordPress tools', 'portfolio-light' ); ?>"
\t\t\t\t\taria-expanded="false"
\t\t\t\t\taria-label="<?php echo esc_attr__( 'Open WordPress tools', 'portfolio-light' ); ?>"
\t\t\t\t>
\t\t\t\t\t<span class="wplite-frontend-launcher__toggle-glyph">
\t\t\t\t\t\t${wordpressIconSvg({ width: 28, height: 28, className: 'wplite-frontend-launcher__wordpress-icon' })}
\t\t\t\t\t</span>
\t\t\t\t</button>
\t\t\t\t<nav class="wplite-frontend-launcher__menu" aria-label="<?php echo esc_attr__( 'WordPress tools', 'portfolio-light' ); ?>">
\t\t\t\t\t<?php foreach ( $items as $item ) : ?>
\t\t\t\t\t\t<?php $item_class = 'wplite-frontend-launcher__item' . ( ! empty( $item['avatar_url'] ) ? ' is-avatar' : '' ); ?>
\t\t\t\t\t\t<?php if ( ! empty( $item['action'] ) ) : ?>
\t\t\t\t\t\t\t<button
\t\t\t\t\t\t\t\ttype="button"
\t\t\t\t\t\t\t\tclass="<?php echo esc_attr( $item_class ); ?>"
\t\t\t\t\t\t\t\tdata-tooltip="<?php echo esc_attr( $item['label'] ); ?>"
\t\t\t\t\t\t\t\tdata-wplite-launcher-item
\t\t\t\t\t\t\t\tdata-wplite-launcher-key="<?php echo esc_attr( $item['key'] ); ?>"
\t\t\t\t\t\t\t\tdata-wplite-launcher-title="<?php echo esc_attr( $item['label'] ); ?>"
\t\t\t\t\t\t\t\tdata-wplite-launcher-subtitle="<?php echo esc_attr( $item['subtitle'] ?? '' ); ?>"
\t\t\t\t\t\t\t\tdata-wplite-launcher-priority="<?php echo esc_attr( (string) ( $item['priority'] ?? 0 ) ); ?>"
\t\t\t\t\t\t\t\tdata-wplite-launcher-empty-priority="<?php echo esc_attr( (string) ( $item['empty_priority'] ?? 0 ) ); ?>"
\t\t\t\t\t\t\t\tdata-wplite-launcher-action="<?php echo esc_attr( $item['action'] ); ?>"
\t\t\t\t\t\t\t\taria-label="<?php echo esc_attr( $item['label'] ); ?>"
\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t<span class="wplite-frontend-launcher__item-icon" aria-hidden="true"><?php echo $item['icon']; ?></span>
\t\t\t\t\t\t\t\t<span class="wplite-frontend-launcher__item-label"><?php echo esc_html( $item['label'] ); ?></span>
\t\t\t\t\t\t\t</button>
\t\t\t\t\t\t<?php else : ?>
\t\t\t\t\t\t\t<a
\t\t\t\t\t\t\t\tclass="<?php echo esc_attr( $item_class ); ?>"
\t\t\t\t\t\t\t\thref="<?php echo esc_url( $item['url'] ); ?>"
\t\t\t\t\t\t\t\tdata-tooltip="<?php echo esc_attr( $item['label'] ); ?>"
\t\t\t\t\t\t\t\tdata-wplite-launcher-item
\t\t\t\t\t\t\t\tdata-wplite-launcher-key="<?php echo esc_attr( $item['key'] ); ?>"
\t\t\t\t\t\t\t\tdata-wplite-launcher-title="<?php echo esc_attr( $item['label'] ); ?>"
\t\t\t\t\t\t\t\tdata-wplite-launcher-subtitle="<?php echo esc_attr( $item['subtitle'] ?? '' ); ?>"
\t\t\t\t\t\t\t\tdata-wplite-launcher-priority="<?php echo esc_attr( (string) ( $item['priority'] ?? 0 ) ); ?>"
\t\t\t\t\t\t\t\tdata-wplite-launcher-empty-priority="<?php echo esc_attr( (string) ( $item['empty_priority'] ?? 0 ) ); ?>"
\t\t\t\t\t\t\t\tdata-wplite-launcher-avatar-url="<?php echo esc_url( $item['avatar_url'] ?? '' ); ?>"
\t\t\t\t\t\t\t\taria-label="<?php echo esc_attr( $item['label'] ); ?>"
\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t<?php if ( ! empty( $item['avatar_url'] ) ) : ?>
\t\t\t\t\t\t\t\t\t<span class="wplite-frontend-launcher__item-avatar" aria-hidden="true">
\t\t\t\t\t\t\t\t\t\t<img src="<?php echo esc_url( $item['avatar_url'] ); ?>" alt="" loading="lazy" decoding="async" />
\t\t\t\t\t\t\t\t\t</span>
\t\t\t\t\t\t\t\t<?php else : ?>
\t\t\t\t\t\t\t\t\t<span class="wplite-frontend-launcher__item-icon" aria-hidden="true"><?php echo $item['icon']; ?></span>
\t\t\t\t\t\t\t\t<?php endif; ?>
\t\t\t\t\t\t\t\t<span class="wplite-frontend-launcher__item-label"><?php echo esc_html( $item['label'] ); ?></span>
\t\t\t\t\t\t\t</a>
\t\t\t\t\t\t<?php endif; ?>
\t\t\t\t\t<?php endforeach; ?>
\t\t\t\t</nav>
\t\t\t\t<div class="wplite-frontend-launcher__search" data-wplite-launcher-search aria-hidden="true">
\t\t\t\t\t<input
\t\t\t\t\t\ttype="search"
\t\t\t\t\t\tclass="wplite-frontend-launcher__search-input"
\t\t\t\t\t\tdata-wplite-launcher-search-input
\t\t\t\t\t\tplaceholder="<?php echo esc_attr__( 'Search pages, posts, media, and people…', 'portfolio-light' ); ?>"
\t\t\t\t\t\taria-label="<?php echo esc_attr__( 'Search WordPress content', 'portfolio-light' ); ?>"
\t\t\t\t\t\tautocomplete="off"
\t\t\t\t\t\tspellcheck="false"
\t\t\t\t\t/>
\t\t\t\t\t<button
\t\t\t\t\t\ttype="button"
\t\t\t\t\t\tclass="wplite-frontend-launcher__search-close"
\t\t\t\t\t\tdata-wplite-launcher-search-close
\t\t\t\t\t\taria-label="<?php echo esc_attr__( 'Close search', 'portfolio-light' ); ?>"
\t\t\t\t\t>
\t\t\t\t\t\t<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
\t\t\t\t\t</button>
\t\t\t\t</div>
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
  --wplite-launcher-edge: 24px;
  --wplite-launcher-surface: rgba(29, 35, 39, 0.96);
  --wplite-launcher-surface-strong: #11171a;
  --wplite-launcher-surface-hover: #2c3338;
  --wplite-launcher-border: rgba(220, 220, 222, 0.18);
  --wplite-launcher-border-strong: rgba(220, 220, 222, 0.28);
  --wplite-launcher-icon: #ffffff;
  --wplite-launcher-icon-muted: rgba(255, 255, 255, 0.78);
  --wplite-launcher-icon-soft: rgba(255, 255, 255, 0.56);
  --wplite-launcher-focus: #72aee6;
  --wplite-launcher-tooltip-bg: #f6f7f7;
  --wplite-launcher-tooltip-border: #dcdcde;
  --wplite-launcher-tooltip-text: #1d2327;
  --wplite-launcher-shadow: 0 18px 46px rgba(0, 0, 0, 0.28);
  --wplite-launcher-radius: 999px;
  position: fixed;
  left: var(--wplite-launcher-edge);
  bottom: var(--wplite-launcher-edge);
  z-index: 99998;
  font-family: var(--wplite-launcher-font);
  pointer-events: none;
  transition: left 180ms ease, right 180ms ease, top 180ms ease, bottom 180ms ease;
}

.wplite-frontend-launcher[data-corner="bottom-left"] {
  left: var(--wplite-launcher-edge);
  right: auto;
  top: auto;
  bottom: var(--wplite-launcher-edge);
}

.wplite-frontend-launcher[data-corner="bottom-right"] {
  left: auto;
  right: var(--wplite-launcher-edge);
  top: auto;
  bottom: var(--wplite-launcher-edge);
}

.wplite-frontend-launcher[data-corner="top-left"] {
  left: var(--wplite-launcher-edge);
  right: auto;
  top: var(--wplite-launcher-edge);
  bottom: auto;
}

.wplite-frontend-launcher[data-corner="top-right"] {
  left: auto;
  right: var(--wplite-launcher-edge);
  top: var(--wplite-launcher-edge);
  bottom: auto;
}

.wplite-frontend-launcher * {
  box-sizing: border-box;
}

.wplite-frontend-launcher__dock {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 50px;
  padding: 3px;
  border: 1px solid var(--wplite-launcher-border);
  border-radius: var(--wplite-launcher-radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
    var(--wplite-launcher-surface);
  box-shadow: var(--wplite-launcher-shadow);
  backdrop-filter: saturate(180%) blur(14px);
  overflow: hidden;
  pointer-events: auto;
  transition:
    background-color 220ms cubic-bezier(0.2, 0.7, 0, 1),
    border-color 220ms cubic-bezier(0.2, 0.7, 0, 1),
    box-shadow 220ms cubic-bezier(0.2, 0.7, 0, 1);
}

.wplite-frontend-launcher[data-corner$="right"] .wplite-frontend-launcher__dock {
  flex-direction: row-reverse;
}

.wplite-frontend-launcher.is-dragging {
  transition: none;
}

.wplite-frontend-launcher.is-dragging .wplite-frontend-launcher__dock {
  border-color: var(--wplite-launcher-border-strong);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.34);
}

.wplite-frontend-launcher__toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--wplite-launcher-icon);
  cursor: grab;
  appearance: none;
  touch-action: none;
  transition: background-color 160ms ease, color 160ms ease, transform 160ms ease;
}

.wplite-frontend-launcher.is-dragging .wplite-frontend-launcher__toggle {
  cursor: grabbing;
}

.wplite-frontend-launcher__toggle:hover,
.wplite-frontend-launcher__toggle:focus-visible,
.wplite-frontend-launcher.is-open .wplite-frontend-launcher__toggle,
.wplite-frontend-launcher:hover .wplite-frontend-launcher__toggle,
.wplite-frontend-launcher:focus-within .wplite-frontend-launcher__toggle {
  background: var(--wplite-launcher-surface-hover);
}

.wplite-frontend-launcher__toggle:focus-visible,
.wplite-frontend-launcher__item:focus-visible,
.wplite-frontend-launcher__search-close:focus-visible,
.wplite-frontend-launcher__result:focus-visible {
  outline: 2px solid var(--wplite-launcher-focus);
  outline-offset: 2px;
}

.wplite-frontend-launcher__toggle-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  transform: translateX(-0.35px);
}

.wplite-frontend-launcher__wordpress-icon {
  display: block;
  width: 100%;
  height: 100%;
}

.wplite-frontend-launcher__toggle::after,
.wplite-frontend-launcher__item::after {
  content: attr(data-tooltip);
  position: absolute;
  left: 50%;
  bottom: calc(100% + 12px);
  transform: translate(-50%, 6px);
  padding: 7px 9px;
  border-radius: 6px;
  background: var(--wplite-launcher-tooltip-bg);
  border: 1px solid var(--wplite-launcher-tooltip-border);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
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

.wplite-frontend-launcher[data-corner^="top"] .wplite-frontend-launcher__toggle::after,
.wplite-frontend-launcher[data-corner^="top"] .wplite-frontend-launcher__item::after {
  top: calc(100% + 12px);
  bottom: auto;
  transform: translate(-50%, -6px);
}

.wplite-frontend-launcher__toggle:hover::after,
.wplite-frontend-launcher__toggle:focus-visible::after,
.wplite-frontend-launcher__item:hover::after,
.wplite-frontend-launcher__item:focus-visible::after {
  opacity: 1;
  transform: translate(-50%, 0);
}

.wplite-frontend-launcher__menu {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 0;
  overflow: hidden;
  padding: 0;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-8px);
  transition:
    max-width 240ms cubic-bezier(0.2, 0.7, 0, 1),
    opacity 150ms ease,
    transform 240ms cubic-bezier(0.2, 0.7, 0, 1),
    padding 240ms cubic-bezier(0.2, 0.7, 0, 1);
}

.wplite-frontend-launcher[data-corner$="right"] .wplite-frontend-launcher__menu {
  transform: translateX(8px);
}

.wplite-frontend-launcher:hover .wplite-frontend-launcher__menu,
.wplite-frontend-launcher:focus-within .wplite-frontend-launcher__menu,
.wplite-frontend-launcher.is-open .wplite-frontend-launcher__menu {
  max-width: min(620px, calc(100vw - 112px));
  overflow: visible;
  padding: 0 10px 0 4px;
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
}

.wplite-frontend-launcher[data-corner$="right"]:hover .wplite-frontend-launcher__menu,
.wplite-frontend-launcher[data-corner$="right"]:focus-within .wplite-frontend-launcher__menu,
.wplite-frontend-launcher[data-corner$="right"].is-open .wplite-frontend-launcher__menu {
  padding: 0 4px 0 10px;
}

.wplite-frontend-launcher.is-searching .wplite-frontend-launcher__menu,
.wplite-frontend-launcher.is-dragging .wplite-frontend-launcher__menu {
  max-width: 0 !important;
  padding: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

.wplite-frontend-launcher__item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  min-width: 44px;
  height: 44px;
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

.wplite-frontend-launcher__item-icon,
.wplite-frontend-launcher__result-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
}

.wplite-frontend-launcher__item-icon svg,
.wplite-frontend-launcher__result-icon svg {
  display: block;
  width: 100%;
  height: 100%;
}

.wplite-frontend-launcher__item-avatar,
.wplite-frontend-launcher__result-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 999px;
  background: var(--wplite-launcher-surface-strong);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.wplite-frontend-launcher__item-avatar {
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
}

.wplite-frontend-launcher__result-avatar {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
}

.wplite-frontend-launcher__item-avatar img,
.wplite-frontend-launcher__result-avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wplite-frontend-launcher__item-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.wplite-frontend-launcher__search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 auto;
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  padding: 0;
  transform: translateX(-8px);
  transition:
    max-width 260ms cubic-bezier(0.2, 0.7, 0, 1),
    opacity 160ms cubic-bezier(0.2, 0.7, 0, 1),
    padding 260ms cubic-bezier(0.2, 0.7, 0, 1),
    transform 260ms cubic-bezier(0.2, 0.7, 0, 1);
}

.wplite-frontend-launcher[data-corner$="right"] .wplite-frontend-launcher__search {
  transform: translateX(8px);
}

.wplite-frontend-launcher.is-searching .wplite-frontend-launcher__search {
  max-width: min(560px, calc(100vw - 132px));
  opacity: 1;
  pointer-events: auto;
  padding: 0 8px 0 12px;
  transform: translateX(0);
}

.wplite-frontend-launcher[data-corner$="right"].is-searching .wplite-frontend-launcher__search {
  padding: 0 12px 0 8px;
}

.wplite-frontend-launcher__search-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 38px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--wplite-launcher-icon);
  font: 600 13px/1 var(--wplite-launcher-font);
  outline: none;
}

.wplite-frontend-launcher__search-input::placeholder {
  color: var(--wplite-launcher-icon-soft);
}

.wplite-frontend-launcher__search-input::-webkit-search-decoration,
.wplite-frontend-launcher__search-input::-webkit-search-cancel-button {
  display: none;
}

.wplite-frontend-launcher__search-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--wplite-launcher-icon-muted);
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease;
}

.wplite-frontend-launcher__search-close:hover,
.wplite-frontend-launcher__search-close:focus-visible {
  background: var(--wplite-launcher-surface-hover);
  color: var(--wplite-launcher-icon);
}

.wplite-frontend-launcher__results {
  position: absolute;
  left: 0;
  bottom: calc(100% + 12px);
  width: min(540px, calc(100vw - (var(--wplite-launcher-edge) * 2)));
  max-height: min(62vh, 520px);
  overflow-y: auto;
  padding: 8px;
  border: 1px solid var(--wplite-launcher-border);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
    var(--wplite-launcher-surface);
  box-shadow: var(--wplite-launcher-shadow);
  backdrop-filter: saturate(180%) blur(16px);
  pointer-events: auto;
  opacity: 0;
  transform: translateY(10px) scale(0.985);
  transform-origin: left bottom;
  transition:
    opacity 180ms cubic-bezier(0.2, 0.7, 0, 1),
    transform 220ms cubic-bezier(0.2, 0.7, 0, 1);
}

.wplite-frontend-launcher[data-corner$="right"] .wplite-frontend-launcher__results {
  left: auto;
  right: 0;
  transform-origin: right bottom;
}

.wplite-frontend-launcher[data-corner^="top"] .wplite-frontend-launcher__results {
  top: calc(100% + 12px);
  bottom: auto;
  transform: translateY(-10px) scale(0.985);
  transform-origin: left top;
}

.wplite-frontend-launcher[data-corner^="top"][data-corner$="right"] .wplite-frontend-launcher__results {
  transform-origin: right top;
}

.wplite-frontend-launcher__results[hidden] {
  display: none;
}

.wplite-frontend-launcher.is-searching .wplite-frontend-launcher__results:not([hidden]) {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.wplite-frontend-launcher__results-section + .wplite-frontend-launcher__results-section {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.wplite-frontend-launcher__results-section-label {
  padding: 2px 8px 8px;
  color: var(--wplite-launcher-icon-soft);
  font: 700 10px/1 var(--wplite-launcher-font);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.wplite-frontend-launcher__result {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--wplite-launcher-icon-muted);
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.wplite-frontend-launcher__result:hover,
.wplite-frontend-launcher__result:focus-visible,
.wplite-frontend-launcher__result.is-active {
  background: var(--wplite-launcher-surface-hover);
  color: var(--wplite-launcher-icon);
}

.wplite-frontend-launcher__result-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.wplite-frontend-launcher__result-title {
  font: 600 13px/1.3 var(--wplite-launcher-font);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wplite-frontend-launcher__result-subtitle {
  color: var(--wplite-launcher-icon-soft);
  font: 500 11px/1.35 var(--wplite-launcher-font);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wplite-frontend-launcher__result-type {
  flex: 0 0 auto;
  color: var(--wplite-launcher-icon-soft);
  font: 700 10px/1 var(--wplite-launcher-font);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.wplite-frontend-launcher__results-status,
.wplite-frontend-launcher__results-meta {
  padding: 10px 12px;
  color: var(--wplite-launcher-icon-soft);
  font: 500 12px/1.4 var(--wplite-launcher-font);
}

.wplite-frontend-launcher__results-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding-top: 8px;
  font-size: 11px;
}

@media (max-width: 640px) {
  .wplite-frontend-launcher {
    --wplite-launcher-edge: 16px;
  }

  .wplite-frontend-launcher:hover .wplite-frontend-launcher__menu,
  .wplite-frontend-launcher:focus-within .wplite-frontend-launcher__menu,
  .wplite-frontend-launcher.is-open .wplite-frontend-launcher__menu {
    max-width: calc(100vw - 88px);
  }

  .wplite-frontend-launcher.is-searching .wplite-frontend-launcher__search {
    max-width: calc(100vw - 112px);
  }
}
`;
}

export function frontendLauncherJs() {
  return `(() => {
  const GROUP_ORDER = ['Recent', 'Suggested', 'Commands', 'Pages', 'Posts', 'Collections', 'People', 'Media', 'Comments', 'Search'];
  const RECENTS_KEY = 'wplite-frontend-launcher-recents';
  const RECENTS_LIMIT = 6;
  const CORNER_KEY = 'wplite-frontend-launcher-corner';
  const CORNERS = new Set(['bottom-left', 'bottom-right', 'top-left', 'top-right']);
  const ICONS = {
    edit: '${launcherIconSvg('edit')}',
    admin: '${launcherIconSvg('admin')}',
    account: '${launcherIconSvg('account')}',
    search: '${launcherIconSvg('search')}',
    document: '${launcherIconSvg('document')}',
    collection: '${launcherIconSvg('collection')}',
    media: '${launcherIconSvg('media')}',
    comment: '${launcherIconSvg('comment')}',
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function compactList(values) {
    return values
      .flat()
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);
  }

  function normalizeSearchText(value) {
    return String(value ?? '')
      .toLowerCase()
      .replace(/\\s+/g, ' ')
      .trim();
  }

  function decodeRenderedText(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(value ?? '');
    return textarea.value.trim();
  }

  function pluralize(word) {
    const irregular = {
      inquiry: 'inquiries',
      testimonial: 'testimonials',
      project: 'projects',
      experience: 'experiences',
      post: 'posts',
      page: 'pages',
      medium: 'media',
    };

    if (irregular[word]) {
      return irregular[word];
    }

    if (String(word).endsWith('y')) {
      return String(word).slice(0, -1) + 'ies';
    }

    return String(word) + 's';
  }

  function toTitleCase(value) {
    return String(value ?? '')
      .replace(/[_-]/g, ' ')
      .replace(/\\b\\w/g, (match) => match.toUpperCase());
  }

  function buildAppUrl(appBase, path) {
    try {
      const base = new URL(String(appBase || '/app').replace(/\\/?$/, '/'), window.location.origin);
      const next = new URL(String(path || '/').replace(/^\\/+/, ''), base);
      if (!next.pathname.endsWith('/')) {
        next.pathname += '/';
      }
      return next.toString();
    } catch {
      return String(path || '/');
    }
  }

  function createSiteSearchUrl(baseUrl, query) {
    const target = new URL(baseUrl || '/', window.location.href);
    target.searchParams.set('s', query);
    return target.toString();
  }

  async function fetchJson(url, { nonce = '', signal } = {}) {
    const headers = { Accept: 'application/json' };
    if (nonce) {
      headers['X-WP-Nonce'] = nonce;
    }

    const response = await fetch(url, {
      credentials: 'same-origin',
      headers,
      signal,
    });
    const text = await response.text();
    let payload = {};

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }

    if (!response.ok) {
      throw new Error(payload.message || 'Request failed with status ' + response.status);
    }

    return payload;
  }

  function createSearchText(item) {
    return normalizeSearchText([
      item.title,
      item.subtitle,
      item.group,
      ...(item.keywords ?? []),
    ].join(' '));
  }

  function withSearchText(item) {
    return {
      ...item,
      searchText: createSearchText(item),
    };
  }

  function createCommandItem(item) {
    return withSearchText({
      kind: 'command',
      group: 'Commands',
      priority: 200,
      ...item,
    });
  }

  function createRecordSubtitle(label, record) {
    return compactList([
      label,
      record?.slug ? '/' + record.slug : '',
      record?.postStatus ? toTitleCase(record.postStatus) : '',
    ]).join(' • ');
  }

  function loadRecentIds() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(RECENTS_KEY) || '[]');
      return Array.isArray(parsed)
        ? parsed.map((value) => String(value ?? '').trim()).filter(Boolean).slice(0, RECENTS_LIMIT)
        : [];
    } catch {
      return [];
    }
  }

  function saveRecentIds(ids) {
    try {
      window.localStorage.setItem(
        RECENTS_KEY,
        JSON.stringify(ids.slice(0, RECENTS_LIMIT))
      );
    } catch {}
  }

  function rememberRecentId(id, currentIds = []) {
    const next = [
      id,
      ...currentIds.filter((value) => value !== id),
    ].slice(0, RECENTS_LIMIT);
    saveRecentIds(next);
    return next;
  }

  function resolveRecentItems(items, recentIds = []) {
    const itemMap = new Map(items.map((item) => [item.id, item]));
    return recentIds
      .map((id) => itemMap.get(id))
      .filter((item) => item && !item.dynamic);
  }

  function resolveSuggestedItems(items) {
    return items
      .filter((item) => !item.dynamic && (item.emptyPriority ?? 0) > 0)
      .sort((left, right) => {
        if ((right.emptyPriority ?? 0) !== (left.emptyPriority ?? 0)) {
          return (right.emptyPriority ?? 0) - (left.emptyPriority ?? 0);
        }
        return left.title.localeCompare(right.title);
      });
  }

  function buildEmptySections(items, recentIds = []) {
    const recent = resolveRecentItems(items, recentIds).slice(0, 4);
    const recentIdSet = new Set(recent.map((item) => item.id));
    const suggested = resolveSuggestedItems(items)
      .filter((item) => !recentIdSet.has(item.id))
      .slice(0, 6);

    return [
      recent.length ? { label: 'Recent', items: recent } : null,
      suggested.length ? { label: 'Suggested', items: suggested } : null,
    ].filter(Boolean);
  }

  function scoreItem(item, rawQuery) {
    const query = normalizeSearchText(rawQuery);
    if (!query) {
      return item.emptyPriority ?? item.priority ?? 0;
    }

    const terms = query.split(' ').filter(Boolean);
    if (!terms.length) {
      return item.priority ?? 0;
    }

    const title = normalizeSearchText(item.title);
    const subtitle = normalizeSearchText(item.subtitle);
    const group = normalizeSearchText(item.group);
    const haystack = item.searchText || createSearchText(item);

    if (!terms.every((term) => haystack.includes(term))) {
      return -1;
    }

    let score = item.priority ?? 0;

    for (const term of terms) {
      if (title === term) {
        score += 2400;
      } else if (title.startsWith(term)) {
        score += 1400;
      } else if (title.includes(term)) {
        score += 900;
      } else {
        score += 200;
      }

      if (subtitle.includes(term)) {
        score += 260;
      }

      if (group.includes(term)) {
        score += 120;
      }
    }

    if (item.kind === 'command') {
      score += 40;
    }

    return score;
  }

  function searchItems(items, query, { limit = 28 } = {}) {
    return items
      .map((item) => ({
        item,
        score: scoreItem(item, query),
      }))
      .filter((entry) => entry.score >= 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.item.title.localeCompare(right.item.title);
      })
      .map((entry) => ({ ...entry.item, __score: entry.score }))
      .slice(0, limit);
  }

  function groupItems(items, { rankedBySearch = false, perGroup = 7 } = {}) {
    const buckets = new Map();
    const topScore = new Map();

    for (const item of items) {
      const label = item.group || 'Results';
      if (!buckets.has(label)) {
        buckets.set(label, []);
      }

      const bucket = buckets.get(label);
      if (bucket.length < perGroup) {
        bucket.push(item);
      }

      if (!topScore.has(label)) {
        topScore.set(label, item.__score ?? item.priority ?? 0);
      }
    }

    return [...buckets.entries()]
      .sort((left, right) => {
        if (rankedBySearch) {
          const diff = (topScore.get(right[0]) ?? 0) - (topScore.get(left[0]) ?? 0);
          if (diff !== 0) {
            return diff;
          }
        }

        const leftIndex = GROUP_ORDER.indexOf(left[0]);
        const rightIndex = GROUP_ORDER.indexOf(right[0]);

        if (leftIndex === -1 && rightIndex === -1) {
          return left[0].localeCompare(right[0]);
        }
        if (leftIndex === -1) {
          return 1;
        }
        if (rightIndex === -1) {
          return -1;
        }
        return leftIndex - rightIndex;
      })
      .map(([label, groupedItems]) => ({ label, items: groupedItems }));
  }

  function collectionPathForModel(model) {
    return '/' + (model?.adminPath || pluralize(model?.id || ''));
  }

  function editorRouteForModel(model, itemId = 'new') {
    return collectionPathForModel(model) + '/' + itemId;
  }

  function buildMenuCommandItems(menuNodes) {
    const items = [];

    menuNodes.forEach((node) => {
      const action = node.getAttribute('data-wplite-launcher-action');
      if (action === 'search') {
        return;
      }

      const key = node.getAttribute('data-wplite-launcher-key') || '';
      const title = node.getAttribute('data-wplite-launcher-title')
        || node.getAttribute('aria-label')
        || '';
      const subtitle = node.getAttribute('data-wplite-launcher-subtitle') || '';
      const priority = Number(node.getAttribute('data-wplite-launcher-priority') || '0');
      const emptyPriority = Number(node.getAttribute('data-wplite-launcher-empty-priority') || '0');
      const href = node.tagName === 'A' ? node.href : '';
      const avatarUrl = node.getAttribute('data-wplite-launcher-avatar-url') || '';

      items.push(createCommandItem({
        id: 'command:' + key,
        title,
        subtitle,
        href,
        iconKey: key === 'edit' ? 'edit' : key === 'admin' ? 'admin' : 'account',
        avatarUrl,
        priority,
        emptyPriority,
        keywords: compactList([key, title, subtitle, key === 'account' ? 'profile' : '']),
      }));
    });

    items.push(createCommandItem({
      id: 'command:classic-admin',
      title: 'Classic WP Admin',
      subtitle: 'Open the legacy admin in a new tab',
      href: window.location.origin.replace(/\\/$/, '') + '/wp-admin/?classic-admin=1',
      iconKey: 'admin',
      openInNewTab: true,
      priority: 760,
      emptyPriority: 740,
      keywords: ['classic', 'admin', 'wp-admin', 'legacy'],
    }));

    return items;
  }

  function buildBootstrapItems(bootstrap, appBase) {
    if (!bootstrap) {
      return [];
    }

    const items = [];
    const models = Array.isArray(bootstrap.models) ? bootstrap.models : [];
    const singletons = Array.isArray(bootstrap.singletons) ? bootstrap.singletons : [];
    const pages = Array.isArray(bootstrap.pages) ? bootstrap.pages : [];
    const recordsByModel = bootstrap.records && typeof bootstrap.records === 'object'
      ? bootstrap.records
      : {};
    const commentsEnabled = bootstrap?.site?.commentsEnabled === true;
    const hasPosts = models.some((model) => model?.id === 'post');

    items.push(
      createCommandItem({
        id: 'command:pages',
        title: 'Pages',
        subtitle: 'Manage routed and freeform pages',
        href: buildAppUrl(appBase, '/pages'),
        iconKey: 'document',
        keywords: ['page', 'routes'],
        priority: 700,
        emptyPriority: 1050,
      }),
      createCommandItem({
        id: 'command:new-page',
        title: 'New Page',
        subtitle: 'Create a new page in the editor',
        href: buildAppUrl(appBase, '/pages/new'),
        iconKey: 'document',
        keywords: ['create', 'page', 'add'],
        priority: 760,
        emptyPriority: 1100,
      }),
      createCommandItem({
        id: 'command:media',
        title: 'Media Library',
        subtitle: 'Browse uploads and assets',
        href: buildAppUrl(appBase, '/media'),
        iconKey: 'media',
        keywords: ['uploads', 'files', 'images'],
        priority: 650,
        emptyPriority: 920,
      }),
      createCommandItem({
        id: 'command:users',
        title: 'Users',
        subtitle: 'Manage WordPress users and roles',
        href: buildAppUrl(appBase, '/users'),
        iconKey: 'account',
        keywords: ['people', 'accounts', 'roles'],
        priority: 680,
        emptyPriority: 960,
      }),
      createCommandItem({
        id: 'command:profile',
        title: 'Edit Profile',
        subtitle: 'Open your current WordPress user profile',
        href: buildAppUrl(appBase, '/users/me'),
        iconKey: 'account',
        avatarUrl: bootstrap?.currentUser?.avatar_urls?.['96']
          || bootstrap?.currentUser?.avatar_urls?.['48']
          || bootstrap?.currentUser?.avatar_urls?.['24']
          || '',
        keywords: ['me', 'account', 'profile', 'preferences'],
        priority: 690,
        emptyPriority: 1000,
      }),
      createCommandItem({
        id: 'command:site-settings',
        title: 'Site Settings',
        subtitle: 'Homepage, identity, timezone, and discussion defaults',
        href: buildAppUrl(appBase, '/settings'),
        iconKey: 'admin',
        keywords: ['settings', 'site', 'homepage', 'discussion'],
        priority: 710,
        emptyPriority: 1080,
      })
    );

    if (commentsEnabled) {
      items.push(createCommandItem({
        id: 'command:comments',
        title: 'Comments',
        subtitle: 'Moderate site discussion',
        href: buildAppUrl(appBase, '/comments'),
        iconKey: 'comment',
        keywords: ['discussion', 'moderation', 'spam'],
        priority: 620,
        emptyPriority: 900,
      }));
    }

    if (hasPosts) {
      items.push(
        createCommandItem({
          id: 'command:posts',
          title: 'Posts',
          subtitle: 'Browse and edit posts',
          href: buildAppUrl(appBase, '/posts'),
          iconKey: 'document',
          keywords: ['post', 'blog', 'journal'],
          priority: 700,
          emptyPriority: 980,
        }),
        createCommandItem({
          id: 'command:new-post',
          title: 'New Post',
          subtitle: 'Create a new post',
          href: buildAppUrl(appBase, '/posts/new'),
          iconKey: 'document',
          keywords: ['create', 'post', 'blog', 'add'],
          priority: 760,
          emptyPriority: 1020,
        })
      );
    }

    singletons.forEach((singleton) => {
      items.push(createCommandItem({
        id: 'command:singleton:' + singleton.id,
        title: 'Settings: ' + singleton.label,
        subtitle: 'Open singleton settings',
        href: buildAppUrl(appBase, '/settings'),
        iconKey: 'admin',
        keywords: ['settings', 'singleton', singleton.id, singleton.label],
        priority: 460,
      }));
    });

    models.forEach((model) => {
      if (!model || model.public === false || model.id === 'page' || model.id === 'post') {
        return;
      }

      items.push(
        createCommandItem({
          id: 'command:collection:' + model.id,
          title: model.label,
          subtitle: 'Browse collection entries',
          href: buildAppUrl(appBase, collectionPathForModel(model)),
          iconKey: 'collection',
          keywords: ['collection', model.id, model.singularLabel],
          priority: 560,
          emptyPriority: 860,
        }),
        createCommandItem({
          id: 'command:new:' + model.id,
          title: 'New ' + (model.singularLabel || toTitleCase(model.id)),
          subtitle: 'Create a new ' + String(model.singularLabel || model.label || model.id).toLowerCase(),
          href: buildAppUrl(appBase, editorRouteForModel(model, 'new')),
          iconKey: 'collection',
          keywords: ['create', 'new', model.id, model.label],
          priority: 610,
        })
      );
    });

    pages.forEach((page) => {
      items.push(withSearchText({
        id: 'page:' + page.id,
        kind: 'record',
        group: 'Pages',
        title: page.title || '(Untitled page)',
        subtitle: createRecordSubtitle('Page', page),
        href: buildAppUrl(appBase, '/pages/' + page.id),
        iconKey: 'document',
        keywords: compactList(['page', page.slug, page.routeId, page.postStatus, page.template]),
        priority: 420,
      }));
    });

    models.forEach((model) => {
      const records = Array.isArray(recordsByModel[model.id]) ? recordsByModel[model.id] : [];
      records.forEach((record) => {
        items.push(withSearchText({
          id: 'record:' + model.id + ':' + record.id,
          kind: 'record',
          group: model.id === 'post' ? 'Posts' : 'Collections',
          title: record.title || '(Untitled ' + String(model.singularLabel || model.id).toLowerCase() + ')',
          subtitle: createRecordSubtitle(model.singularLabel || toTitleCase(model.id), record),
          href: buildAppUrl(appBase, editorRouteForModel(model, record.id)),
          iconKey: model.id === 'post' ? 'document' : 'collection',
          keywords: compactList([model.id, model.label, record.slug, record.postStatus]),
          priority: model.id === 'post' ? 410 : 360,
        }));
      });
    });

    return items;
  }

  function buildRemoteUserItem(user, appBase) {
    const avatarUrls = user?.avatar_urls ?? {};
    return withSearchText({
      id: 'remote:user:' + user.id,
      kind: 'remote',
      group: 'People',
      title: user.name || user.username || ('User ' + user.id),
      subtitle: compactList([user.username ? '@' + user.username : '', user.email]).join(' • '),
      href: buildAppUrl(appBase, '/users/' + user.id),
      iconKey: 'account',
      avatarUrl: avatarUrls['96'] || avatarUrls['48'] || avatarUrls['24'] || '',
      keywords: compactList(['user', 'person', user.username, user.email]),
      priority: 320,
    });
  }

  function buildRemoteMediaItem(media, appBase) {
    const renderedTitle = media?.title?.raw || media?.title?.rendered || '';
    return withSearchText({
      id: 'remote:media:' + media.id,
      kind: 'remote',
      group: 'Media',
      title: decodeRenderedText(renderedTitle) || media.slug || 'Untitled media item',
      subtitle: compactList([media.mime_type || 'Media', media.date || media.modified]).join(' • '),
      href: buildAppUrl(appBase, '/media/' + media.id),
      iconKey: 'media',
      keywords: compactList(['media', 'asset', media.mime_type, media.alt_text, media.slug]),
      priority: 300,
    });
  }

  function buildRemoteCommentItem(comment, appBase) {
    const embeddedPost = comment?._embedded?.up?.[0] ?? null;
    const contentRendered = comment?.content?.rendered ?? '';
    const contentRaw = comment?.content?.raw ?? '';
    const contentText = decodeRenderedText(contentRendered || contentRaw);
    return withSearchText({
      id: 'remote:comment:' + comment.id,
      kind: 'remote',
      group: 'Comments',
      title: contentText
        ? (contentText.length > 84 ? contentText.slice(0, 81) + '...' : contentText)
        : ('Comment #' + comment.id),
      subtitle: compactList([
        comment.author_name || 'Anonymous',
        decodeRenderedText(embeddedPost?.title?.rendered || ''),
      ]).join(' • '),
      href: buildAppUrl(appBase, '/comments/' + comment.id),
      iconKey: 'comment',
      keywords: compactList(['comment', 'discussion', comment.author_name, contentText]),
      priority: 280,
    });
  }

  async function fetchRemoteSearchResults(query, signal, { commentsEnabled = false, nonce = '', wpRestRoot = '', appBase = '' } = {}) {
    const base = new URL(wpRestRoot || '/wp-json/', window.location.href);
    const params = new URLSearchParams({
      search: query,
      per_page: '5',
      context: 'edit',
    });
    const commentParams = new URLSearchParams({
      search: query,
      per_page: '5',
      context: 'edit',
      status: 'all',
      _embed: 'up',
    });

    const requests = [
      fetchJson(new URL('wp/v2/users?' + params.toString(), base), { nonce, signal }),
      fetchJson(new URL('wp/v2/media?' + params.toString(), base), { nonce, signal }),
      commentsEnabled
        ? fetchJson(new URL('wp/v2/comments?' + commentParams.toString(), base), { nonce, signal })
        : Promise.resolve([]),
    ];

    const [users, media, comments] = await Promise.allSettled(requests);
    const items = [];
    let error = null;

    if (users.status === 'fulfilled') {
      items.push(...users.value.map((user) => buildRemoteUserItem(user, appBase)));
    } else {
      error = users.reason?.message || 'User search failed.';
    }

    if (media.status === 'fulfilled') {
      items.push(...media.value.map((item) => buildRemoteMediaItem(item, appBase)));
    } else if (!error) {
      error = media.reason?.message || 'Media search failed.';
    }

    if (comments.status === 'fulfilled') {
      items.push(...comments.value.map((item) => buildRemoteCommentItem(item, appBase)));
    } else if (!error) {
      error = comments.reason?.message || 'Comment search failed.';
    }

    return { items, error };
  }

  function buildFallbackSearchItem(query, searchUrl) {
    return withSearchText({
      id: 'search:' + normalizeSearchText(query),
      kind: 'fallback',
      group: 'Search',
      title: 'Search the public site',
      subtitle: 'Search this site for "' + query + '"',
      href: createSiteSearchUrl(searchUrl, query),
      iconKey: 'search',
      priority: 120,
      dynamic: true,
      keywords: ['search', 'site', query],
    });
  }

  function createResultLead(item) {
    if (item.avatarUrl) {
      const avatar = document.createElement('span');
      avatar.className = 'wplite-frontend-launcher__result-avatar';
      const image = document.createElement('img');
      image.src = item.avatarUrl;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      avatar.appendChild(image);
      return avatar;
    }

    const icon = document.createElement('span');
    icon.className = 'wplite-frontend-launcher__result-icon';
    if (item.iconKey && ICONS[item.iconKey]) {
      icon.innerHTML = ICONS[item.iconKey];
    }
    return icon;
  }

  const launchers = document.querySelectorAll('[data-wplite-launcher]');
  if (!launchers.length) {
    return;
  }

  launchers.forEach((launcher) => {
    const toggle = launcher.querySelector('[data-wplite-launcher-toggle]');
    const searchContainer = launcher.querySelector('[data-wplite-launcher-search]');
    const searchInput = launcher.querySelector('[data-wplite-launcher-search-input]');
    const searchClose = launcher.querySelector('[data-wplite-launcher-search-close]');
    const resultsList = launcher.querySelector('[data-wplite-launcher-results]');
    const menuNodes = [...launcher.querySelectorAll('[data-wplite-launcher-item]')];

    if (!toggle || !resultsList) {
      return;
    }

    const state = {
      indexedItems: [],
      bootstrap: null,
      bootstrapPromise: null,
      bootstrapError: null,
      indexLoading: false,
      remoteResults: [],
      remoteLoading: false,
      remoteError: null,
      remoteCache: new Map(),
      searchController: null,
      searchTimer: null,
      activeResultIndex: 0,
      recentIds: loadRecentIds(),
      drag: null,
      suppressToggleClick: false,
    };

    const searchUrl = launcher.getAttribute('data-wplite-search-url') || window.location.origin + '/';
    const bootstrapUrl = launcher.getAttribute('data-wplite-bootstrap-url') || '';
    const wpRestRoot = launcher.getAttribute('data-wplite-wp-rest-root') || '';
    const restNonce = launcher.getAttribute('data-wplite-rest-nonce') || '';
    const appBase = launcher.getAttribute('data-wplite-app-base') || '/app';
    const defaultCorner = launcher.getAttribute('data-wplite-default-corner') || 'bottom-left';

    function loadCorner() {
      try {
        const stored = window.localStorage.getItem(CORNER_KEY);
        if (stored && CORNERS.has(stored)) {
          return stored;
        }
      } catch {}
      return CORNERS.has(defaultCorner) ? defaultCorner : 'bottom-left';
    }

    function saveCorner(corner) {
      try {
        window.localStorage.setItem(CORNER_KEY, corner);
      } catch {}
    }

    function applyCorner(corner) {
      launcher.dataset.corner = CORNERS.has(corner) ? corner : 'bottom-left';
      launcher.style.left = '';
      launcher.style.right = '';
      launcher.style.top = '';
      launcher.style.bottom = '';
    }

    function rebuildIndex() {
      const deduped = new Map();
      [...buildMenuCommandItems(menuNodes), ...buildBootstrapItems(state.bootstrap, appBase)].forEach((item) => {
        if (!deduped.has(item.id)) {
          deduped.set(item.id, item);
        }
      });
      state.indexedItems = [...deduped.values()];
    }

    function setOpen(nextOpen) {
      launcher.classList.toggle('is-open', nextOpen);
      toggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      if (!nextOpen) {
        exitSearch({ silent: true });
      }
    }

    function renderStatus(message) {
      resultsList.hidden = false;
      resultsList.innerHTML = '';
      const status = document.createElement('p');
      status.className = 'wplite-frontend-launcher__results-status';
      status.textContent = message;
      resultsList.appendChild(status);
    }

    function getVisibleSections(query) {
      const trimmed = String(query ?? '').trim();

      if (!trimmed) {
        return buildEmptySections(state.indexedItems, state.recentIds);
      }

      const deduped = new Map();
      searchItems(state.indexedItems, trimmed, { limit: 28 }).forEach((item) => {
        if (!deduped.has(item.id)) {
          deduped.set(item.id, item);
        }
      });
      state.remoteResults.forEach((item) => {
        if (!deduped.has(item.id)) {
          deduped.set(item.id, item);
        }
      });
      const fallback = buildFallbackSearchItem(trimmed, searchUrl);
      if (!deduped.has(fallback.id)) {
        deduped.set(fallback.id, fallback);
      }

      return groupItems(
        searchItems([...deduped.values()], trimmed, { limit: 36 }),
        { rankedBySearch: true }
      );
    }

    function updateActiveResult() {
      const nodes = [...resultsList.querySelectorAll('.wplite-frontend-launcher__result')];
      if (!nodes.length) {
        state.activeResultIndex = 0;
        return;
      }

      state.activeResultIndex = clamp(state.activeResultIndex, 0, nodes.length - 1);
      nodes.forEach((node, index) => {
        node.classList.toggle('is-active', index === state.activeResultIndex);
      });
    }

    function executeItem(item) {
      if (!item) {
        return;
      }

      if (!item.dynamic && item.id) {
        state.recentIds = rememberRecentId(item.id, state.recentIds);
      }

      setOpen(false);

      if (item.openInNewTab) {
        window.open(item.href, '_blank', 'noopener,noreferrer');
        return;
      }

      window.location.assign(item.href);
    }

    function renderResults() {
      if (!launcher.classList.contains('is-searching')) {
        resultsList.hidden = true;
        resultsList.innerHTML = '';
        return;
      }

      const query = searchInput ? searchInput.value.trim() : '';
      const sections = getVisibleSections(query);
      resultsList.innerHTML = '';

      if (!sections.length) {
        if (state.indexLoading) {
          renderStatus('Loading WordPress search…');
          return;
        }

        renderStatus(query ? 'No results yet.' : 'Type to search the workspace.');
      } else {
        let absoluteIndex = 0;
        sections.forEach((section) => {
          const group = document.createElement('section');
          group.className = 'wplite-frontend-launcher__results-section';

          const header = document.createElement('div');
          header.className = 'wplite-frontend-launcher__results-section-label';
          header.textContent = section.label;
          group.appendChild(header);

          section.items.forEach((item) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'wplite-frontend-launcher__result';
            button.appendChild(createResultLead(item));

            const body = document.createElement('span');
            body.className = 'wplite-frontend-launcher__result-body';

            const title = document.createElement('span');
            title.className = 'wplite-frontend-launcher__result-title';
            title.textContent = item.title;
            body.appendChild(title);

            if (item.subtitle) {
              const subtitle = document.createElement('span');
              subtitle.className = 'wplite-frontend-launcher__result-subtitle';
              subtitle.textContent = item.subtitle;
              body.appendChild(subtitle);
            }

            button.appendChild(body);

            const tag = document.createElement('span');
            tag.className = 'wplite-frontend-launcher__result-type';
            tag.textContent = item.group || 'Result';
            button.appendChild(tag);

            const resultIndex = absoluteIndex;
            button.addEventListener('mouseenter', () => {
              state.activeResultIndex = resultIndex;
              updateActiveResult();
            });
            button.addEventListener('focus', () => {
              state.activeResultIndex = resultIndex;
              updateActiveResult();
            });
            button.addEventListener('click', (event) => {
              event.preventDefault();
              executeItem(item);
            });

            group.appendChild(button);
            absoluteIndex += 1;
          });

          resultsList.appendChild(group);
        });

        const statusBits = [];
        if (state.indexLoading) {
          statusBits.push('Loading WordPress items');
        } else if (state.remoteLoading) {
          statusBits.push('Searching WordPress');
        }

        if (!state.indexLoading && !state.remoteLoading) {
          if (!state.bootstrap && state.bootstrapError) {
            statusBits.push(state.bootstrapError);
          } else if (state.remoteError) {
            statusBits.push(state.remoteError);
          }
        }

        if (statusBits.length) {
          const meta = document.createElement('div');
          meta.className = 'wplite-frontend-launcher__results-meta';
          statusBits.forEach((message) => {
            const bit = document.createElement('span');
            bit.textContent = message;
            meta.appendChild(bit);
          });
          resultsList.appendChild(meta);
        }

        resultsList.hidden = false;
        updateActiveResult();
      }
    }

    function clearRemoteSearch() {
      if (state.searchController) {
        state.searchController.abort();
        state.searchController = null;
      }
      if (state.searchTimer) {
        clearTimeout(state.searchTimer);
        state.searchTimer = null;
      }
      state.remoteResults = [];
      state.remoteLoading = false;
      state.remoteError = null;
    }

    function enterSearch() {
      launcher.classList.add('is-searching');
      launcher.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      if (searchContainer) {
        searchContainer.setAttribute('aria-hidden', 'false');
      }
      if (searchInput) {
        searchInput.value = '';
      }
      state.activeResultIndex = 0;
      clearRemoteSearch();
      renderResults();
      ensureBootstrapLoaded();
      if (searchInput) {
        requestAnimationFrame(() => searchInput.focus());
      }
    }

    function exitSearch({ silent = false } = {}) {
      launcher.classList.remove('is-searching');
      if (searchContainer) {
        searchContainer.setAttribute('aria-hidden', 'true');
      }
      if (searchInput) {
        searchInput.value = '';
      }
      state.activeResultIndex = 0;
      clearRemoteSearch();
      renderResults();
      if (!silent) {
        toggle.focus();
      }
    }

    function ensureBootstrapLoaded() {
      if (!bootstrapUrl) {
        return Promise.resolve(null);
      }

      if (state.bootstrap) {
        return Promise.resolve(state.bootstrap);
      }

      if (state.bootstrapPromise) {
        return state.bootstrapPromise;
      }

      state.indexLoading = true;
      renderResults();

      state.bootstrapPromise = fetchJson(bootstrapUrl, { nonce: restNonce })
        .then((payload) => {
          state.bootstrap = payload;
          state.bootstrapError = null;
          rebuildIndex();
          if (searchInput && launcher.classList.contains('is-searching')) {
            const activeQuery = searchInput.value.trim();
            if (activeQuery.length >= 2) {
              runRemoteSearch(activeQuery);
            }
          }
          return payload;
        })
        .catch((error) => {
          state.bootstrapError = error.message || 'WordPress search is unavailable.';
          return null;
        })
        .finally(() => {
          state.indexLoading = false;
          state.bootstrapPromise = null;
          renderResults();
        });

      return state.bootstrapPromise;
    }

    async function runRemoteSearch(query) {
      if (query.length < 2) {
        clearRemoteSearch();
        renderResults();
        return;
      }

      const cacheKey = query.toLowerCase();
      if (state.remoteCache.has(cacheKey)) {
        const cached = state.remoteCache.get(cacheKey);
        state.remoteResults = cached.items;
        state.remoteError = cached.error;
        state.remoteLoading = false;
        renderResults();
        return;
      }

      if (state.searchController) {
        state.searchController.abort();
      }

      const controller = new AbortController();
      state.searchController = controller;
      state.remoteLoading = true;
      state.remoteError = null;
      renderResults();

      try {
        const next = await fetchRemoteSearchResults(query, controller.signal, {
          commentsEnabled: state.bootstrap?.site?.commentsEnabled === true,
          nonce: restNonce,
          wpRestRoot,
          appBase,
        });

        if (controller.signal.aborted) {
          return;
        }

        state.remoteCache.set(cacheKey, next);
        state.remoteResults = next.items;
        state.remoteError = next.error;
      } catch (error) {
        if (!controller.signal.aborted) {
          state.remoteResults = [];
          state.remoteError = error.message || 'Live search failed.';
        }
      } finally {
        if (!controller.signal.aborted) {
          state.remoteLoading = false;
          state.searchController = null;
          renderResults();
        }
      }
    }

    function scheduleSearch(query) {
      const trimmed = query.trim();
      state.activeResultIndex = 0;
      ensureBootstrapLoaded();

      if (state.searchTimer) {
        clearTimeout(state.searchTimer);
      }

      if (!trimmed) {
        clearRemoteSearch();
        renderResults();
        return;
      }

      renderResults();
      state.searchTimer = setTimeout(() => {
        runRemoteSearch(trimmed);
      }, 140);
    }

    function getActiveResults() {
      return [...resultsList.querySelectorAll('.wplite-frontend-launcher__result')];
    }

    function nearestCornerFromPoint(clientX, clientY) {
      const horizontal = clientX >= window.innerWidth / 2 ? 'right' : 'left';
      const vertical = clientY >= window.innerHeight / 2 ? 'bottom' : 'top';
      return vertical + '-' + horizontal;
    }

    function finishDrag(event) {
      if (!state.drag || state.drag.pointerId !== event.pointerId) {
        return;
      }

      const drag = state.drag;
      state.drag = null;

      if (toggle.hasPointerCapture(event.pointerId)) {
        toggle.releasePointerCapture(event.pointerId);
      }

      if (!drag.dragging) {
        return;
      }

      event.preventDefault();
      launcher.classList.remove('is-dragging');
      const corner = nearestCornerFromPoint(event.clientX, event.clientY);
      applyCorner(corner);
      saveCorner(corner);

      window.setTimeout(() => {
        state.suppressToggleClick = false;
      }, 0);
    }

    rebuildIndex();
    applyCorner(loadCorner());

    toggle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }

      const rect = launcher.getBoundingClientRect();
      state.drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
        dragging: false,
      };
      toggle.setPointerCapture(event.pointerId);
    });

    toggle.addEventListener('pointermove', (event) => {
      if (!state.drag || state.drag.pointerId !== event.pointerId) {
        return;
      }

      const dx = event.clientX - state.drag.startX;
      const dy = event.clientY - state.drag.startY;
      if (!state.drag.dragging && Math.hypot(dx, dy) < 8) {
        return;
      }

      if (!state.drag.dragging) {
        state.drag.dragging = true;
        state.suppressToggleClick = true;
        launcher.classList.add('is-dragging');
        setOpen(false);
      }

      event.preventDefault();

      const maxLeft = Math.max(12, window.innerWidth - state.drag.width - 12);
      const maxTop = Math.max(12, window.innerHeight - state.drag.height - 12);
      const nextLeft = clamp(event.clientX - state.drag.offsetX, 12, maxLeft);
      const nextTop = clamp(event.clientY - state.drag.offsetY, 12, maxTop);

      launcher.style.left = nextLeft + 'px';
      launcher.style.top = nextTop + 'px';
      launcher.style.right = 'auto';
      launcher.style.bottom = 'auto';
    });

    toggle.addEventListener('pointerup', finishDrag);
    toggle.addEventListener('pointercancel', finishDrag);

    toggle.addEventListener('click', (event) => {
      if (state.suppressToggleClick) {
        event.preventDefault();
        state.suppressToggleClick = false;
        return;
      }

      event.preventDefault();
      if (launcher.classList.contains('is-searching')) {
        exitSearch();
        return;
      }
      setOpen(!launcher.classList.contains('is-open'));
    });

    launcher.querySelectorAll('[data-wplite-launcher-action="search"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        enterSearch();
      });
    });

    if (searchClose) {
      searchClose.addEventListener('click', (event) => {
        event.preventDefault();
        exitSearch();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        scheduleSearch(searchInput.value);
      });

      searchInput.addEventListener('keydown', (event) => {
        const activeResults = getActiveResults();

        if (event.key === 'Escape') {
          event.preventDefault();
          exitSearch();
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          if (!activeResults.length) {
            return;
          }
          state.activeResultIndex = (state.activeResultIndex + 1) % activeResults.length;
          updateActiveResult();
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (!activeResults.length) {
            return;
          }
          state.activeResultIndex = (state.activeResultIndex - 1 + activeResults.length) % activeResults.length;
          updateActiveResult();
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          if (activeResults[state.activeResultIndex]) {
            activeResults[state.activeResultIndex].click();
            return;
          }

          const query = searchInput.value.trim();
          if (!query) {
            return;
          }
          executeItem(buildFallbackSearchItem(query, searchUrl));
        }
      });
    }

    launcher.addEventListener('mouseleave', () => {
      if (launcher.classList.contains('is-searching') || launcher.classList.contains('is-dragging')) {
        return;
      }
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
      if (event.key !== 'Escape') {
        return;
      }

      if (launcher.classList.contains('is-searching')) {
        exitSearch();
      } else {
        setOpen(false);
      }
    });
  });
})();`;
}
