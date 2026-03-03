import { TriggerContext, Post, Comment } from '@devvit/public-api';
import { ItemState } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { ComponentManager } from '../managers/componentManager.js';

/**
 * Handles the 'addremovalreason' moderator action.
 * Updates existing Discord log entries with the removal reason text and 
 * adjusts the message state based on who performed the removal.
 */
export class RemovalReasonHandler extends BaseHandler {
    /**
     * Entry point for removal reason events.
     * @param event - The ModAction event data.
     * @param context - The Devvit execution context.
     * @param preFetchedContent - Optional pre-fetched content to save API calls.
     */
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        // 1. Action Filter: We only care about adding removal reasons
        if (event.action !== 'addremovalreason') return;

        // 2. Resolve ID
        const targetId = this.getRedditId(event);
        if (!targetId) return;

        // 3. Fetch log entries early. If we aren't tracking this item, stop immediately.
        const logEntries = await StorageManager.getLinkedLogEntries(targetId, context);
        if (logEntries.length === 0) {
            console.log(`[RemovalReasonHandler] No tracked messages for ${targetId}. skipping.`);
            return;
        }

        // 4. Resolve Content
        const contentItem = await this.fetchContent(targetId, context, preFetchedContent);
        if (!contentItem || !context.subredditName) return;

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);

        // 5. Verification: Ensure a reason actually exists
        if (!contentData.removalReason) return;

        console.log(`[RemovalReasonHandler] Syncing removal reason for ${targetId} across ${logEntries.length} entries.`);

        // 6. Loop and Update existing messages
        for (const entry of logEntries) {
            // Determine effective state (Awaiting Review vs Removed)
            const state = await this.getEffectiveState(contentData.removedBy, context);

            const payload = await ComponentManager.createDefaultMessage(
                contentData, 
                state, 
                entry.channelType, 
                context
            );

            // Update the Discord message with the new reason text
            await WebhookManager.editMessage(
                entry.webhookUrl,
                entry.discordMessageId,
                payload
            );

            // Update DB status if it's currently lagging behind
            if (entry.currentStatus !== state) {
                await StorageManager.updateLogStatus(entry.discordMessageId, state, context);
            }
        }
    }

    /**
     * Determines the state based on whether the remover is an automated user.
     * @private
     */
    private static async getEffectiveState(removedBy: string | undefined, context: TriggerContext): Promise<ItemState> {
        const automatedRemovalUsers = await context.settings.get('AUTOMATIC_REMOVALS_USERS') as string[] || [];
        
        if (removedBy && automatedRemovalUsers.includes(removedBy)) {
            return ItemState.Awaiting_Review;
        }
        
        return ItemState.Removed;
    }
}