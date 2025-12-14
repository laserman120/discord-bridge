import { Devvit, Post, Context } from '@devvit/public-api';
import { ItemState, ChannelType } from '../config/enums.js';
import { LogEntry } from './storageManager.js';

const DISCORD_API_BASE = 'https://discord.com/api/webhooks';

export class WebhookManager {

    private static parseWebhookUrl(webhookUrl: string): [string, string] | null {
        const parts = webhookUrl.split('/').filter(Boolean);
        // Expecting format: .../webhooks/ID/TOKEN
        if (parts.length < 2) {
            return null;
        }
        const webhookToken = parts[parts.length - 1];
        const webhookId = parts[parts.length - 2];
        return [webhookId, webhookToken];
    }

    static async sendNewMessage(webhookUrl: string, payload: unknown, _context?: any): Promise<string> {
        try {
            // Using global fetch instead of context.http
            const urlObj = new URL(webhookUrl);
            urlObj.searchParams.set('wait', 'true');
            const urlWithWait = urlObj.toString();

            const response = await fetch(urlWithWait, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[WEBHOOK] Failed to send (Status ${response.status}): ${errorText}`);
                throw new Error(`Discord API error: ${response.status}`);
            }

            const data = await response.json() as { id: string };
            const discordMessageId = data.id;

            console.log(`[WEBHOOK] Successfully sent message. Discord ID: ${discordMessageId}`);
            return discordMessageId;

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error(`[WEBHOOK] Exception during sendNewMessage: ${errorMessage}`);
            // Return a placeholder so we don't crash the app, but allow logs to show the error
            return `failed_id_${Date.now()}`;
        }
    }


    static async editMessage(webhookUrl: string, messageId: string, payload: unknown): Promise<void> {
        const webhookDetails = this.parseWebhookUrl(webhookUrl);
        if (!webhookDetails) {
            console.error(`[WEBHOOK] Invalid Webhook URL: ${webhookUrl}`);
            return;
        }

        const [webhookId, webhookToken] = webhookDetails;
        const discordApiUrl = `${DISCORD_API_BASE}/${webhookId}/${webhookToken}/messages/${messageId}`;

        try {
            const response = await fetch(discordApiUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[WEBHOOK] Edit failed (Status ${response.status}): ${errorText}`);
                // We don't throw here to ensure the sync loop continues for other messages
            } else {
                console.log(`[WEBHOOK] Successfully updated message ID ${messageId}`);
            }

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error(`[WEBHOOK] Exception during editMessage: ${errorMessage}`);
        }
    }

    static async deleteMessage(webhookUrl: string, messageId: string, _context?: any): Promise<void> {
        const webhookDetails = this.parseWebhookUrl(webhookUrl);
        if (!webhookDetails) { return; }

        const [webhookId, webhookToken] = webhookDetails;
        const discordApiUrl = `${DISCORD_API_BASE}/${webhookId}/${webhookToken}/messages/${messageId}`;

        try {
            const response = await fetch(discordApiUrl, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });

            if (response.ok || response.status === 404) {
                console.log(`[WEBHOOK] Discord message ${messageId} deleted.`);
            } else {
                const errorText = await response.text();
                console.error(`[WEBHOOK] Deletion failed (Status ${response.status}): ${errorText}`);
            }
        } catch (e) {
            console.error(`[WEBHOOK] Error deleting message: ${e}`);
        }
    }
}