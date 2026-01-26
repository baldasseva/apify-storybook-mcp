import { log } from 'apify';

import type { StorybookIndex } from './types.js';

function normalizeBaseUrl(baseUrl: string): string {
    const trimmed = baseUrl.trim();
    if (!trimmed) throw new Error('storybookBaseUrl is empty');
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

/** Fetch and parse the shared Storybook index.json */
export async function fetchSharedStorybookIndex(storybookBaseUrl: string): Promise<StorybookIndex> {
    const base = normalizeBaseUrl(storybookBaseUrl);
    const indexUrl = `${base}index.json`;
    log.info(`Fetching Storybook index.json from ${indexUrl}`);
    const res = await fetch(indexUrl, { method: 'GET' });
    if (!res.ok) {
        const msg = `Failed to fetch index.json (${indexUrl}): ${res.status} ${res.statusText}`;
        log.error(msg);
        throw new Error(msg);
    }
    const json = (await res.json()) as StorybookIndex;
    log.debug(`Fetched Storybook index v=${json.v} with ${Object.keys(json.entries).length} entries`);
    return json;
}
