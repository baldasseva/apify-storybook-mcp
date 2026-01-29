import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Actor } from "apify";
import z from "zod";

import { fetchSharedStorybookIndex } from "../storybook_scraper.js";
import type { ComponentEntry } from "../types.js";

export const EVENT_NAME = 'list-all-components';

const buildMdxOutput = (
    components: ComponentEntry[],
    input: { storybookBaseUrl: string }
): string => {
    const lines: string[] = [];
    lines.push('These are the available components:');
    for (const c of components) {
        const url = `${input.storybookBaseUrl}?path=/story/${c.id}`;
        const desc = ''; // not sure how to get this without scraping every doc page
        const tagsText = c.tags.join(', ');
        lines.push(`- [${c.title}](${url}): ${desc} [${tagsText}]`.trimEnd());
    }
    return lines.join('\n');
}

export const CONFIG_SCHEMA = {
    description:
        'Lists all available UI components, deduplicated and filtered',
    inputSchema: {},
    outputSchema: {
        components: z.array(
            z.object({
                id: z.string(),
                title: z.string(),
                importPath: z.string(),
                componentPath: z.string().optional(),
                tags: z.array(z.string()),
            })
        ),
    },
};

export const CONFIG = async (storybookBaseUrl: string): Promise<CallToolResult> => {
    await Actor.charge({ eventName: EVENT_NAME });

    const index = await fetchSharedStorybookIndex(storybookBaseUrl);

    const components: ComponentEntry[] = [];
    const seen = new Set<string>();
    const orderedIds = Object.keys(index.entries);

    for (const id of orderedIds) {
        const e = index.entries[id];
        const isDocType = e.type === 'docs';
        const isMdx = e.importPath.toLowerCase().endsWith('.mdx');
        if (isDocType || isMdx) continue; // remove documentation
        if (e.type !== 'story') continue; // only stories represent components

        const componentBaseId = e.id.includes('--') ? e.id.split('--')[0] : e.id;
        if (seen.has(componentBaseId)) continue; // already represented
        seen.add(componentBaseId);

        const filteredTags = (e.tags ?? []).filter((t) => !['dev', 'test', 'autodocs'].includes(t));
        components.push({
            id: componentBaseId,
            title: e.title,
            importPath: e.importPath,
            componentPath: e.componentPath,
            tags: filteredTags, // exclude non-informative tags
        });
    }

    return {
        content: [{ type: 'text', text: buildMdxOutput(components, { storybookBaseUrl }) }],
        structuredContent: { components },
    };
};
