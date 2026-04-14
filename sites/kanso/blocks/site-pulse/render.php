<?php
/**
 * Site pulse — a dashboard-only block that counts content across registered
 * post types and surfaces them behind a pair of tabs. State is seeded via
 * wp_interactivity_state() so the admin client hydrates instantly.
 */

$post_types = get_post_types( [ 'public' => true ], 'objects' );
$counts     = [];
foreach ( $post_types as $pt ) {
	if ( in_array( $pt->name, [ 'attachment', 'nav_menu_item' ], true ) ) {
		continue;
	}
	$tally = wp_count_posts( $pt->name );
	$counts[] = [
		'type'      => $pt->name,
		'label'     => $pt->labels->name,
		'published' => (int) ( $tally->publish ?? 0 ),
		'draft'     => (int) ( $tally->draft ?? 0 ),
	];
}

$total_published = array_sum( array_column( $counts, 'published' ) );
$total_draft     = array_sum( array_column( $counts, 'draft' ) );

wp_interactivity_state(
	'kanso/site-pulse',
	[
		'activeTab'      => 'published',
		'counts'         => $counts,
		'totalPublished' => $total_published,
		'totalDraft'     => $total_draft,
	]
);

$wrapper_attrs = get_block_wrapper_attributes(
	[ 'class' => 'site-pulse' ]
);
?>
<div
	<?php echo $wrapper_attrs; ?>
	data-wp-interactive="kanso/site-pulse"
>
	<div class="site-pulse__tabs" role="tablist">
		<button
			type="button"
			role="tab"
			class="site-pulse__tab"
			data-wp-on--click="actions.setTab"
			data-wp-class--is-active="state.isPublishedTab"
			data-tab="published"
		>
			Published <span class="site-pulse__count"><?php echo (int) $total_published; ?></span>
		</button>
		<button
			type="button"
			role="tab"
			class="site-pulse__tab"
			data-wp-on--click="actions.setTab"
			data-wp-class--is-active="state.isDraftTab"
			data-tab="draft"
		>
			Drafts <span class="site-pulse__count"><?php echo (int) $total_draft; ?></span>
		</button>
	</div>

	<ul class="site-pulse__list">
		<?php foreach ( $counts as $row ) : ?>
		<li class="site-pulse__row" data-type="<?php echo esc_attr( $row['type'] ); ?>">
			<span class="site-pulse__label"><?php echo esc_html( $row['label'] ); ?></span>
			<strong class="site-pulse__value" data-wp-text="state.valueFor<?php echo esc_attr( ucfirst( $row['type'] ) ); ?>">
				<?php echo (int) $row['published']; ?>
			</strong>
		</li>
		<?php endforeach; ?>
	</ul>
</div>
