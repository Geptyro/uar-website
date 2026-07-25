import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		port: 6677
	},
	preview: {
		port: 6677
	},
	// grid-router ships Svelte source — keep it out of prebundling
	optimizeDeps: { exclude: ['grid-router'] },
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// All pages stay prerendered (see src/routes/+layout.ts); the node server
			// exists for the replay upload API (src/routes/api/replays), which needs
			// to parse uploads in-process and commit them to GitHub.
			adapter: adapter()
		})
	]
});
