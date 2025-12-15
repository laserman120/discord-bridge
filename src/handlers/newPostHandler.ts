import { Devvit, Post, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { ContentDataManager, ContentDetails } from '../managers/contentDataManager.js';

export class NewPostHandler {
    static async handle(event: any, context: TriggerContext): Promise<void> {
        const postId = event.id;

        if (!postId) {
            console.log(`[NewPostHandler] No post ID found in event.`)
            return;
        }

        const webhookUrl = await context.settings.get('WEBHOOK_NEW_POSTS') as string | undefined;

        if (!webhookUrl) {
            return;
        }

        const existingLogs = await StorageManager.getLinkedLogEntries(postId, context as any);

        const alreadyPosted = existingLogs.some(
            entry => entry.channelType === ChannelType.NewPosts
        );

        if (alreadyPosted) {
            console.log(`[NewPostHandler] Skipped ${postId}: Already sent to New Posts channel.`);
            return;
        }

        let contentItem: Post;
        try {
            contentItem = await context.reddit.getPostById(postId);
        } catch (error) {
            console.error(`[NewPostHandler] Failed to fetch full post ${postId}:`, error);
            return;
        }

        let crosspostItem: Post | undefined;
        if (event.crosspostParentId)
        {
            console.log(`[NewPostHandler] Post ${postId} is a crosspost, fetching parent post ${event.crosspostParentId}`)
            try {
                crosspostItem = await context.reddit.getPostById(event.crosspostParentId)
            } catch (error) {
                console.error(`[NewPostHandler] Failed to fetch full post ${postId}:`, error);
                return;
            }
        }
        

        console.log(`[NewPostHandler] Processing new post: ${contentItem.title}`, contentItem.toJSON());

        let status = ItemState.Live;
        if (contentItem.isApproved()) {
            status = ItemState.Approved;
        }

        const contentData = await ContentDataManager.gatherDetails(contentItem, context, crosspostItem);

        const payload = await EmbedManager.createDefaultEmbed(contentData, status, ChannelType.NewPosts, context);

        const discordMessageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context as any);

        if (discordMessageId && !discordMessageId.startsWith('failed_id')) {
            await StorageManager.createLogEntry({
                redditId: postId,
                discordMessageId: discordMessageId,
                channelType: ChannelType.NewPosts,
                currentStatus: status,
                webhookUrl: webhookUrl
            }, context as any);
        }
    }
}