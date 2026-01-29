import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Actor } from "apify";
import z from "zod";

export const EVENT_NAME = 'get-story-urls';

export const CONFIG_SCHEMA = {
    description:
        'Get the URL for one or more stories by their IDs. Story IDs are in the format "group-name-component-name" (e.g., "ui-library-cardcontainer").',
    inputSchema: {
        ids: z
            .array(z.string())
            .describe('List of story IDs to resolve URLs for'),
    },
    outputSchema: {
        stories: z.array(
            z.object({
                id: z.string(),
                url: z.string(),
            }),
        ),
    },
};

export const CONFIG = async ({ ids }: { ids: string[] }, storybookBaseUrl: string): Promise<CallToolResult> => {
    await Actor.charge({ eventName: EVENT_NAME });

    const results = ids.map((id) => ({
        id,
        url: `${storybookBaseUrl}?path=/story/${id}`,
    }));

    return {
        content: [
            {
                type: 'text',
                text: `Resolved ${results.length} story URL${results.length !== 1 ? 's' : ''}.`,
            },
        ],
        structuredContent: { stories: results },
    };
};
