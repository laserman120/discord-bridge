import { Devvit, Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { ContentDataManager, ContentDetails } from '../managers/contentDataManager.js';
import { PublicPostHandler } from '../handlers/publicPostHandler.js';
import { FlairWatchHandler } from '../handlers/flairWatchHandler.js';
import { ComponentManager } from '../managers/componentManager.js';
import { ModQueueHandler } from '../handlers/modQueueHandler.js';
import { BaseHandler } from './baseHandler.js';


export class DeletionHandler extends BaseHandler {
    /**
     * Processes deletion events and updates linked Discord messages.
     * @param event - The PostDelete or CommentDelete event data.
     * @param context - The Devvit execution context.
     * @param preFetchedContent - Optional pre-fetched content from the QueueManager.
     */
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {

        const targetId = this.getRedditId(event);
        if (!targetId) return;

        const logEntries = await StorageManager.getLinkedLogEntries(targetId, context);
        if (logEntries.length === 0) {
            console.log(`[DeletionHandler] No tracked messages for ${targetId}. Skipping.`);
            return;
        }
        
        const contentItem = await this.fetchContent(targetId, context, preFetchedContent);
        if (!contentItem) return;

        const isPost = targetId.startsWith('t3_');
        const isActuallyDeleted = isPost 
            ? (contentItem as Post).removedByCategory === 'deleted'
            : (contentItem as Comment).authorName === '[deleted]';

        if (!isActuallyDeleted) return;

        console.log("[DeletionHandler] Post/Comment was deleted. Updating entries...");

        await Promise.all([
            PublicPostHandler.handlePossibleStateChange(targetId, ItemState.Deleted, context, contentItem),
            FlairWatchHandler.handlePossibleStateChange(targetId, ItemState.Deleted, context, contentItem),
            ModQueueHandler.handlePossibleStateChange(targetId, ItemState.Deleted, context, contentItem)
        ]);

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);

        for (const entry of logEntries) {
            if (entry.currentStatus === ItemState.Deleted) continue;

            // Define which channels receive a 'Deleted' status update
            const syncableChannels = [
                ChannelType.NewPosts,
                ChannelType.Removals,
                ChannelType.Reports,
                ChannelType.FlairWatch,
                ChannelType.ModActivity
            ];

            if (syncableChannels.includes(entry.channelType)) {
                const payload = await ComponentManager.createDefaultMessage(
                    contentData, 
                    ItemState.Deleted, 
                    entry.channelType, 
                    context
                );

                await WebhookManager.editMessage(entry.webhookUrl, entry.discordMessageId, payload);
                await StorageManager.updateLogStatus(entry.discordMessageId, ItemState.Deleted, context);
            }
        }

    }
}