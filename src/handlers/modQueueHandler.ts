import { Devvit, Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { ContentDataManager, ContentDetails } from '../managers/contentDataManager.js';
import { ComponentManager } from '../managers/componentManager.js';

export class ModQueueHandler {
    static async handle(event: any, context: TriggerContext, currentQueue: (Post | Comment)[], preFetchedContent?: Post | Comment): Promise<void> {
        const targetId = event.targetPost?.id || event.targetComment?.id || event.targetId || event.id;

        const webhookUrl = await context.settings.get('WEBHOOK_MOD_QUEUE') as string | undefined;

        if (!webhookUrl) {
            return;
        }

        const existingLogs = await StorageManager.getLinkedLogEntries(targetId, context);
        const alreadyLogged = existingLogs.some(entry => entry.channelType === ChannelType.ModQueue);

        if (alreadyLogged) {
            console.log(`[ModQueueHandler] Log already exists for ${targetId}. Skipping creation.`);
            return;
        }

        console.log(`[ModQueueHandler] Checking queue for ${targetId}...`);
        let existsInQueue = false;
        for (const item of currentQueue) {
            if (item.id === targetId) {
                existsInQueue = true;
                break;
            }
        }

        if (!existsInQueue) {
            return;
        }

        let contentItem: Post | Comment;
        if (preFetchedContent) {
            contentItem = preFetchedContent;
        } else {
            try {
                console.warn(`[ModQueueHandler] No pre-fetched data found, running manual fetch for ${targetId}`);
                if (targetId.startsWith('t3_')) {
                    contentItem = await context.reddit.getPostById(targetId);
                } else {
                    contentItem = await context.reddit.getCommentById(targetId);
                }
            } catch (e) {
                console.error(`[ModQueueHandler] Failed to fetch content: ${e}`);
                return;
            }
        }

        let state = ItemState.Live;

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);

        if (contentItem.isApproved()) {
            return;
        };

        if (contentData.reportCount && contentData.reportCount > 0) {
            state = ItemState.Unhandled_Report;
        }

        if (contentItem.isRemoved() || contentItem.isSpam() || contentData.removedBy) {
            state = ItemState.Awaiting_Review;
        }

        

        console.log("[ModQueueHandler] Found new mod queue entry: " + targetId + " with state: " + state);

        //const payload = await EmbedManager.createDefaultEmbed(contentData, status, ChannelType.Reports, context);

        let notificationString;
        if (state == ItemState.Unhandled_Report) {
            notificationString = await context.settings.get('MOD_QUEUE_MESSAGE_REPORT') as string | undefined;
        } else if (state == ItemState.Awaiting_Review) {
            notificationString = await context.settings.get('MOD_QUEUE_MESSAGE_REMOVAL') as string | undefined;
        }

        const payload = await ComponentManager.createDefaultMessage(contentData, state, ChannelType.ModQueue, context, notificationString);

        const discordMessageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context as any);

        if (discordMessageId && !discordMessageId.startsWith('failed_id')) {
            await StorageManager.createLogEntry({
                redditId: targetId,
                discordMessageId: discordMessageId,
                channelType: ChannelType.ModQueue,
                currentStatus: state,
                webhookUrl: webhookUrl
            }, context as any);
        }
    }

    static async handlePossibleStateChange(itemId: string, state: ItemState, context: TriggerContext, contentItem: Post | Comment): Promise<void> {
        if (!itemId) return;

        const logEntries = await StorageManager.getLinkedLogEntries(itemId, context);

        const alreadyPosted = logEntries.some(
            entry => entry.channelType === ChannelType.ModQueue
        );

        if (context.subredditName && alreadyPosted && (state == ItemState.Removed || state == ItemState.Approved || state == ItemState.Spam || state == ItemState.Deleted)) {

            const subreddit = await context.reddit.getSubredditByName(context.subredditName);
            const currentQueue = await subreddit.getModQueue().all();

            let existsInQueue = false;
            for (const item of currentQueue) {
                if (item.id === itemId) {
                    existsInQueue = true;
                    break;
                }
            }

            if (existsInQueue) {
                return;
            }

            // remove discord message and delete from database
            for (const entry of logEntries) {
                if (entry.channelType === ChannelType.ModQueue) {
                    await WebhookManager.deleteMessage(entry.webhookUrl, entry.discordMessageId, context as any);
                    await StorageManager.deleteLogEntry(entry, context as any);
                    console.log(`[ModQueueHandler] Deleted Discord message ${entry.discordMessageId} for item ${itemId} due to state change to ${state}`);
                }
            }
        }
    }
}