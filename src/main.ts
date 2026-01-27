import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Actor,log } from 'apify';
import cors from 'cors';
import type { Request, Response } from 'express';
import express from 'express';

import * as GET_DOCUMENTATION from './tools/get_component_documentation.js';
import * as GET_STORY_URLS from './tools/get_story_urls.js';
import * as BUILDING_INSTRUCTIONS from './tools/get_ui_building_instructions.js';
import * as LIST_ALL_COMPONENTS from './tools/list_all_components.js';

await Actor.init();

const getServer = () => {
    const server = new McpServer(
        {
            name: 'storybook-mcp',
            version: '1.0.0',
        },
        { capabilities: { logging: {} } },
    );

    server.registerTool(
        BUILDING_INSTRUCTIONS.EVENT_NAME,
        BUILDING_INSTRUCTIONS.CONFIG_SCHEMA,
        BUILDING_INSTRUCTIONS.CONFIG,
    );
    server.registerTool(
        GET_STORY_URLS.EVENT_NAME,
        GET_STORY_URLS.CONFIG_SCHEMA,
        GET_STORY_URLS.CONFIG,
    );
    server.registerTool(
        LIST_ALL_COMPONENTS.EVENT_NAME,
        LIST_ALL_COMPONENTS.CONFIG_SCHEMA,
        LIST_ALL_COMPONENTS.CONFIG,
    );
    server.registerTool(
        GET_DOCUMENTATION.EVENT_NAME,
        GET_DOCUMENTATION.CONFIG_SCHEMA,
        GET_DOCUMENTATION.CONFIG,
    );

    return server;
};

const app = express();
app.use(express.json());

// Configure CORS to expose Mcp-Session-Id header for browser-based clients
app.use(
    cors({
        origin: '*', // Allow all origins - adjust as needed for production
        exposedHeaders: ['Mcp-Session-Id'],
    }),
);

// Readiness probe handler
app.get('/', (req: Request, res: Response) => {
    if (req.headers['x-apify-container-server-readiness-probe']) {
        log.info('Readiness probe');
        res.end('ok\n');
        return;
    }
    res.status(404).end();
});

app.post('/mcp', async (req: Request, res: Response) => {
    const server = getServer();
    try {
        const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        res.on('close', () => {
            log.info('Request closed');
            void transport.close();
            void server.close();
        });
    } catch (error) {
        log.error('Error handling MCP request:', {
            error,
        });
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error',
                },
                id: null,
            });
        }
    }
});

app.get('/mcp', (_req: Request, res: Response) => {
    log.info('Received GET MCP request');
    res.writeHead(405).end(
        JSON.stringify({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Method not allowed.',
            },
            id: null,
        }),
    );
});

app.delete('/mcp', (_req: Request, res: Response) => {
    log.info('Received DELETE MCP request');
    res.writeHead(405).end(
        JSON.stringify({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Method not allowed.',
            },
            id: null,
        }),
    );
});

// Start the server
const PORT = process.env.APIFY_CONTAINER_PORT ? parseInt(process.env.APIFY_CONTAINER_PORT, 10) : 3000;
app.listen(PORT, (error) => {
    if (error) {
        log.error('Failed to start server:', {
            error,
        });
        process.exit(1);
    }
    log.info(`MCP Server listening on port ${PORT}`);
    log.info(`Access MCP Server via ${Actor.config.get('standbyUrl')}/mcp`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
    log.info('Shutting down server...');
    process.exit(0);
});
