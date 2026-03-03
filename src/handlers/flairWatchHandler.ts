import { TriggerContext, Post, Comment } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { ComponentManager } from '../managers/componentManager.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { BaseHandler } from './baseHandler.js';


/**
 * Interface representing a single flair watch configuration rule.
 */
interface FlairConfigEntry {
    flair: string;
    post?: boolean;
    comment?: boolean;
    webhook?: string;
    publicFormat?: boolean;
}

export class FlairWatchHandler extends BaseHandler {
    /**
     * Checks content against the flair watch-list and sends notifications.
     * @param event - The event data containing the Reddit ID.
     * @param context - The Devvit execution context.
     * @param preFetchedContent - Optional pre-fetched content to save API calls.
     */
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        const targetId = this.getRedditId(event);
        if (!targetId || !context.subredditName) return;

        // 1. Fetch Configuration
        const configString = await context.settings.get('FLAIR_WATCH_CONFIG') as string;
        if (!configString) return;

        // 2. Prevent Duplicate Notifications
        // We check for both internal and public flair watch channels
        const existingLogs = await StorageManager.getLinkedLogEntries(targetId, context);
        const alreadyPosted = existingLogs.some(
            entry => entry.channelType === ChannelType.FlairWatch || entry.channelType === ChannelType.PublicFlairWatch
        );

        if (alreadyPosted) {
            console.log(`[FlairWatchHandler] Already logged ${targetId}, skipping.`);
            return;
        }

        // 3. Resolve Content and Watch-list
        let watchList: FlairConfigEntry[] = [];
        try {
            watchList = JSON.parse(configString);
        } catch (e) {
            console.error('[FlairWatchHandler] Config JSON parse error:', e);
            return;
        }

        const contentItem = await this.fetchContent(targetId, context, preFetchedContent);
        if (!contentItem) return;

        // 4. Extract Flairs for comparison
        const isPost = targetId.startsWith('t3_');
        const postFlair = isPost ? (contentItem as Post).flair?.text : null;

        const author = await contentItem.getAuthor();
        const authorFlairData = await author?.getUserFlairBySubreddit(context.subredditName);
        const authorFlair = authorFlairData?.flairText;

        // 5. Evaluate Watch-list Rules
        for (const entry of watchList) {
            const hasMatchingFlair = (authorFlair?.includes(entry.flair)) || (postFlair?.includes(entry.flair));
            
            if (hasMatchingFlair) {
                // Rule: Ensure the item type (post vs comment) is enabled for this flair
                if (isPost && !entry.post) continue;
                if (!isPost && !entry.comment) continue;

                const webhookUrl = entry.webhook;
                if (!webhookUrl) continue;

                console.log(`[FlairWatchHandler] Match: '${entry.flair}' found on ${targetId}`);

                const details = await ContentDataManager.gatherDetails(contentItem, context, event);

                // Determine context: 'Public' rules use different colors/channels
                const state = entry.publicFormat ? ItemState.Public_Post : ItemState.Live;
                const channelType = entry.publicFormat ? ChannelType.PublicFlairWatch : ChannelType.FlairWatch;

                const payload = await ComponentManager.createDefaultMessage(details, state, channelType, context);
                const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context);

                if (messageId && !messageId.startsWith('failed')) {
                    await StorageManager.createLogEntry({
                        redditId: targetId,
                        discordMessageId: messageId,
                        channelType: channelType,
                        currentStatus: state,
                        webhookUrl: webhookUrl
                    }, context as any);
                }
            }
        }
    }

    /**
     * Synchronizes public flair watch messages when the Reddit item state changes.
     * If the item becomes 'Live', it re-triggers the handler to check for new watch rules.
     */
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