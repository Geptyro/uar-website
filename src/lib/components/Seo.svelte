<script lang="ts">
	/**
	 * Every page's head in one place: title, description, canonical, and the
	 * card Discord and Twitter unfurl. A page that renders no <Seo> gets no
	 * title at all — deliberately, so a page that forgot one is obvious.
	 */
	import { page } from '$app/state';
	import {
		OG_IMAGE,
		OG_IMAGE_H,
		OG_IMAGE_W,
		SITE_NAME,
		SITE_URL,
		clampText,
		fullTitle
	} from '$lib/seo';

	interface Props {
		/** The page-specific part; only the homepage leaves it out. */
		title?: string;
		description: string;
		/**
		 * Absolute URL of this page's share card. Pages with a subject of their
		 * own pass one (see `entityCardUrl`); the rest share the site card.
		 * Every card is OG_IMAGE_W × OG_IMAGE_H, so the dimensions are fixed.
		 */
		image?: string;
		/**
		 * Keep the page out of the index but let crawlers follow its links —
		 * for pages that are real but have no business being a search result.
		 */
		noindex?: boolean;
	}

	let { title, description, image = OG_IMAGE, noindex = false }: Props = $props();

	const heading = $derived(fullTitle(title));
	// clamped here rather than at each call site, so a hand-written one that
	// drifts long still ships something a search result can render whole
	const desc = $derived(clampText(description));
	/* Built from the constant origin, not page.url: prerendering runs against
	   SvelteKit's internal host. The pathname alone is the point of the tag —
	   ?sort, ?page and ?q are all the same page, and this is what says so. */
	const url = $derived(SITE_URL + page.url.pathname);
</script>

<svelte:head>
	<title>{heading}</title>
	<meta name="description" content={desc} />
	<link rel="canonical" href={url} />
	{#if noindex}<meta name="robots" content="noindex, follow" />{/if}
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={heading} />
	<meta property="og:description" content={desc} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content={String(OG_IMAGE_W)} />
	<meta property="og:image:height" content={String(OG_IMAGE_H)} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={heading} />
	<meta name="twitter:description" content={desc} />
	<meta name="twitter:image" content={image} />
</svelte:head>
