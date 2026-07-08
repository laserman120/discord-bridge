import { TriggerContext, Post, Comment } from '@devvit/public-api';
import { ItemState, ChannelType } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { UtilityManager } from '../helpers/utilityHelper.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { ComponentManager } from '../managers/componentManager.js';
import { PublicPostHandler } from '../handlers/publicPostHandler.js';
import { FlairWatchHandler } from '../handlers/flairWatchHandler.js';
import { ModQueueHandler } from '../handlers/modQueueHandler.js';

/**
 * Synchronizes the state of all tracked Discord messages when a moderator action
 * occurs on Reddit. Ensures that status colors and labels remain consistent.
 */
export class StateSyncHandler extends BaseHandler {
    /**
     * Handles moderator actions and triggers state synchronization across all linked logs.
     * @param event - The ModAction event.
     * @param context - The Devvit execution context.
     * @param preFetchedContent - Optional content already fetched by the QueueManager.
     */
    static async handleModAction(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<boolean> {
        // Resolve ID using BaseHandler
        const targetId = this.getRedditId(event);
        if (!targetId) {
            UtilityManager.log(`[StateSync] Unable to resolve Reddit ID for event: ${JSON.stringify(event)}`);
            return true;
        }

        // Resolve the new Status
        let newStatus = UtilityManager.getStateFromModAction(event.action);
        if (event.targetState === ItemState.Spam) {
            newStatus = ItemState.Spam;
        }

        if (!newStatus) {
            UtilityManager.log(`[StateSync] Failed to find status for action: ${event.action}. Skipping sync for ${targetId}.`);
            return true;
        }

        // Early Exit: If no logs exist, there is nothing to sync
        const logEntries = await StorageManager.getLinkedLogEntries(targetId, context);
        if (logEntries.length === 0) {
            UtilityManager.log(`[StateSync] No tracked messages for ${targetId}. Skipping.`);
            return true;
        }

        // Content Resolution
        const contentItem = await this.fetchContent(targetId, context, preFetchedContent);
        if (!contentItem) {
            UtilityManager.log(`[StateSync] Unable to fetch content for ${targetId}. Skipping sync.`);
            return true;
        } 

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);

        // Adjust for Automated Removals
        if (newStatus === ItemState.Removed) {
            const automatedUsers = await context.settings.get('AUTOMATIC_REMOVALS_USERS') as string[] || [];
            if (automatedUsers.includes(contentData.removedBy?.toLowerCase() || '')) {
                newStatus = ItemState.Awaiting_Review;
            }
        }

        UtilityManager.log(`[StateSync] Syncing ${targetId} to ${newStatus} for ${logEntries.length} messages.`);

        // Notify specific handlers that need to perform side-effects (Deletion/Creation)
        await Promise.all([
            PublicPostHandler.handlePossibleStateChange(targetId, newStatus, context, contentItem),
            FlairWatchHandler.handlePossibleStateChange(targetId, newStatus, context, contentItem),
            ModQueueHandler.handlePossibleStateChange(targetId, newStatus, context, contentItem)
        ]);

        // Loop and update all standard logs
        const syncableChannels = [
            ChannelType.NewPosts,
            ChannelType.Removals,
            ChannelType.Reports,
            ChannelType.FlairWatch,
            ChannelType.ModActivity
        ];
        let successValue = true;
        for (const entry of logEntries) {
            // Skip if the Discord message is already in the correct state
            if (entry.currentStatus === newStatus) continue;

            if (syncableChannels.includes(entry.channelType)) {
                const payload = await ComponentManager.createDefaultMessage(
                    contentData, 
                    newStatus, 
                    entry.channelType, 
                    context
                );

                const success = await WebhookManager.editMessage(entry.webhookUrl, entry.discordMessageId, payload);
                if(success){
                    await StorageManager.updateLogStatus(entry.discordMessageId, newStatus, context);
                } else {
                    successValue = false;
                    break;
                }
                
            }
        }
        return successValue;
    }
}