import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Actor } from "apify";
import z from "zod";

export const CONFIG_SCHEMA = {
    description:
        'Provides standardized instructions for UI component development, Storybook CSF3 stories, and story linking requirements.',
    inputSchema: {},
    outputSchema: {
        instructions: z.object({
            storybookCSF3: z.object({
                format: z.string(),
                example: z.string(),
                notes: z.array(z.string()),
            }),
            componentBestPractices: z.array(z.string()),
            storyLinking: z.object({
                requirement: z.string(),
                pattern: z.string(),
                example: z.string(),
            }),
            additionalBuildingInstructions: z.string().optional(),
        }),
    },
};

export const CONFIG = async (): Promise<CallToolResult> => {
    await Actor.charge({ eventName: 'get_ui_building_instructions' });
    const input = await Actor.getInput<{ additionalBuildingInstructions?: string }>();
    const extra = (input?.additionalBuildingInstructions ?? '').trim();
    const structuredContent = {
        instructions: {
            storybookCSF3: {
                format: 'Use CSF3 with default export meta and named stories.',
                example:
                    "export default { title: 'Components/Button', component: Button }; export const Primary = { args: { variant: 'primary' } };",
                notes: [
                    'Name stories with PascalCase matching export names.',
                    'Prefer args for state; avoid decorators unless necessary.',
                ],
            },
            componentBestPractices: [
                'Keep components pure; move side-effects outside.',
                'Type props with clear interfaces and sensible defaults.',
                'Document props via JSDoc or TSDoc annotations.',
            ],
            storyLinking: {
                requirement: 'Every story must be linkable via Storybook URL.',
                pattern: '?path=/story/<group>--<story-name>',
                example:
                    'https://apify.github.io/apify-core/storybook-shared/?path=/story/components-button--primary',
            },
            additionalBuildingInstructions: extra || undefined,
        },
    };

    const sc = structuredContent.instructions;
    const mdx = [
        '# UI Building Instructions',
        '',
        '**Storybook CSF3**',
        `- **Format:** ${sc.storybookCSF3.format}`,
        '- **Example:**',
        '```ts',
        sc.storybookCSF3.example,
        '```',
        '- **Notes:**',
        ...sc.storybookCSF3.notes.map((n) => `  - ${n}`),
        '',
        '**Component Best Practices**',
        ...sc.componentBestPractices.map((p) => `- ${p}`),
        '',
        '**Story Linking**',
        `- **Requirement:** ${sc.storyLinking.requirement}`,
        `- **Pattern:** \`${sc.storyLinking.pattern}\``,
        `- **Example:** [components-button--primary](${sc.storyLinking.example})`,
        ...(extra ? ['','**Additional Instructions**', extra] : []),
        '',
    ].join('\n');

    return {
        content: [
            {
                type: 'text',
                text: mdx,
            },
        ],
        structuredContent,
    };
};
