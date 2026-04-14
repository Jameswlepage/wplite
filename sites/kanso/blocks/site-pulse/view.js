/**
 * Interactivity store for the Site Pulse dashboard widget.
 *
 * Server-seeded state (from wp_interactivity_state in render.php) provides:
 *   activeTab, counts[], totalPublished, totalDraft
 *
 * Actions flip the active tab; derived getters expose per-post-type values
 * so the template can bind via data-wp-text without knowing which tab is on.
 */

import { store, getContext } from '@wordpress/interactivity';

const { state } = store('kanso/site-pulse', {
	state: {
		get isPublishedTab() {
			return state.activeTab === 'published';
		},
		get isDraftTab() {
			return state.activeTab === 'draft';
		},
	},
	actions: {
		setTab(event) {
			const tab = event?.target?.dataset?.tab;
			if (!tab) return;
			state.activeTab = tab;
			// Update the per-type values for the active tab.
			for (const row of state.counts ?? []) {
				state[`valueFor${row.type.charAt(0).toUpperCase()}${row.type.slice(1)}`] = row[tab] ?? 0;
			}
		},
	},
});

// Prime derived values on load.
for (const row of state.counts ?? []) {
	state[`valueFor${row.type.charAt(0).toUpperCase()}${row.type.slice(1)}`] = row.published ?? 0;
}
