/**
 * Hero Slideshow Configuration
 *
 * Automatically resolves images from the slideshow images directory,
 * or falls back to the clean static slideshow image paths.
 * Adding or removing an image file here or in the folder automatically updates the rotation.
 */

// 1. Vite glob for static slideshow images (clean URL-friendly paths)
const staticSlideshowModules = import.meta.glob<string>(
	'/static/slideshow-images/slide-*.{jpeg,jpg,png,webp,avif}',
	{ eager: true, query: '?url', import: 'default' }
);

// Fallback list of static URLs served by SvelteKit
export const DEFAULT_SLIDESHOW_IMAGES: string[] = [
	'/slideshow-images/slide-1.jpeg',
	'/slideshow-images/slide-2.jpeg',
	'/slideshow-images/slide-3.jpeg',
	'/slideshow-images/slide-4.jpeg'
];

/**
 * Returns the resolved list of slideshow images.
 * Strips `/static` prefix if Vite glob returns paths prefixed with `/static`.
 */
export function getSlideshowImages(): string[] {
	const globKeys = Object.keys(staticSlideshowModules);
	if (globKeys.length > 0) {
		return globKeys
			.sort()
			.map((key) => key.replace(/^\/static/, ''));
	}
	return DEFAULT_SLIDESHOW_IMAGES;
}
