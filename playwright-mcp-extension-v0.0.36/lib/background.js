/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { RelayConnection, debugLog } from './relayConnection.js';
class TabShareExtension {
    _activeConnection;
    _connectedTabId = null;
    _pendingTabSelection = new Map();
    constructor() {
        chrome.tabs.onRemoved.addListener(this._onTabRemoved.bind(this));
        chrome.tabs.onUpdated.addListener(this._onTabUpdated.bind(this));
        chrome.tabs.onActivated.addListener(this._onTabActivated.bind(this));
        chrome.runtime.onMessage.addListener(this._onMessage.bind(this));
        chrome.action.onClicked.addListener(this._onActionClicked.bind(this));
    }
    // Promise-based message handling is not supported in Chrome: https://issues.chromium.org/issues/40753031
    _onMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'connectToMCPRelay':
                this._connectToRelay(sender.tab.id, message.mcpRelayUrl).then(() => sendResponse({ success: true }), (error) => sendResponse({ success: false, error: error.message }));
                return true;
            case 'getTabs':
                this._getTabs().then(tabs => sendResponse({ success: true, tabs, currentTabId: sender.tab?.id }), (error) => sendResponse({ success: false, error: error.message }));
                return true;
            case 'connectToTab':
                const tabId = message.tabId || sender.tab?.id;
                const windowId = message.windowId || sender.tab?.windowId;
                this._connectTab(sender.tab.id, tabId, windowId, message.mcpRelayUrl).then(() => sendResponse({ success: true }), (error) => sendResponse({ success: false, error: error.message }));
                return true; // Return true to indicate that the response will be sent asynchronously
            case 'getConnectionStatus':
                sendResponse({
                    connectedTabId: this._connectedTabId
                });
                return false;
            case 'disconnect':
                this._disconnect().then(() => sendResponse({ success: true }), (error) => sendResponse({ success: false, error: error.message }));
                return true;
        }
        return false;
    }
    async _connectToRelay(selectorTabId, mcpRelayUrl) {
        try {
            debugLog(`Connecting to relay at ${mcpRelayUrl}`);
            const socket = new WebSocket(mcpRelayUrl);
            await new Promise((resolve, reject) => {
                socket.onopen = () => resolve();
                socket.onerror = () => reject(new Error('WebSocket error'));
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });
            const connection = new RelayConnection(socket);
            connection.onclose = () => {
                debugLog('Connection closed');
                this._pendingTabSelection.delete(selectorTabId);
                // TODO: show error in the selector tab?
            };
            this._pendingTabSelection.set(selectorTabId, { connection });
            debugLog(`Connected to MCP relay`);
        }
        catch (error) {
            const message = `Failed to connect to MCP relay: ${error.message}`;
            debugLog(message);
            throw new Error(message);
        }
    }
    async _connectTab(selectorTabId, tabId, windowId, mcpRelayUrl) {
        try {
            debugLog(`Connecting tab ${tabId} to relay at ${mcpRelayUrl}`);
            try {
                this._activeConnection?.close('Another connection is requested');
            }
            catch (error) {
                debugLog(`Error closing active connection:`, error);
            }
            await this._setConnectedTabId(null);
            this._activeConnection = this._pendingTabSelection.get(selectorTabId)?.connection;
            if (!this._activeConnection)
                throw new Error('No active MCP relay connection');
            this._pendingTabSelection.delete(selectorTabId);
            this._activeConnection.setTabId(tabId);
            this._activeConnection.onclose = () => {
                debugLog('MCP connection closed');
                this._activeConnection = undefined;
                void this._setConnectedTabId(null);
            };
            await Promise.all([
                this._setConnectedTabId(tabId),
                chrome.tabs.update(tabId, { active: true }),
                chrome.windows.update(windowId, { focused: true }),
            ]);
            debugLog(`Connected to MCP bridge`);
        }
        catch (error) {
            await this._setConnectedTabId(null);
            debugLog(`Failed to connect tab ${tabId}:`, error.message);
            throw error;
        }
    }
    async _setConnectedTabId(tabId) {
        const oldTabId = this._connectedTabId;
        this._connectedTabId = tabId;
        if (oldTabId && oldTabId !== tabId)
            await this._updateBadge(oldTabId, { text: '' });
        if (tabId)
            await this._updateBadge(tabId, { text: '✓', color: '#4CAF50', title: 'Connected to MCP client' });
    }
    async _updateBadge(tabId, { text, color, title }) {
        try {
            await chrome.action.setBadgeText({ tabId, text });
            await chrome.action.setTitle({ tabId, title: title || '' });
            if (color)
                await chrome.action.setBadgeBackgroundColor({ tabId, color });
        }
        catch (error) {
            // Ignore errors as the tab may be closed already.
        }
    }
    async _onTabRemoved(tabId) {
        const pendingConnection = this._pendingTabSelection.get(tabId)?.connection;
        if (pendingConnection) {
            this._pendingTabSelection.delete(tabId);
            pendingConnection.close('Browser tab closed');
            return;
        }
        if (this._connectedTabId !== tabId)
            return;
        this._activeConnection?.close('Browser tab closed');
        this._activeConnection = undefined;
        this._connectedTabId = null;
    }
    _onTabActivated(activeInfo) {
        for (const [tabId, pending] of this._pendingTabSelection) {
            if (tabId === activeInfo.tabId) {
                if (pending.timerId) {
                    clearTimeout(pending.timerId);
                    pending.timerId = undefined;
                }
                continue;
            }
            if (!pending.timerId) {
                pending.timerId = setTimeout(() => {
                    const existed = this._pendingTabSelection.delete(tabId);
                    if (existed) {
                        pending.connection.close('Tab has been inactive for 5 seconds');
                        chrome.tabs.sendMessage(tabId, { type: 'connectionTimeout' });
                    }
                }, 5000);
                return;
            }
        }
    }
    _onTabUpdated(tabId, changeInfo, tab) {
        if (this._connectedTabId === tabId)
            void this._setConnectedTabId(tabId);
    }
    async _getTabs() {
        const tabs = await chrome.tabs.query({});
        return tabs.filter(tab => tab.url && !['chrome:', 'edge:', 'devtools:'].some(scheme => tab.url.startsWith(scheme)));
    }
    async _onActionClicked() {
        await chrome.tabs.create({
            url: chrome.runtime.getURL('status.html'),
            active: true
        });
    }
    async _disconnect() {
        this._activeConnection?.close('User disconnected');
        this._activeConnection = undefined;
        await this._setConnectedTabId(null);
    }
}
new TabShareExtension();
