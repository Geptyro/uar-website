/**
 * A chat message as a reader sees it: named and pictured as the site names
 * players, the words rendered through the guide renderer (chips, key caps),
 * and whether it is the reader's own. The page and the stream both draw
 * from this so a message looks the same arriving live as loaded.
 */
import { getAvatarsByToon, getNamesByToon } from './db';
import type { ChatDoc } from './chat';
import { renderBuildMarkdown } from '$lib/buildMarkdown';
import { refResolver } from '$lib/buildRefs';
import { reactedIds, reactorsOn } from './reactions';
import { playerCards } from './playerCards';
import { playerRefsIn } from '$lib/builds';
import { reactionViews, type ReactionView } from '$lib/reactions';

export interface ChatView {
	id: string;
	name: string;
	toon: string | null;
	avatar: string | null;
	/** The words as written, for editing one's own. */
	text: string;
	html: string;
	createdAt: string;
	editedAt: string | null;
	mine: boolean;
	reactions: ReactionView[];
}


export async function chatViews(docs: ChatDoc[], viewer: string | null): Promise<ChatView[]> {
	if (!docs.length) return [];
	const [names, avatars, faces, players] = await Promise.all([
		getNamesByToon(),
		getAvatarsByToon(),
		reactorsOn('chat', reactedIds(docs), viewer),
		playerCards(docs.flatMap((m) => playerRefsIn(m.text)))
	]);
	const resolve = refResolver(null, { avatars, players });
	return docs.map((m) => ({
		id: m._id,
		name: (m.author.toon && names[m.author.toon]) || m.author.battletag.replace(/#\d+$/, ''),
		toon: m.author.toon ?? null,
		avatar: (m.author.toon && avatars[m.author.toon]) || null,
		text: m.text,
		html: renderBuildMarkdown(m.text, resolve),
		createdAt: m.createdAt,
		editedAt: m.editedAt ?? null,
		mine: viewer !== null && m.author.sub === viewer,
		reactions: reactionViews(m.reactions, faces.get(m._id)?.mine, faces.get(m._id)?.who)
	}));
}
