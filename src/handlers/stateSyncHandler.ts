import { TriggerContext, Post, Comment } from '@devvit/public-api';
import { ItemState, ChannelType } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { UtilityManager } from '../managers/utilityManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { ContentDataManager, ContentDetails } from '../managers/contentDataManager.js';
import { PublicPostHandler } from '../handlers/publicPostHandler.js';
import { ComponentManager } from '../managers/componentManager.js';
import { FlairWatchHandler } from '../handlers/flairWatchHandler.js';
import { ModQueueHandler } from '../handlers/modQueueHandler.js';

export class StateSyncHandler {
    static async handleModAction(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        const safeEvent = event as any;

        const targetId = safeEvent.targetPost?.id || safeEvent.targetComment?.id || safeEvent.targetId;

        if (!targetId) return;

        const actionString = safeEvent.action;
        let newStatus = UtilityManager.getStateFromModAction(actionString);

        if (!newStatus) {
            return;
        }

        console.log(`[StateSync] Action '${actionString}' detected on ${targetId}. New State: ${newStatus}`);

        const logEntries = await StorageManager.getLinkedLogEntries(targetId, context);

        if (logEntries.length === 0) {
            console.log(`[StateSync] No tracked messages found for ${targetId}. Skipping update.`);
            return;
        }

        let contentItem;
        if (preFetchedContent) {
            contentItem = preFetchedContent;
        } else {
            try {
                console.warn(`[StateSync] No pre-fetched data found, running manual fetch for ${targetId}`);
                if (typeof targetId === 'string' && targetId.startsWith('t3_')) {
                    contentItem = await context.reddit.getPostById(targetId);
                } else if (typeof targetId === 'string' && targetId.startsWith('t1_')) {
                    contentItem = await context.reddit.getCommentById(targetId);
                }
            } catch (error) {
                console.error(`[StateSync] Failed to fetch content ${targetId} for update: ${error}`);
                return;
            }
        }
        

        if (!contentItem) return;

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);

        if (newStatus == ItemState.Removed) {
            let automatedRemovalUsers = await context.settings.get('AUTOMATIC_REMOVALS_USERS') as string[] || [];
            if (automatedRemovalUsers.includes(contentData.removedBy?.toLowerCase() || '')) {
                newStatus = ItemState.Awaiting_Review;
            }
        }

        await PublicPostHandler.handlePossibleStateChange(targetId, newStatus, context, contentItem);
        await FlairWatchHandler.handlePossibleStateChange(targetId, newStatus, context, contentItem);
        await ModQueueHandler.handlePossibleStateChange(targetId, newStatus, context, contentItem);

        for (const entry of logEntries) {

            if (entry.currentStatus === newStatus) {
                console.log(`[StateSync] Msg ${entry.discordMessageId} already in state ${newStatus}. Skipping.`);
                continue;
            }

            let payload;
            switch (entry.channelType) {
                case ChannelType.NewPosts:
                    payload = await ComponentManager.createDefaultMessage(contentData, newStatus, entry.channelType, context);
                    //payload = await EmbedManager.createDefaultEmbed(contentData, newStatus, entry.channelType, context);
                    break;
                case ChannelType.Removals:
                    payload = await ComponentManager.createDefaultMessage(contentData, newStatus, entry.channelType, context);
                    //payload = await EmbedManager.createDefaultEmbed(contentData, newStatus, entry.channelType, context);
                    break;
                case ChannelType.Reports:
                    payload = await ComponentManager.createDefaultMessage(contentData, newStatus, entry.channelType, context);
                    //payload = await EmbedManager.createDefaultEmbed(contentData, newStatus, entry.channelType, context);
                    break;
                case ChannelType.FlairWatch:
                    payload = await ComponentManager.createDefaultMessage(contentData, newStatus, entry.channelType, context);
                    //payload = await EmbedManager.createDefaultEmbed(contentData, newStatus, entry.channelType, context);
                    break;
                case ChannelType.ModActivity:
                    payload = await ComponentManager.createDefaultMessage(contentData, newStatus, entry.channelType, context);
                    //payload = await EmbedManager.createDefaultEmbed(contentData, newStatus, entry.channelType, context);
                    break;
                default:
                    continue;
            }

            await WebhookManager.editMessage(
                entry.webhookUrl,
                entry.discordMessageId, 
                payload
            );

            await StorageManager.updateLogStatus(entry.discordMessageId, newStatus, context);
        }
    }
}