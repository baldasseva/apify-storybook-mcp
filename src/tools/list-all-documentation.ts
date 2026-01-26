import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Actor } from "apify";
import z from "zod";

import { buildComponentIndex, fetchSharedStorybookIndex, listDocs } from "../storybook_scraper.js";
import type { DocListEntry } from "../types.js";

export const CONFIG_SCHEMA = {
    description:
        'Lists all available UI components and standalone docs in the shared Storybook (live data from index.json).',
    inputSchema: {},
    outputSchema: {
        entries: z.array(
            z.object({
                id: z.string(),
                title: z.string(),
                kind: z.enum(['component', 'docs']),
                path: z.string(),
            }),
        ),
    },
};

export const CONFIG = async (): Promise<CallToolResult> => {
    await Actor.charge({ eventName: 'list-all-documentation' });
    const input = await Actor.getInput<{ storybookBaseUrl: string }>();
    if (!input?.storybookBaseUrl) {
        throw new Error('Missing required Actor input: storybookBaseUrl');
    }
    const index = await fetchSharedStorybookIndex(input.storybookBaseUrl);
    const components = buildComponentIndex(index).map<DocListEntry>((c) => ({
        id: c.baseId,
        title: c.title,
        kind: 'component',
        path: c.importPaths[0] ?? '',
    }));
    const docs = listDocs(index).map<DocListEntry>((d) => ({
        id: d.id,
        title: d.title,
        kind: 'docs',
        path: d.importPath,
    }));
    const entries: DocListEntry[] = [...components, ...docs];

    return {
        content: [
            { type: 'text', text: `Returned ${entries.length} entries from Storybook index.` },
        ],
        structuredContent: { entries },
    };
};
