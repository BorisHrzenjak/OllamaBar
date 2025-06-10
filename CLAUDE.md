# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OllamaBar is a Chrome extension that enables users to chat with local Ollama models directly in their browser. The project consists of two main components:

1. **Chrome Extension** (`chrome_extension/`) - The frontend that runs in the browser
2. **Proxy Server** (`proxy_server/`) - A CORS proxy server that facilitates communication between the extension and Ollama API

## Architecture

The application follows a client-proxy-server architecture:
- Chrome extension UI communicates with the proxy server on `http://localhost:3000`
- Proxy server forwards requests to Ollama API on `http://localhost:11434`
- All chat conversations are stored locally using Chrome's storage API
- Multiple model support with conversation history per model

## Common Commands

### Start the Proxy Server
```bash
cd proxy_server
npm start
```

### Load the Chrome Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `chrome_extension/` directory

### Install Dependencies
```bash
cd proxy_server
npm install
```

## Key Components

### Chrome Extension Structure
- `popup.html/js` - Extension popup for model selection
- `chat.html/js` - Main chat interface with streaming support
- `background.js` - Service worker for tab management
- `manifest.json` - Extension configuration

### Proxy Server
- `server.js` - Express server with CORS handling and request filtering
- Only allows requests to specific Ollama API endpoints (`/api/tags`, `/api/chat`, `/api/generate`)
- Enforces localhost-only connections for security
- Automatically enables streaming for chat requests

### Storage System
- Conversations are stored per-model using Chrome storage API
- Storage key format: `ollamaBroChat_{sanitized_model_name}`
- Each model maintains independent conversation history and active conversation state

## Development Notes

- The proxy server runs on port 3000 and expects Ollama on port 11434
- Extension uses Manifest V3 with host permissions for `http://localhost:3000/*`
- Chat interface supports streaming responses and conversation management
- All messages support `<think>` tag parsing for reasoning display