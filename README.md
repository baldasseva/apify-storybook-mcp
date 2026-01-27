# Storybook MCP Server

## Overview

This is an Apify Standby Actor that exposes a Model Context Protocol (MCP) server. It helps LLMs explore any public Storybook, list components, and fetch readable documentation for individual components.

## What Is Storybook?
Storybook is a UI workshop for building, testing, and documenting components in isolation. It renders stories (examples) and docs pages so teams can browse usage, props, and code samples without running the full app. Learn more at https://storybook.js.org.

## What is this Actor?
Runs as a long‑lived Standby Actor with a stable URL so tools can call it on demand.
Serves an MCP server over HTTP, exposing tools to:
- List available components in a public Storybook
- Retrieve structured build guidance (plus MDX text) for assembling UI
- Fetch ordered, readable Markdown documentation for a component by id
- Discover story URLs for a component


### MCP Tools
- `get_ui_building_instructions`: Returns structured instructions and MDX text. Appends optional _additionalBuildingInstructions_ from Actor input.
- `list_all_components`: Lists unique components. Returns structured _components_ and an MDX list.
- `get_component_documentation`: Navigates to a Storybook docs page and extracts ordered Markdown (headings, paragraphs, lists, code blocks, props table). Output is Markdown-only.
- `get_story_urls`: Returns helpful Storybook URLs for a component/story (handy for quick navigation).

### Actor input
- `storybookBaseUrl` (required): Public base of the Storybook root (must end with `/`).
- `additionalBuildingInstructions` (optional): Free‑text appended to UI building tips.

Pricing events: Tools may call `Actor.charge({ eventName })` (see the tool files) to account PPE usage.

## What Is an MCP Server?
Model Context Protocol (MCP) is an open protocol for connecting tools, data sources, and apps to LLMs in a consistent, secure way. An MCP server exposes “tools” that LLM runtimes can call.

This Actor uses the MCP SDK’s Streamable HTTP transport so any MCP-capable client can discover and invoke tools via `POST /mcp`.

Learn more:
	- [MCP project doc](https://modelcontextprotocol.io)
	- [Apify MCP server doc](https://docs.apify.com/platform/integrations/mcp)
    - [Apify Standby mode](https://docs.apify.com/platform/actors/development/programming-interface/standby)

### Wiring This Server To Your LLM
- Get the MCP server URL from the "Standby" tab of this Actor
- The setup depends on the AI Agent you're using, so check out the documentation

### Pricing (PPE)
This Actor uses Pay‑Per‑Event (PPE). PPE charges per tool invocation. Users pay two things:
- Platform usage costs
- Tool invocations

See Apify documentation on monetization and PPE for details and best practices.

