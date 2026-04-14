/**
 * Interactivity store for the Traffic Overview dashboard widget.
 * Flips the active metric and renders a hover tooltip on the SVG chart.
 */

import { store } from '@wordpress/interactivity';

const CHART = { w: 1200, h: 240, pad: { top: 16, right: 16, bottom: 28, left: 44 } };

function formatCompact(n) {
	if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
	if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
	return String(n);
}

function formatRelativeDate(iso) {
	const d = new Date(iso);
	return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const { state } = store('kanso/traffic-overview', {
	state: {
		get isVisitors() { return state.metric === 'visitors'; },
		get isSessions() { return state.metric === 'sessions'; },
		get currentSeries() { return state.series?.[state.metric] ?? []; },
		get currentTotal() { return state.totals?.[state.metric] ?? 0; },
		get currentTrend() { return state.trends?.[state.metric] ?? 0; },
		get formattedTotal() { return formatCompact(state.currentTotal); },
		get trendIsUp() { return state.currentTrend > 0; },
		get trendIsDown() { return state.currentTrend < 0; },
		get trendIsFlat() { return state.currentTrend === 0; },
		get trendArrow() {
			if (state.currentTrend > 0) return '↗';
			if (state.currentTrend < 0) return '↘';
			return '—';
		},
		get trendText() {
			return state.currentTrend === 0 ? '' : Math.abs(state.currentTrend) + '%';
		},
		get hoverHidden() { return state.hoverIdx < 0; },
		get hoverX() { return String(state._point?.x ?? 0); },
		get hoverY() { return String(state._point?.y ?? 0); },
		get hoverValue() {
			const series = state.currentSeries;
			const idx = state.hoverIdx;
			return idx >= 0 && idx < series.length ? series[idx].toLocaleString() : '';
		},
		get hoverDate() {
			const dates = state.dates ?? [];
			return state.hoverIdx >= 0 ? formatRelativeDate(dates[state.hoverIdx]) : '';
		},
		get tooltipLeft() {
			if (state.hoverIdx < 0) return '0%';
			return ((state._point?.x ?? 0) / CHART.w * 100) + '%';
		},
		get tooltipTop() {
			if (state.hoverIdx < 0) return '0%';
			return ((state._point?.y ?? 0) / CHART.h * 100) + '%';
		},
		_point: { x: 0, y: 0 },
	},
	actions: {
		setMetric(event) {
			const metric = event?.target?.dataset?.metric;
			if (metric) state.metric = metric;
			// Redraw the SVG line/area to match the new series.
			const svg = event.target.closest('.traffic-widget')?.querySelector('svg.traffic-chart');
			if (svg) redrawChart(svg, state.currentSeries);
		},
		chartMouseMove(event) {
			const svg = event.currentTarget;
			const rect = svg.getBoundingClientRect();
			const xInSvg = ((event.clientX - rect.left) / rect.width) * CHART.w;
			const series = state.currentSeries;
			if (!series.length) return;
			const iw = CHART.w - CHART.pad.left - CHART.pad.right;
			const step = iw / Math.max(series.length - 1, 1);
			const idx = Math.round((xInSvg - CHART.pad.left) / step);
			if (idx < 0 || idx >= series.length) {
				state.hoverIdx = -1;
				return;
			}
			state.hoverIdx = idx;
			const max = Math.max(...series);
			const niceMax = Math.ceil((max * 1.15) / 10) * 10;
			const niceMin = 0;
			const range = niceMax - niceMin || 1;
			const ih = CHART.h - CHART.pad.top - CHART.pad.bottom;
			state._point = {
				x: CHART.pad.left + idx * step,
				y: CHART.pad.top + ih - ((series[idx] - niceMin) / range) * ih,
			};
		},
		chartMouseLeave() {
			state.hoverIdx = -1;
		},
	},
});

function redrawChart(svg, series) {
	if (!series.length) return;
	const iw = CHART.w - CHART.pad.left - CHART.pad.right;
	const ih = CHART.h - CHART.pad.top - CHART.pad.bottom;
	const max = Math.max(...series);
	const niceMax = Math.ceil((max * 1.15) / 10) * 10;
	const niceMin = 0;
	const range = niceMax - niceMin || 1;
	const step = iw / Math.max(series.length - 1, 1);
	const pts = series.map((v, i) => [
		CHART.pad.left + i * step,
		CHART.pad.top + ih - ((v - niceMin) / range) * ih,
	]);
	const line = 'M ' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L ');
	const area = `M ${CHART.pad.left},${CHART.pad.top + ih} L ` +
		pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L ') +
		` L ${CHART.pad.left + iw},${CHART.pad.top + ih} Z`;
	const paths = svg.querySelectorAll('path');
	if (paths[0]) paths[0].setAttribute('d', area);
	if (paths[1]) paths[1].setAttribute('d', line);
}
