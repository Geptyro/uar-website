/**
 * A route component's `data`, held at the last value that was its own.
 *
 * During a client-side navigation an outgoing page or layout can still re-run
 * an effect after its `data` prop already holds the next route's values: a
 * TabBar re-reading its tabs as `page.route` changes, before the old layout is
 * unmounted. A derived reading `data.unit.id` then throws on the way out
 * ("Cannot read properties of undefined (reading 'id')"), and one reading two
 * fields can see one from each page. Held, the outgoing component keeps
 * reading its own data until it is gone; nothing new is ever drawn from it.
 *
 *   const hold = holdData((d: typeof data) => !!d.unit);
 *   const view = $derived(hold(data));
 */
export function holdData<T extends object>(isOwn: (data: T) => boolean): (data: T) => T {
	let last: T | undefined;
	return (data) => {
		if (last === undefined || isOwn(data)) last = data;
		return last;
	};
}
