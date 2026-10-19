/**
 * Another go at the profile list of an account that has never had one.
 *
 * An account whose first sign-in lookup failed is stored with no profile list
 * at all. Three were in October 2026, and none of them pressed "Refresh from
 * Battle.net": the account page threw on the missing list, so they never saw
 * the button, and their player pages stayed unclaimed. So the site asks again
 * by itself whenever such an account loads a page, with the app's token. The
 * account id it asks about was read off the user's own token at sign-in,
 * which is what proves ownership, not the token the profiles are fetched with.
 *
 * At most once per account per ten minutes, so a Blizzard outage costs one
 * request per account every ten minutes rather than one per page view.
 */
import { appToken, bnetConfigured, fetchSc2Profiles } from './bnet.ts';
import { fillMissingProfiles, getAccount, type AccountDoc } from './db.ts';
import { dropDeadPortraits } from './portraits.ts';

const RETRY_MS = 10 * 60_000;
const lastTry = new Map<string, number>();
const inFlight = new Map<string, Promise<AccountDoc>>();

/** The account, with its profiles filled in if they were missing and Blizzard now answers. */
export function healProfiles(account: AccountDoc): Promise<AccountDoc> {
	if (account.toons !== undefined || !bnetConfigured()) return Promise.resolve(account);
	const pending = inFlight.get(account._id);
	if (pending) return pending;
	const last = lastTry.get(account._id);
	if (last !== undefined && Date.now() - last < RETRY_MS) return Promise.resolve(account);
	lastTry.set(account._id, Date.now());

	const run = (async () => {
		try {
			const fetched = await fetchSc2Profiles(await appToken(), account._id);
			if (fetched === null) return account;
			const profiles = await dropDeadPortraits(fetched);
			if (await fillMissingProfiles(account._id, profiles)) {
				console.info(`sc2 profiles filled in for ${account.battletag}: ${profiles.length}`);
			}
			return (await getAccount(account._id)) ?? account;
		} catch (e) {
			console.warn(`sc2 profile heal for ${account.battletag} failed:`, e);
			return account;
		} finally {
			inFlight.delete(account._id);
		}
	})();
	inFlight.set(account._id, run);
	return run;
}
