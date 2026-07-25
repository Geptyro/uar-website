import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	// The server libs (db.ts, s3.ts) read process.env directly so the same
	// modules also work in plain-node CLI scripts; vite only exposes .env to
	// the $env modules, so mirror it into process.env for `vite dev`/`preview`.
	Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

	return {
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

				// All pages stay prerendered (see src/routes/+layout.ts); the node
				// server exists for the replay upload API and the Mongo-backed
				// player pages.
				adapter: adapter()
			})
		]
	};
});
