<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { getSlideshowImages } from '$lib/config/slideshow';

	interface Props {
		/** Custom list of image URLs. Defaults to getSlideshowImages(). */
		images?: string[];
		/** Time between slide rotations in ms. Default is 5500 (5.5 seconds). */
		interval?: number;
		/** Transition duration in ms. Default is 1000 (1 second). */
		transitionDuration?: number;
		/** Show navigation arrows. Default is true. */
		showArrows?: boolean;
		/** Show bottom indicator dots. Default is true. */
		showDots?: boolean;
		/** Show gradient overlays. Default is true. */
		showOverlays?: boolean;
		/** Accessible slide labels (optional). */
		labels?: string[];
		/** CSS object-fit for slide images. Default is 'cover'. */
		objectFit?: 'cover' | 'contain' | 'scale-down';
		/** CSS object-position for desktop. Default is 'center 60%'. */
		objectPosition?: string;
		/** Whether to fill full container height (100%) instead of default hero height */
		fullHeight?: boolean;
		/** Optional additional CSS class */
		class?: string;
		/** Slotted hero content snippet */
		children?: Snippet;
	}

	let {
		images = getSlideshowImages(),
		interval = 5500,
		transitionDuration = 1000,
		showArrows = true,
		showDots = true,
		showOverlays = true,
		labels = [],
		objectFit = 'cover',
		objectPosition = 'center 60%',
		fullHeight = false,
		class: className = '',
		children
	}: Props = $props();

	// ── State ──────────────────────────────────────────────────────────────────
	let current = $state(0);
	let previous = $state(-1);
	let isTransitioning = $state(false);
	let isPaused = $state(false);
	let isReady = $state(false);
	let timerId: ReturnType<typeof setInterval> | null = null;

	// Touch swipe tracking
	let touchStartX = 0;
	let touchStartY = 0;

	// ── Derived counts and indices ─────────────────────────────────────────────
	const count = $derived(images.length);
	const nextIndex = $derived(count > 0 ? (current + 1) % count : 0);
	const prevIndex = $derived(count > 0 ? (current - 1 + count) % count : 0);

	// ── Navigation helpers ─────────────────────────────────────────────────────
	function goTo(targetIndex: number) {
		if (targetIndex === current || isTransitioning || count <= 1) return;

		previous = current;
		current = targetIndex;
		isTransitioning = true;

		// Reset interval timer on manual navigation so slide stays for full interval
		resetTimer();

		setTimeout(() => {
			isTransitioning = false;
			previous = -1;
		}, transitionDuration);
	}

	function next() {
		goTo(nextIndex);
	}

	function prev() {
		goTo(prevIndex);
	}

	// ── Timer management ───────────────────────────────────────────────────────
	function startTimer() {
		if (count <= 1 || timerId) return;
		timerId = setInterval(() => {
			if (!isPaused && !isTransitioning) {
				next();
			}
		}, interval);
	}

	function stopTimer() {
		if (timerId) {
			clearInterval(timerId);
			timerId = null;
		}
	}

	function resetTimer() {
		stopTimer();
		startTimer();
	}

	// ── Preloading ─────────────────────────────────────────────────────────────
	onMount(() => {
		if (images.length === 0) {
			isReady = true;
			return;
		}

		// 1. Preload ALL images immediately on mount so transitions are instant
		let loadedCount = 0;
		images.forEach((src, i) => {
			const img = new Image();
			img.src = src;

			const onSingleLoad = () => {
				loadedCount++;
				// Once the initial image is loaded, reveal the hero without delay
				if (i === 0 || loadedCount === 1) {
					isReady = true;
				}
			};

			if (img.complete) {
				onSingleLoad();
			} else {
				img.onload = onSingleLoad;
				img.onerror = onSingleLoad; // Don't block slideshow if single image fails
			}
		});

		// Fallback safety timeout so hero displays even on slow network
		const safetyTimeout = setTimeout(() => {
			isReady = true;
		}, 600);

		// Start auto-advance timer
		startTimer();

		return () => {
			clearTimeout(safetyTimeout);
			stopTimer();
		};
	});

	// ── Touch swipe handlers ───────────────────────────────────────────────────
	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
		isPaused = true;
	}

	function handleTouchEnd(e: TouchEvent) {
		const deltaX = e.changedTouches[0].clientX - touchStartX;
		const deltaY = e.changedTouches[0].clientY - touchStartY;

		// Significant horizontal swipe (>40px and more horizontal than vertical)
		if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
			if (deltaX < 0) {
				next();
			} else {
				prev();
			}
		}
		isPaused = false;
	}

	// ── Keyboard navigation ────────────────────────────────────────────────────
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') {
			prev();
		} else if (e.key === 'ArrowRight') {
			next();
		}
	}

	function getSlideLabel(i: number): string {
		return labels[i] ?? `Slide ${i + 1} of ${count}`;
	}
</script>

<div
	class="hero-slideshow {className}"
	class:is-ready={isReady}
	class:full-height={fullHeight}
	style="--transition-duration: {transitionDuration}ms; --object-fit: {objectFit}; --object-position: {objectPosition};"
	aria-label="Decorating inspiration slideshow"
	aria-roledescription="carousel"
	role="region"
	tabindex="0"
	onmouseenter={() => (isPaused = true)}
	onmouseleave={() => (isPaused = false)}
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
	onkeydown={handleKeyDown}
>
	<!-- Slides Container -->
	<div class="slides-wrapper" aria-live="polite">
		{#each images as src, i (src)}
			{@const isActive = i === current}
			{@const isPrevious = i === previous}
			<div
				class="slide"
				class:slide--active={isActive}
				class:slide--previous={isPrevious}
				aria-hidden={!isActive}
				role="group"
				aria-roledescription="slide"
				aria-label={getSlideLabel(i)}
			>
				<img
					{src}
					alt={getSlideLabel(i)}
					loading={i === 0 ? 'eager' : 'lazy'}
					fetchpriority={i === 0 ? 'high' : 'auto'}
					draggable="false"
				/>
			</div>
		{/each}
	</div>

	<!-- Atmospheric Gradient Overlays for readability -->
	{#if showOverlays}
		<div class="overlay overlay--top" aria-hidden="true"></div>
		<div class="overlay overlay--center" aria-hidden="true"></div>
		<div class="overlay overlay--bottom" aria-hidden="true"></div>
	{/if}

	<!-- Slotted Hero Content -->
	<div class="slideshow__content">
		{@render children?.()}
	</div>

	<!-- Arrow Navigation Buttons -->
	{#if showArrows && count > 1}
		<button
			type="button"
			class="arrow-btn arrow-btn--prev"
			onclick={prev}
			aria-label="Previous slide"
		>
			<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="15 18 9 12 15 6"></polyline>
			</svg>
		</button>
		<button
			type="button"
			class="arrow-btn arrow-btn--next"
			onclick={next}
			aria-label="Next slide"
		>
			<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="9 18 15 12 9 6"></polyline>
			</svg>
		</button>
	{/if}

	<!-- Dot Pagination Indicators -->
	{#if showDots && count > 1}
		<div class="dots-indicator" role="tablist" aria-label="Slides">
			{#each images as _, i}
				<button
					type="button"
					class="dot"
					class:dot--active={i === current}
					role="tab"
					aria-selected={i === current}
					aria-label={getSlideLabel(i)}
					onclick={() => goTo(i)}
				></button>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* ── Base Container ──────────────────────────────────────────────────────── */
	.hero-slideshow {
		position: relative;
		width: 100%;
		height: 85vh;
		min-height: 580px;
		max-height: 880px;
		overflow: hidden;
		background-color: #141210;
		outline: none;
		user-select: none;
		opacity: 0;
		transition: opacity 0.4s ease-in;
	}

	.hero-slideshow.is-ready {
		opacity: 1;
	}

	.hero-slideshow.full-height {
		height: 100%;
		min-height: 100%;
		max-height: none;
	}

	/* ── Slides Stack ────────────────────────────────────────────────────────── */
	.slides-wrapper {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.slide {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		visibility: hidden;
		z-index: 0;
		pointer-events: none;
		will-change: opacity;
		transition: opacity var(--transition-duration) cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* Previous slide stays visible underneath the incoming active slide */
	.slide--previous {
		opacity: 1;
		visibility: visible;
		z-index: 1;
		/* Hold solid while active slide fades in above it, eliminating ghosting */
		transition: none;
	}

	/* Active slide fades in on top cleanly */
	.slide--active {
		opacity: 1;
		visibility: visible;
		z-index: 2;
		pointer-events: auto;
		transition: opacity var(--transition-duration) cubic-bezier(0.4, 0, 0.2, 1);
	}

	.slide img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: var(--object-fit, cover);
		object-position: var(--object-position, center 60%);
		display: block;
	}

	@media (max-width: 1024px) {
		.slide img {
			object-position: var(--object-position, center 55%);
		}
	}

	@media (max-width: 768px) {
		.slide img {
			object-position: var(--object-position, center 50%);
		}
	}

	/* ── Gradient Overlays ───────────────────────────────────────────────────── */
	.overlay {
		position: absolute;
		left: 0;
		right: 0;
		pointer-events: none;
	}

	.overlay--top {
		top: 0;
		height: 35%;
		z-index: 3;
		background: linear-gradient(
			180deg,
			rgba(20, 18, 16, 0.75) 0%,
			rgba(20, 18, 16, 0.25) 60%,
			transparent 100%
		);
	}

	.overlay--center {
		inset: 0;
		z-index: 3;
		background: radial-gradient(
			ellipse at center,
			rgba(20, 18, 16, 0.15) 0%,
			rgba(20, 18, 16, 0.45) 100%
		);
	}

	.overlay--bottom {
		bottom: 0;
		height: 55%;
		z-index: 3;
		background: linear-gradient(
			0deg,
			rgba(20, 18, 16, 0.88) 0%,
			rgba(20, 18, 16, 0.4) 50%,
			transparent 100%
		);
	}

	/* ── Slotted Hero Content ────────────────────────────────────────────────── */
	.slideshow__content {
		position: absolute;
		inset: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: auto;
	}

	/* ── Navigation Arrows ───────────────────────────────────────────────────── */
	.arrow-btn {
		position: absolute;
		top: 50%;
		translate: 0 -50%;
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(20, 18, 16, 0.4);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		color: rgba(255, 255, 255, 0.85);
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.25s ease, background-color 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
		padding: 0;
	}

	.hero-slideshow:hover .arrow-btn,
	.hero-slideshow:focus-within .arrow-btn {
		opacity: 1;
	}

	.arrow-btn--prev {
		left: 1.75rem;
	}

	.arrow-btn--next {
		right: 1.75rem;
	}

	.arrow-btn:hover {
		background: rgba(201, 169, 110, 0.85);
		border-color: #c9a96e;
		color: #141210;
		transform: scale(1.08);
	}

	.arrow-btn:active {
		transform: scale(0.95);
	}

	/* ── Dot Indicators ──────────────────────────────────────────────────────── */
	.dots-indicator {
		position: absolute;
		bottom: 2rem;
		left: 50%;
		translate: -50% 0;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 0.8rem;
		background: rgba(20, 18, 16, 0.35);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 1.5px solid rgba(255, 255, 255, 0.5);
		background: transparent;
		cursor: pointer;
		padding: 0;
		transition:
			background 0.3s ease,
			width 0.3s ease,
			border-radius 0.3s ease,
			border-color 0.3s ease;
	}

	.dot--active {
		width: 26px;
		border-radius: 4px;
		background: #c9a96e;
		border-color: #c9a96e;
		box-shadow: 0 0 10px rgba(201, 169, 110, 0.5);
	}

	.dot:hover:not(.dot--active) {
		background: rgba(255, 255, 255, 0.5);
		border-color: rgba(255, 255, 255, 0.9);
	}

	/* ── Responsive Breakpoints ──────────────────────────────────────────────── */
	@media (max-width: 1024px) {
		.hero-slideshow {
			height: 75vh;
			min-height: 520px;
		}

		.arrow-btn {
			opacity: 0.8; /* Keep visible on touch-capable tablet screens */
		}
	}

	@media (max-width: 768px) {
		.hero-slideshow {
			height: 70svh;
			min-height: 460px;
		}

		.arrow-btn {
			display: none; /* Rely on swipe gestures on mobile */
		}

		.dots-indicator {
			bottom: 1.25rem;
		}
	}

	@media (max-width: 480px) {
		.hero-slideshow {
			height: 65svh;
			min-height: 400px;
		}

		.dots-indicator {
			bottom: 1rem;
		}
	}

	/* ── Accessibility / Reduced Motion ──────────────────────────────────────── */
	@media (prefers-reduced-motion: reduce) {
		.hero-slideshow,
		.slide,
		.dot,
		.arrow-btn {
			transition: none !important;
		}
	}
</style>
