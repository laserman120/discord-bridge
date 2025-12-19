import { Devvit, Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { UtilityManager } from '../managers/utilityManager.js';
import { ContentDataManager, ContentDetails } from '../managers/contentDataManager.js';
import { PublicPostHandler } from '../handlers/publicPostHandler.js';
import { FlairWatchHandler } from '../handlers/flairWatchHandler.js';

export class DeletionHandler {

    static async handle(event: any, context: TriggerContext): Promise<void> {

        let targetId;
        if (event.type == 'PostDelete')
        {
            targetId = event.postId;
        } else if (event.type == 'CommentDelete')
        {
            targetId = event.commentId;
        }

        if (!targetId) return;

        const logEntries = await StorageManager.getLinkedLogEntries(targetId, context);

        if (logEntries.length === 0) {
            console.log(`[DeletionHandler] No tracked messages found for ${targetId}. Skipping update.`);
            return;
        }
        
        let contentItem: any;
        let isPost = true;
        try {
            if (targetId.startsWith('t3_')) {
                contentItem = await context.reddit.getPostById(targetId);
            } else {
                contentItem = await context.reddit.getCommentById(targetId);
                isPost = false;
            }
        } catch (e) {
            console.error(`[RemovalHandler] Failed to fetch content: ${e}`);
            return;
        }

        if (!contentItem) return;

        if (isPost && contentItem.removedByCategory == 'deleted' || !isPost && contentItem.authorName == '[deleted]')
        {
            console.log("[DeletionHandler] Post/Comment was deleted. Updating entries...");

            await PublicPostHandler.handlePossibleStateChange(targetId, ItemState.Deleted, context);
            await FlairWatchHandler.handlePossibleStateChange(targetId, ItemState.Deleted, context);

            for (const entry of logEntries) {

                if (entry.currentStatus === ItemState.Deleted) {
                    console.log(`[StateSync] Msg ${entry.discordMessageId} already in state ${ItemState.Deleted}. Skipping.`);
                    continue;
                }

                const contentData = await ContentDataManager.gatherDetails(contentItem, context);

                let payload;
                switch (entry.channelType) {
                    case ChannelType.NewPosts:
                        payload = await EmbedManager.createDefaultEmbed(contentData, ItemState.Deleted, entry.channelType, context);
                        break;
                    case ChannelType.Removals:
                        payload = await EmbedManager.createDefaultEmbed(contentData, ItemState.Deleted, entry.channelType, context);
                        break;
                    case ChannelType.Reports:
                        payload = await EmbedManager.createDefaultEmbed(contentData, ItemState.Deleted, entry.channelType, context);
                        break;
                    default:
                        console.log(`[StateSync] Unknown channel type ${entry.channelType} for Msg ${entry.discordMessageId}. Skipping.`);
                        continue;
                }

                await WebhookManager.editMessage(
                    entry.webhookUrl,
                    entry.discordMessageId,
                    payload
                );

                await StorageManager.updateLogStatus(entry.discordMessageId, ItemState.Deleted, context);
            }
        }

    }
}