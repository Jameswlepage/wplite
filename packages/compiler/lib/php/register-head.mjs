// Generates the `register-head.php` file — emits meta / OG / Twitter / JSON-LD
// output in wp_head based on the profile, seo, and contact singletons, with
// canonical WP values filling in anything the user hasn't overridden.
export function phpRegisterHeadFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_head_active_object() {
\tif ( is_singular() ) {
\t\treturn get_queried_object();
\t}
\treturn null;
}

function portfolio_light_head_meta_description( $seo, $post ) {
\tif ( $post instanceof WP_Post ) {
\t\t$excerpt = has_excerpt( $post ) ? wp_strip_all_tags( $post->post_excerpt ) : '';
\t\tif ( $excerpt ) return $excerpt;
\t\t$auto = wp_strip_all_tags( wp_trim_words( $post->post_content, 30, '' ) );
\t\tif ( $auto ) return $auto;
\t}
\treturn (string) ( $seo['meta_description'] ?? '' );
}

function portfolio_light_head_title( $seo, $post ) {
\t$site_title = get_bloginfo( 'name' );
\t$site_desc  = get_bloginfo( 'description' );
\t$sep        = $seo['title_separator'] ?: '—';

\tif ( is_front_page() ) {
\t\t$tpl = $seo['title_template_home'] ?: '%site_title% — %site_description%';
\t\treturn strtr( $tpl, [
\t\t\t'%site_title%'       => $site_title,
\t\t\t'%site_description%' => $site_desc,
\t\t\t'%separator%'        => $sep,
\t\t] );
\t}

\tif ( $post instanceof WP_Post ) {
\t\t$tpl = $seo['title_template_post'] ?: '%post_title% %separator% %site_title%';
\t\treturn strtr( $tpl, [
\t\t\t'%post_title%'       => get_the_title( $post ),
\t\t\t'%site_title%'       => $site_title,
\t\t\t'%site_description%' => $site_desc,
\t\t\t'%separator%'        => $sep,
\t\t] );
\t}

\tif ( is_archive() || is_home() || is_search() ) {
\t\t// Cannot call wp_get_document_title() here — this function is invoked
\t\t// via the document_title_parts filter, which wp_get_document_title()
\t\t// applies itself. That would recurse infinitely and blow memory.
\t\tif ( is_search() ) {
\t\t\t$archive = sprintf( __( 'Search Results for: %s' ), get_search_query() );
\t\t} elseif ( is_post_type_archive() ) {
\t\t\t$archive = post_type_archive_title( '', false );
\t\t} elseif ( is_tax() || is_category() || is_tag() ) {
\t\t\t$archive = single_term_title( '', false );
\t\t} elseif ( is_author() ) {
\t\t\t$archive = get_the_author_meta( 'display_name', get_queried_object_id() );
\t\t} else {
\t\t\t$archive = $site_title;
\t\t}
\t\t$tpl = $seo['title_template_archive'] ?: '%archive_title% %separator% %site_title%';
\t\treturn strtr( $tpl, [
\t\t\t'%archive_title%'    => $archive,
\t\t\t'%site_title%'       => $site_title,
\t\t\t'%site_description%' => $site_desc,
\t\t\t'%separator%'        => $sep,
\t\t] );
\t}

\treturn $site_title;
}

function portfolio_light_head_canonical_url( $seo, $post ) {
\tif ( $post instanceof WP_Post ) {
\t\t$url = get_permalink( $post );
\t} elseif ( is_archive() ) {
\t\t$url = home_url( add_query_arg( [] ) );
\t} else {
\t\t$url = home_url( '/' );
\t}

\t$host_override = $seo['canonical_host'] ?? '';
\tif ( $host_override ) {
\t\t$override_parts = wp_parse_url( $host_override );
\t\t$url_parts      = wp_parse_url( $url );
\t\tif ( ! empty( $override_parts['host'] ) && ! empty( $url_parts ) ) {
\t\t\t$url_parts['scheme'] = $override_parts['scheme'] ?? ( $url_parts['scheme'] ?? 'https' );
\t\t\t$url_parts['host']   = $override_parts['host'];
\t\t\tif ( ! empty( $override_parts['port'] ) ) $url_parts['port'] = $override_parts['port'];
\t\t\t$url = ( $url_parts['scheme'] ?? 'https' ) . '://' . $url_parts['host']
\t\t\t\t. ( isset( $url_parts['port'] ) ? ':' . $url_parts['port'] : '' )
\t\t\t\t. ( $url_parts['path'] ?? '/' )
\t\t\t\t. ( isset( $url_parts['query'] ) ? '?' . $url_parts['query'] : '' );
\t\t}
\t}

\treturn $url;
}

function portfolio_light_head_og_image( $seo, $profile, $post ) {
\tif ( $post instanceof WP_Post ) {
\t\t$thumb_id = get_post_thumbnail_id( $post );
\t\tif ( $thumb_id ) {
\t\t\t$url = wp_get_attachment_image_url( $thumb_id, 'full' );
\t\t\tif ( $url ) return $url;
\t\t}
\t}

\t$candidates = [
\t\t(int) ( $seo['og_image'] ?? 0 ),
\t\t(int) ( $profile['logo'] ?? 0 ),
\t\t(int) get_option( 'site_icon', 0 ),
\t];
\tforeach ( $candidates as $attachment_id ) {
\t\tif ( $attachment_id ) {
\t\t\t$url = wp_get_attachment_image_url( $attachment_id, 'full' );
\t\t\tif ( $url ) return $url;
\t\t}
\t}

\treturn function_exists( 'get_site_icon_url' ) ? get_site_icon_url( 512 ) : '';
}

function portfolio_light_head_robots( $seo ) {
\t$robots = $seo['robots_default'] ?? 'index,follow';
\tif ( ! empty( $seo['noindex_archives'] ) && ( is_archive() || is_home() ) ) {
\t\t$robots = 'noindex,follow';
\t}
\tif ( ! empty( $seo['noindex_search'] ) && is_search() ) {
\t\t$robots = 'noindex,follow';
\t}
\treturn $robots;
}

function portfolio_light_head_same_as( $profile ) {
\t$urls = [];
\tforeach ( (array) ( $profile['same_as'] ?? [] ) as $row ) {
\t\t$url = is_array( $row ) ? ( $row['url'] ?? '' ) : $row;
\t\t$url = esc_url_raw( $url );
\t\tif ( $url ) $urls[] = $url;
\t}
\treturn $urls;
}

function portfolio_light_head_jsonld( $seo, $profile, $contact ) {
\tif ( empty( $seo['emit_jsonld'] ) ) return [];

\t$site_name  = get_bloginfo( 'name' );
\t$site_url   = home_url( '/' );
\t$logo_url   = '';
\t$logo_id    = (int) ( $profile['logo'] ?? 0 );
\tif ( $logo_id ) {
\t\t$logo_url = wp_get_attachment_image_url( $logo_id, 'full' ) ?: '';
\t}
\tif ( ! $logo_url && function_exists( 'get_site_icon_url' ) ) {
\t\t$logo_url = get_site_icon_url( 512 );
\t}

\t$website = [
\t\t'@context'    => 'https://schema.org',
\t\t'@type'       => 'WebSite',
\t\t'@id'         => $site_url . '#website',
\t\t'url'         => $site_url,
\t\t'name'        => $site_name,
\t\t'description' => get_bloginfo( 'description' ),
\t\t'inLanguage'  => get_bloginfo( 'language' ),
\t];

\t$org_type     = $profile['organization_type'] ?? 'Organization';
\t$display_name = $profile['display_name'] ?: $site_name;
\t$description  = wp_strip_all_tags( (string) ( $profile['short_bio'] ?? get_bloginfo( 'description' ) ) );

\t$organization = array_filter( [
\t\t'@context'    => 'https://schema.org',
\t\t'@type'       => $org_type,
\t\t'@id'         => $site_url . '#organization',
\t\t'name'        => $display_name,
\t\t'url'         => $site_url,
\t\t'description' => $description,
\t\t'logo'        => $logo_url ?: null,
\t\t'email'       => $contact['email'] ?? null,
\t\t'telephone'   => $contact['phone'] ?? null,
\t\t'sameAs'      => portfolio_light_head_same_as( $profile ) ?: null,
\t\t'foundingDate'=> ! empty( $profile['founded_year'] ) ? (string) $profile['founded_year'] : null,
\t] );

\t$address = array_filter( [
\t\t'@type'           => 'PostalAddress',
\t\t'streetAddress'   => $contact['address_street'] ?? null,
\t\t'addressLocality' => $contact['address_locality'] ?? null,
\t\t'addressRegion'   => $contact['address_region'] ?? null,
\t\t'postalCode'      => $contact['address_postal'] ?? null,
\t\t'addressCountry'  => $contact['address_country'] ?? null,
\t] );
\tif ( count( $address ) > 1 ) {
\t\t$organization['address'] = $address;
\t}

\t$contact_points = [];
\tforeach ( (array) ( $contact['points'] ?? [] ) as $row ) {
\t\tif ( ! is_array( $row ) ) continue;
\t\t$point = array_filter( [
\t\t\t'@type'       => 'ContactPoint',
\t\t\t'contactType' => $row['type'] ?? null,
\t\t\t'email'       => $row['email'] ?? null,
\t\t\t'telephone'   => $row['phone'] ?? null,
\t\t] );
\t\tif ( count( $point ) > 1 ) $contact_points[] = $point;
\t}
\tif ( $contact_points ) $organization['contactPoint'] = $contact_points;

\treturn [ $website, $organization ];
}

add_action( 'wp_head', function() {
\t$seo     = portfolio_light_singleton_with_inheritance( 'seo' );
\t$profile = portfolio_light_singleton_with_inheritance( 'profile' );
\t$contact = portfolio_light_singleton_with_inheritance( 'contact' );
\t$post    = portfolio_light_head_active_object();

\t$description = portfolio_light_head_meta_description( $seo, $post );
\t$canonical   = portfolio_light_head_canonical_url( $seo, $post );
\t$robots      = portfolio_light_head_robots( $seo );
\t$og_image    = portfolio_light_head_og_image( $seo, $profile, $post );
\t$og_type     = $seo['og_type'] ?? 'website';
\t$og_locale   = $seo['og_locale'] ?: ( str_replace( '-', '_', get_bloginfo( 'language' ) ) );
\t$twitter_card = $seo['twitter_card'] ?? 'summary_large_image';
\t$twitter_handle = $seo['twitter_handle'] ?? '';

\techo "\\n<!-- wplite head -->\\n";

\tif ( $description ) {
\t\techo '<meta name="description" content="' . esc_attr( $description ) . '">' . "\\n";
\t}
\techo '<meta name="robots" content="' . esc_attr( $robots ) . '">' . "\\n";
\tif ( $canonical ) {
\t\techo '<link rel="canonical" href="' . esc_url( $canonical ) . '">' . "\\n";
\t}

\techo '<meta property="og:site_name" content="' . esc_attr( get_bloginfo( 'name' ) ) . '">' . "\\n";
\techo '<meta property="og:type" content="' . esc_attr( $og_type ) . '">' . "\\n";
\tif ( $og_locale ) {
\t\techo '<meta property="og:locale" content="' . esc_attr( $og_locale ) . '">' . "\\n";
\t}
\tif ( $canonical ) {
\t\techo '<meta property="og:url" content="' . esc_url( $canonical ) . '">' . "\\n";
\t}
\techo '<meta property="og:title" content="' . esc_attr( wp_get_document_title() ) . '">' . "\\n";
\tif ( $description ) {
\t\techo '<meta property="og:description" content="' . esc_attr( $description ) . '">' . "\\n";
\t}
\tif ( $og_image ) {
\t\techo '<meta property="og:image" content="' . esc_url( $og_image ) . '">' . "\\n";
\t}

\techo '<meta name="twitter:card" content="' . esc_attr( $twitter_card ) . '">' . "\\n";
\tif ( $twitter_handle ) {
\t\techo '<meta name="twitter:site" content="' . esc_attr( $twitter_handle ) . '">' . "\\n";
\t}
\techo '<meta name="twitter:title" content="' . esc_attr( wp_get_document_title() ) . '">' . "\\n";
\tif ( $description ) {
\t\techo '<meta name="twitter:description" content="' . esc_attr( $description ) . '">' . "\\n";
\t}
\tif ( $og_image ) {
\t\techo '<meta name="twitter:image" content="' . esc_url( $og_image ) . '">' . "\\n";
\t}

\t$jsonld = portfolio_light_head_jsonld( $seo, $profile, $contact );
\tforeach ( $jsonld as $node ) {
\t\techo '<script type="application/ld+json">' . wp_json_encode( $node, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\\n";
\t}

\techo "<!-- /wplite head -->\\n";
}, 5 );

// Hook into WP's title_parts so our title_template_* actually drive <title>.
add_filter( 'document_title_parts', function( $parts ) {
\t$seo  = portfolio_light_singleton_with_inheritance( 'seo' );
\t$post = portfolio_light_head_active_object();
\t$title = portfolio_light_head_title( $seo, $post );
\tif ( $title ) {
\t\treturn [ 'title' => $title ];
\t}
\treturn $parts;
} );
`;
}
