import { Devvit, Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { ContentDataManager, ContentDetails } from '../managers/contentDataManager.js';

export class PublicPostHandler {
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        const postId = event.id;

        const webhookUrl = await context.settings.get('WEBHOOK_PUBLIC_NEW_POSTS') as string | undefined;

        if (!webhookUrl) {
            return;
        }

        const existingLogs = await StorageManager.getLinkedLogEntries(postId, context as any);

        const alreadyPosted = existingLogs.some(
            entry => entry.channelType === ChannelType.PublicNewPosts
        );

        if (alreadyPosted) {
            console.log(`[PublicNewPostHandler] Already found ${postId}, skipping`);
            return;
        }

        let contentItem: Post;
        if (preFetchedContent) {
            contentItem = preFetchedContent as Post;
        } else {
            try {
                console.warn(`[PublicNewPostHandler] No pre-fetched data found, running manual fetch for ${postId}`);
                contentItem = await context.reddit.getPostById(postId);
            } catch (error) {
                console.error(`[PublicNewPostHandler] Failed to fetch full post ${postId}:`, error);
                return;
            }
        }

        let crosspostItem: Post | undefined;
        if (event.crosspostParentId) {
            console.log(`[PublicNewPostHandler] Post ${postId} is a crosspost, fetching parent post ${event.crosspostParentId}`)
            try {
                crosspostItem = await context.reddit.getPostById(event.crosspostParentId)
            } catch (error) {
                console.error(`[PublicNewPostHandler] Failed to fetch full post ${postId}:`, error);
                return;
            }
        }

        console.log(`[PublicNewPostHandler] Processing new post: ${contentItem.title}`);

        const contentData = await ContentDataManager.gatherDetails(contentItem, context, crosspostItem);

        if (contentData.removalReason || contentData.removedBy) {
            console.log(`[PublicNewPostHandler] Post ${postId} appears to be removed, skipping.`);
            return;
        }

        const payload = await EmbedManager.createDefaultEmbed(contentData, ItemState.Public_Post, ChannelType.PublicNewPosts, context);

        const discordMessageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context as any);

        if (discordMessageId && !discordMessageId.startsWith('failed_id')) {
            await StorageManager.createLogEntry({
                redditId: postId,
                discordMessageId: discordMessageId,
                channelType: ChannelType.PublicNewPosts,
                currentStatus: ItemState.Public_Post,
                webhookUrl: webhookUrl
            }, context as any);
        }
    }

    static async handlePossibleStateChange(postId: string, state: ItemState, context: TriggerContext, contentItem: Post | Comment): Promise<void> {
        if (!postId) return;

        const logEntries = await StorageManager.getLinkedLogEntries(postId, context);

        const alreadyPosted = logEntries.some(
            entry => entry.channelType === ChannelType.PublicNewPosts
        );

        if (alreadyPosted && (state == ItemState.Removed || state == ItemState.Awaiting_Review || state == ItemState.Spam || state == ItemState.Deleted))
        {
            // remove discord message and delete from database
            for (const entry of logEntries)
            {
                if (entry.channelType === ChannelType.PublicNewPosts)
                {
                    await WebhookManager.deleteMessage(entry.webhookUrl, entry.discordMessageId, context as any);
                    await StorageManager.deleteLogEntry(entry, context as any);
                    console.log(`[PublicNewPostHandler] Deleted Discord message ${entry.discordMessageId} for post ${postId} due to state change to ${state}`);
                }
            }
        }
        else if (!alreadyPosted && (state == ItemState.Live || state == ItemState.Approved))
        {
            PublicPostHandler.handle({ id: postId }, context, contentItem);
        }
    }
}