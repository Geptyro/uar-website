/**
 * Commit files to a GitHub repo in a single commit via the Git Data API.
 * Used by the replay upload endpoint: an accepted replay + the regenerated
 * players.json become one commit on main, which the deploy workflow picks up.
 */

interface CommitFile {
	path: string;
	content: Uint8Array | string;
}

export async function commitFiles(
	token: string,
	repo: string,
	branch: string,
	files: CommitFile[],
	message: string
): Promise<string> {
	const api = async (path: string, init?: RequestInit): Promise<Record<string, unknown>> => {
		const res = await fetch(`https://api.github.com${path}`, {
			...init,
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
				...(init?.body ? { 'Content-Type': 'application/json' } : {})
			}
		});
		if (!res.ok) {
			const body = await res.text();
			throw new Error(`GitHub ${init?.method ?? 'GET'} ${path}: ${res.status} ${body.slice(0, 300)}`);
		}
		return res.json() as Promise<Record<string, unknown>>;
	};

	// two attempts: a concurrent push between read and ref-update loses the
	// fast-forward race; refetch and retry once
	let lastError: unknown;
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const ref = await api(`/repos/${repo}/git/ref/heads/${branch}`);
			const baseSha = (ref.object as { sha: string }).sha;
			const baseCommit = await api(`/repos/${repo}/git/commits/${baseSha}`);
			const baseTree = (baseCommit.tree as { sha: string }).sha;

			const treeEntries = [];
			for (const file of files) {
				const content =
					typeof file.content === 'string' ? Buffer.from(file.content) : Buffer.from(file.content);
				const blob = await api(`/repos/${repo}/git/blobs`, {
					method: 'POST',
					body: JSON.stringify({ content: content.toString('base64'), encoding: 'base64' })
				});
				treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha as string });
			}

			const tree = await api(`/repos/${repo}/git/trees`, {
				method: 'POST',
				body: JSON.stringify({ base_tree: baseTree, tree: treeEntries })
			});

			const commit = await api(`/repos/${repo}/git/commits`, {
				method: 'POST',
				body: JSON.stringify({ message, tree: tree.sha as string, parents: [baseSha] })
			});

			await api(`/repos/${repo}/git/refs/heads/${branch}`, {
				method: 'PATCH',
				body: JSON.stringify({ sha: commit.sha as string })
			});
			return commit.sha as string;
		} catch (e) {
			lastError = e;
		}
	}
	throw lastError;
}
