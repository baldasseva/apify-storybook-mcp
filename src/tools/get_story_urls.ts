import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Actor } from "apify";
import z from "zod";

import type { StoryUrlRequest, StoryUrlResult } from "../types.js";

export const CONFIG_SCHEMA = {
    description:
        'Returns direct Storybook URLs for provided stories based on file path and export name.',
    inputSchema: {
        stories: z
            .array(
                z.object({
                    absoluteStoryPath: z
                        .string()
                        .describe('Absolute path to the story file'),
                    exportName: z.string().describe('Named export of the story'),
                    explicitStoryName: z
                        .string()
                        .optional()
                        .describe('Optional explicit story name override'),
                }),
            )
            .describe('List of story descriptors to resolve'),
    },
    outputSchema: {
        stories: z.array(
            z.object({
                absoluteStoryPath: z.string(),
                exportName: z.string(),
                explicitStoryName: z.string().optional(),
                url: z.string(),
            }),
        ),
    },
};

export const CONFIG = async ({ stories }: { stories: StoryUrlRequest[] }): Promise<CallToolResult> => {
    await Actor.charge({ eventName: 'get_story_urls' });
    const base = 'https://apify.github.io/apify-core/storybook-shared/';
    const results: StoryUrlResult[] = stories.map((s) => ({
        absoluteStoryPath: s.absoluteStoryPath,
        exportName: s.exportName,
        explicitStoryName: s.explicitStoryName,
        url: `${base}?path=/story/dummy-group--${(s.explicitStoryName || s.exportName).toLowerCase()}`,
    }));

    return {
        content: [
            {
                type: 'text',
                text: `Resolved ${results.length} story URLs (dummy).`,
            },
        ],
        structuredContent: { stories: results },
    };
};
