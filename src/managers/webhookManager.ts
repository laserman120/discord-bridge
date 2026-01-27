import { Devvit, Post, Context } from '@devvit/public-api';
import { ItemState, ChannelType } from '../config/enums.js';
import { LogEntry } from './storageManager.js';
import { UtilityManager } from './utilityManager.js';

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
            const urlObj = new URL(webhookUrl);
            urlObj.searchParams.set('wait', 'true');
            urlObj.searchParams.set('with_components', 'true');
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
            return `failed_id_${Date.now()}`;
        }
    }

    static async getMessage(webhookUrl: string, messageId: string): Promise<any> {
        const webhookDetails = this.parseWebhookUrl(webhookUrl);
        if (!webhookDetails) return null;

        const [webhookId, webhookToken] = webhookDetails;
        const url = `https://discord.com/api/webhooks/${webhookId}/${webhookToken}/messages/${messageId}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`[WEBHOOK] Failed to fetch message ${messageId} (Status ${response.status})`);
                return null;
            }
            return await response.json();
        } catch (e) {
            console.error(`[WEBHOOK] Exception fetching message:`, e);
            return null;
        }
    }

    static async editMessage(webhookUrl: string, messageId: string, payload: unknown): Promise<void> {
        const webhookDetails = this.parseWebhookUrl(webhookUrl);
        if (!webhookDetails) {
            console.error(`[WEBHOOK] Invalid Webhook URL: ${webhookUrl}`);
            return;
        }

        const [webhookId, webhookToken] = webhookDetails;

        const baseUrl = `https://discord.com/api/webhooks/${webhookId}/${webhookToken}/messages/${messageId}`;
        const urlObj = new URL(baseUrl);

        urlObj.searchParams.set('with_components', 'true');

        const discordApiUrl = urlObj.toString();

        try {
            const response = await fetch(discordApiUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[WEBHOOK] Edit failed (Status ${response.status}): ${errorText}`);
            } else {
                console.log(`[WEBHOOK] Successfully updated message ID ${messageId}`);
            }

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error(`[WEBHOOK] Exception during editMessage: ${errorMessage}`);
        }
    }

    static async updateMessageStateOnly(webhookUrl: string, messageId: string, newState: ItemState, context: Context): Promise<void> {
        const webhookDetails = this.parseWebhookUrl(webhookUrl);
        if (!webhookDetails) {
            console.error(`[WEBHOOK] Invalid Webhook URL for update: ${webhookUrl}`);
            return;
        }

        const [webhookId, webhookToken] = webhookDetails;
        const discordApiUrl = `${DISCORD_API_BASE}/${webhookId}/${webhookToken}/messages/${messageId}`;

        try {
            const getResponse = await fetch(discordApiUrl);
            if (!getResponse.ok) {
                console.error(`[WEBHOOK] Failed to fetch message ${messageId} for update (Status ${getResponse.status}).`);
                return;
            }

            const existingMessage = await getResponse.json();

            if (!existingMessage.embeds || existingMessage.embeds.length === 0) {
                console.warn(`[WEBHOOK] Message ${messageId} has no embeds to update.`);
                return;
            }

            const embed = existingMessage.embeds[0];

            embed.color = await UtilityManager.getColorFromState(newState, context);

            const statusText = UtilityManager.getStatusTextModMail(newState);

            if (embed.fields) {
                const statusField = embed.fields.find((f: any) => f.name === 'Status');
                if (statusField) {
                    statusField.value = statusText;
                } else {
                    embed.fields.push({ name: 'Status', value: statusText, inline: true });
                }
            }

            const patchResponse = await fetch(discordApiUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] }),
            });

            if (patchResponse.ok) {
                console.log(`[WEBHOOK] Successfully updated state for message ${messageId} to ${newState}`);
            } else {
                console.error(`[WEBHOOK] Failed to patch message state (Status ${patchResponse.status}).`);
            }

        } catch (e) {
            console.error(`[WEBHOOK] Exception during updateMessageStateOnly: ${e}`);
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