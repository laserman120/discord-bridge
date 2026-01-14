import { Devvit, TriggerContext, Post, Comment } from '@devvit/public-api';
import { ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { ContentDataManager, ContentDetails } from '../managers/contentDataManager.js';

export class RemovalReasonHandler {
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        const actionString = event.action;

        if (actionString !== 'addremovalreason') {
            return;
        }

        const targetId = event.targetPost?.id || event.targetComment?.id || event.targetId;

        if (!targetId) return;

        const logEntries = await StorageManager.getLinkedLogEntries(targetId, context);

        if (logEntries.length === 0) {
            console.log(`[RemovalReasonHandler] No tracked messages found for ${targetId}.`);
            return;
        }

        let contentItem;
        if (preFetchedContent) {
            contentItem = preFetchedContent;
        } else {
            try {
                console.warn(`[RemovalReasonHandler] No pre-fetched data found, running manual fetch for ${targetId}`);
                if (typeof targetId === 'string' && targetId.startsWith('t3_')) {
                    contentItem = await context.reddit.getPostById(targetId);
                } else if (typeof targetId === 'string' && targetId.startsWith('t1_')) {
                    contentItem = await context.reddit.getCommentById(targetId);
                }
            } catch (error) {
                console.error(`[RemovalReasonHandler] Failed to fetch content: ${error}`);
                return;
            }
        }

        if (!contentItem) return;

        if (!context.subredditName) return;

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);

        if (!contentData.removalReason) {
            return;
        }

        for (const entry of logEntries) {
            let state;

            const automatedRemovalUsers = await context.settings.get('AUTOMATIC_REMOVALS_USERS') as string[] || [];
            if (automatedRemovalUsers.includes(contentData.removedBy || '')) {
                state = ItemState.Awaiting_Review;
            } else {
                state = ItemState.Removed;
            }

            const payload = await EmbedManager.createDefaultEmbed(contentData, state, entry.channelType, context);

            await WebhookManager.editMessage(
                entry.webhookUrl,
                entry.discordMessageId,
                payload
            );

            if (entry.currentStatus !== ItemState.Removed) {
                await StorageManager.updateLogStatus(entry.discordMessageId, ItemState.Removed, context);
            }
        }
    }
}