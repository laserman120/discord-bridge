import { Post, Comment, TriggerContext } from '@devvit/public-api';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { ComponentManager } from '../managers/componentManager.js';

/**
 * Handles content update events (e.g., post edits).
 * Re-scans the Reddit item and updates all linked Discord messages 
 * to ensure the displayed content and metadata stay in sync.
 */
export class UpdateHandler extends BaseHandler {
    /**
     * Refreshes all Discord logs for a specific item following a change on Reddit.
     * @param event - The update event (PostUpdate, CommentUpdate, or ModAction).
     * @param context - The Devvit execution context.
     * @param preFetchedContent - Optional pre-fetched content to save API calls.
     */
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        const targetId = this.getRedditId(event);
        if (!targetId) return;

        const logEntries = await StorageManager.getLinkedLogEntries(targetId, context);
        if (logEntries.length === 0) return;

        console.log(`[UpdateHandler] Refreshing ${logEntries.length} messages for ${targetId}`);

        const contentItem = await this.fetchContent(targetId, context, preFetchedContent);
        if (!contentItem) return;

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);

        for (const entry of logEntries) {
            const currentStatus = entry.currentStatus;

            const payload = await ComponentManager.createDefaultMessage(
                contentData, 
                currentStatus, 
                entry.channelType, 
                context
            );

            await WebhookManager.editMessage(
                entry.webhookUrl,
                entry.discordMessageId,
                payload
            );
        }
    }
}