import { log } from 'apify';
import type { Locator, Page } from 'playwright';

import type { StorybookIndex } from './types.js';
import { sleep } from 'crawlee';

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

/**
 *
 * Playwright crawling functions
 *
 */

export async function openCodeExamples(container: Locator) {
    const toggleButtons = await container.locator('.docblock-code-toggle').elementHandles();
    for (const btn of toggleButtons) {
        await btn.click();
        await sleep(250); // small delay to allow code block to render
    }
}

export async function getStoryDocContainer(page: Page): Promise<Locator> {
    await page.waitForSelector('#storybook-preview-iframe');
    const frameLocator = page.frameLocator('#storybook-preview-iframe');
    if (!frameLocator) {
        throw new Error('Could not find Storybook preview iframe on the page');
    }
    // There may be different nesting levels depending on Storybook version and layout
    // so we use look for H1 presence in order to find the father container of all the doc elements
    const base = '#storybook-docs div.sbdocs div.sbdocs';
    const depthSelectors = [
        base,
        `${base} > div`,
        `${base} > div > div`,
    ];
    // Wait for the base container to appear
    await frameLocator.locator(base).first().waitFor();

    for (const sel of depthSelectors) {
        const candidate = frameLocator.locator(sel).first();
        // Check for an H1 child inside the candidate
        if (await candidate.locator('> h1').count()) {
            return candidate;
        }
    }

    // Fallback to original container if none matched the H1 heuristic
    const fallback = frameLocator.locator(base).first();
    await fallback.waitFor();
    return fallback;
}

export async function scrapeDocsIframe(container: Locator): Promise<{ title: string; markdown: string }> {
    // note that "evaluate" runs in the browser context
    // any variables from outside are not accessible here
    // any console.log calls will appear in the browser console, not in Node.js logs
    return await container.evaluate((el: Element) => {
        const lines: string[] = [];
        let title = '';
        const kids = Array.from(el.children);

        for (const child of kids) {
            const tag = child.tagName.toLowerCase();
            const text = (child.textContent || '').trim();
            switch (tag) {
                case 'h1':
                    if (!title) title = text;
                    lines.push(`# ${text}`);
                    break;
                case 'h2':
                    lines.push(`## ${text}`);
                    break;
                case 'h3':
                    lines.push(`### ${text}`);
                    break;
                case 'h4':
                    lines.push(`#### ${text}`);
                    break;
                case 'h5':
                    lines.push(`##### ${text}`);
                    break;
                case 'h6':
                    lines.push(`###### ${text}`);
                    break;
                case 'ul': {
                    const items = Array.from(child.children).filter(c => c.tagName.toLowerCase() === 'li');
                    for (const li of items) lines.push(`- ${(li.textContent || '').trim()}`);
                    break;
                }
                case 'ol': {
                    const items = Array.from(child.children).filter(c => c.tagName.toLowerCase() === 'li');
                    items.forEach((li, i) => lines.push(`${i + 1}. ${(li.textContent || '').trim()}`));
                    break;
                }
                case 'div': {
                    // div can be a story preview with a code block
                    const pre = child.querySelector('pre');
                    if (pre) {
                        const storyTitle = child.querySelector('h3');
                        const code = (pre.textContent || '').trim();
                        if (code) {
                            if (storyTitle) {
                                const stText = (storyTitle.textContent || '').trim();
                                lines.push(`#### ${stText}`);
                            }
                            lines.push('```tsx');
                            lines.push(code);
                            lines.push('```');
                        }
                        break;
                    }
                    // div can contain a table with a list of props
                    const table = child.querySelector('table');
                    if (table) {
                        lines.push('**Props**');
                            const tbody = table.querySelector('tbody');
                            if (tbody) {
                                const rows = Array.from(tbody.querySelectorAll('tr'));
                                for (const row of rows) {
                                    const cells = Array.from(row.querySelectorAll('td'));
                                    if (cells.length < 4) {
                                        // Unexpected structure, skip
                                        continue;
                                    }
                                    const name = (cells[0].textContent || '').trim();
                                    const desc = (cells[1].textContent || '').trim();
                                    const defRaw = (cells[2].textContent || '').trim();
                                    const hasDefault = defRaw && defRaw !== '-';
                                    let optionsText = '';
                                    const select = cells[3].querySelector('select');
                                    if (select) {
                                        const opts = Array.from(select.querySelectorAll('option')).map((o) => (o.textContent !== 'Choose option...' ? (o.textContent || '').trim() : '')).filter(Boolean);
                                        if (opts.length) optionsText = opts.join(' | ');
                                    }
                                    const parts: string[] = [];
                                    parts.push(`${name}: ${desc}`);
                                    if (hasDefault) parts.push(`default: ${defRaw}`);
                                    if (optionsText) parts.push(`options: ${optionsText}`);
                                    lines.push(`- ${parts.join(' — ')}`);
                                }
                            }
                        break;
                    }
                    // in any other case, take the text, if there is any
                    if (text) lines.push(text);
                    break;
                }
                case 'style':
                case 'script':
                    break; // ignore
                default:
                    if (text) lines.push(text);
                    break;
            }
        }

        const markdown = lines.join('\n\n');
        return { title, markdown };
    });
}
