import { Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { ComponentManager } from '../managers/componentManager.js';

/**
 * Handles the initial bridging of newly submitted posts to a private Discord channel.
 * Used for moderator feeds to track submittals in real-time.
 */
export class NewPostHandler extends BaseHandler {
    /**
     * Processes a new post and sends a notification to the configured Discord webhook.
     * @param event - The PostSubmit event data.
     * @param context - The Devvit execution context.
     * @param preFetchedContent - Optional post object from the QueueManager's batch fetch.
     */
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        // 1. Resolve ID using BaseHandler
        const postId = this.getRedditId(event);
        if (!postId) return;

        // 2. Load Configuration
        const webhookUrl = await context.settings.get('WEBHOOK_NEW_POSTS') as string | undefined;
        if (!webhookUrl) return;

        // 3. Prevent Duplicate Logging
        // Uses the standardized isAlreadyLogged method from BaseHandler
        if (await this.isAlreadyLogged(postId, ChannelType.NewPosts, context)) {
            console.log(`[NewPostHandler] Post ${postId} already sent to New Posts channel. Skipping.`);
            return;
        }

        // 4. Resolve Content (respecting pre-fetched data)
        const contentItem = await this.fetchContent(postId, context, preFetchedContent);
        if (!contentItem || !(contentItem instanceof Post)) {
            return;
        }

        // 5. Determine Initial Status
        // New posts are usually 'Live', but could be 'Approved' if submitted by a mod/approved user
        let status = ItemState.Live;
        if (contentItem.isApproved()) {
            status = ItemState.Approved;
        }
        
        // 6. Data Gathering & Payload Construction
        const contentData = await ContentDataManager.gatherDetails(contentItem, context, event);
        const notificationString = await context.settings.get('NEW_POST_MESSAGE') as string | undefined;

        const payload = await ComponentManager.createDefaultMessage(
            contentData, 
            status, 
            ChannelType.NewPosts, 
            context, 
            notificationString
        );

        // 7. Dispatch to Discord & Record in Storage
        const discordMessageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context);

        if (discordMessageId && !discordMessageId.startsWith('failed')) {
            await StorageManager.createLogEntry({
                redditId: postId,
                discordMessageId: discordMessageId,
                channelType: ChannelType.NewPosts,
                currentStatus: status,
                webhookUrl: webhookUrl
            }, context);
        }
    }
}