import { TriggerContext, Post, Comment } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { ComponentManager } from '../managers/componentManager.js';
import { ContentDataManager } from '../managers/contentDataManager.js';

interface FlairConfigEntry {
    flair: string;
    post?: boolean;
    comment?: boolean;
    webhook?: string;
    publicFormat?: boolean;
}

export class FlairWatchHandler {
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        const targetId = event.id;

        if (context.subredditName === undefined) {
            return;
        }

        const configString = await context.settings.get('FLAIR_WATCH_CONFIG') as string;
        if (!configString) return;

        const existingLogs = await StorageManager.getLinkedLogEntries(targetId, context as any);

        const alreadyPosted = existingLogs.some(
            entry => entry.channelType === ChannelType.FlairWatch || entry.channelType === ChannelType.PublicFlairWatch
        );

        if (alreadyPosted) {
            console.log(`[FlairWatchHandler] Already found ${targetId}, skipping`);
            return;
        }

        let watchList: FlairConfigEntry[] = [];
        try {
            watchList = JSON.parse(configString);
        } catch (e) {
            console.error('[FlairWatchHandler] Failed to parse config JSON:', e);
            return;
        }

        const isPost = targetId.startsWith('t3_');

        let contentItem;
        if (preFetchedContent) {
            contentItem = preFetchedContent;
        } else {
            try {
                console.warn(`[FlairWatchHandler] No pre-fetched data found, running manual fetch for ${targetId}`);
                if (typeof targetId === 'string' && targetId.startsWith('t3_')) {
                    contentItem = await context.reddit.getPostById(targetId);
                } else if (typeof targetId === 'string' && targetId.startsWith('t1_')) {
                    contentItem = await context.reddit.getCommentById(targetId);
                }
            } catch (error) {
                console.error(`[FlairWatchHandler] Failed to fetch content ${targetId} for update: ${error}`);
                return;
            }
        }

        if (!contentItem) return;

        const postFlair = isPost ? (contentItem as Post).flair?.text : null;

        const user = await contentItem.getAuthor();
        const userFlair = await user?.getUserFlairBySubreddit(context.subredditName);
        const authorFlair = userFlair?.flairText;

        for (const entry of watchList) {
            if ((authorFlair?.includes(entry.flair)) || (postFlair?.includes(entry.flair))) {

                // Check if this type (post/comment) is enabled for this entry
                if (isPost && !entry.post) continue;
                if (!isPost && !entry.comment) continue;

                const webhookUrl = entry.webhook;
                if (!webhookUrl) continue;

                console.log(`[FlairWatchHandler] Match found for flair '${authorFlair}' on ${event.id}`);

                const details = await ContentDataManager.gatherDetails(contentItem, context, event);

                // Determine style: Use Public state color if requested, otherwise standard Live
                const state = entry.publicFormat ? ItemState.Public_Post : ItemState.Live;
                const channelType = entry.publicFormat ? ChannelType.PublicFlairWatch : ChannelType.FlairWatch;

                const payload = await ComponentManager.createDefaultMessage(details, state, channelType, context);

                // Send & Log
                const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context);

                if (messageId && !messageId.startsWith('failed')) {
                    await StorageManager.createLogEntry({
                        redditId: event.id,
                        discordMessageId: messageId,
                        channelType: channelType,
                        currentStatus: state,
                        webhookUrl: webhookUrl
                    }, context as any);
                }
            }
        }
    }

    static async handlePossibleStateChange(Id: string, state: ItemState, context: TriggerContext, contentItem: Post | Comment): Promise<void> {
        if (!Id) return;

        const logEntries = await StorageManager.getLinkedLogEntries(Id, context);

        const alreadyPosted = logEntries.some(
            entry => entry.channelType === ChannelType.PublicFlairWatch
        );

        if (alreadyPosted && (state == ItemState.Removed || state == ItemState.Awaiting_Review || state == ItemState.Spam || state == ItemState.Deleted)) {
            // remove discord message and delete from database
            for (const entry of logEntries) {
                if (entry.channelType === ChannelType.PublicFlairWatch) {
                    await WebhookManager.deleteMessage(entry.webhookUrl, entry.discordMessageId, context as any);
                    await StorageManager.deleteLogEntry(entry, context as any);
                    console.log(`[FlairWatchHandler] Deleted Discord message ${entry.discordMessageId} for post/comment ${Id} due to state change to ${state}`);
                }
            }
        }
        else if (!alreadyPosted && (state == ItemState.Live || state == ItemState.Approved)) {
            FlairWatchHandler.handle({ id: Id }, context, contentItem);
        }
    }
}