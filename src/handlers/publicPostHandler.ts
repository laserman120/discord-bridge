import { Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { ComponentManager } from '../managers/componentManager.js';

/**
 * Handles mirroring public posts to a dedicated Discord channel.
 * Includes logic to auto-delete Discord messages if the post is removed on Reddit.
 */
export class PublicPostHandler extends BaseHandler {
    /**
     * Bridges a post to the public Discord channel if it hasn't been posted yet
     * and isn't currently removed.
     * @param event - The event data containing the post ID.
     * @param context - The Devvit execution context.
     * @param preFetchedContent - Optional pre-fetched post data.
     */
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        const postId = this.getRedditId(event);
        if (!postId) return;

        // 1. Resolve Settings
        const webhookUrl = await context.settings.get('WEBHOOK_PUBLIC_NEW_POSTS') as string | undefined;
        if (!webhookUrl) return;

        // 2. Duplicate Check
        if (await this.isAlreadyLogged(postId, ChannelType.PublicNewPosts, context)) {
            console.log(`[PublicPostHandler] Already mirrored ${postId}, skipping.`);
            return;
        }

        // 3. Resolve Content
        const contentItem = await this.fetchContent(postId, context, preFetchedContent);
        if (!contentItem || !(contentItem instanceof Post)) return;

        // 4. Pre-Publication Verification
        // We gather details to check if the post was already removed by filters/mods before we mirror it.
        const contentData = await ContentDataManager.gatherDetails(contentItem, context, event);
        if (contentData.removalReason || contentData.removedBy) {
            console.log(`[PublicPostHandler] Post ${postId} is removed/spam. Aborting mirror.`);
            return;
        }

        console.log(`[PublicPostHandler] Mirroring post: ${contentItem.title}`);

        // 5. Build and Send
        const notificationString = await context.settings.get('NEW_PUBLIC_POST_MESSAGE') as string | undefined;
        const payload = await ComponentManager.createDefaultMessage(
            contentData, 
            ItemState.Public_Post, 
            ChannelType.PublicNewPosts, 
            context, 
            notificationString
        );

        const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context);

        if (messageId && !messageId.startsWith('failed')) {
            await StorageManager.createLogEntry({
                redditId: postId,
                discordMessageId: messageId,
                channelType: ChannelType.PublicNewPosts,
                currentStatus: ItemState.Public_Post,
                webhookUrl: webhookUrl
            }, context);
        }
    }

    /**
     * Watches for state changes (Removal, Approval) to keep the Discord mirror in sync.
     * Logic: If a post is removed/deleted, delete the Discord message. 
     * If a previously removed post is approved, mirror it.
     */
    static async handlePossibleStateChange(postId: string, state: ItemState, context: TriggerContext, contentItem: Post | Comment): Promise<void> {
        if (!postId || postId.startsWith('t1_')) return; // Mirrors only support posts

        const logEntries = await StorageManager.getLinkedLogEntries(postId, context);
        const publicLog = logEntries.find(entry => entry.channelType === ChannelType.PublicNewPosts);

        // Scenario A: Post is mirrored but now needs to be deleted (Removed/Spam/Deleted)
        const needsDeletion = [
            ItemState.Removed, 
            ItemState.Awaiting_Review, 
            ItemState.Spam, 
            ItemState.Deleted
        ].includes(state);

        if (publicLog && needsDeletion) {
            await WebhookManager.deleteMessage(publicLog.webhookUrl, publicLog.discordMessageId, context);
            await StorageManager.deleteLogEntry(publicLog, context);
            console.log(`[PublicPostHandler] Deleted mirror for ${postId} due to state: ${state}`);
        } 
        
        // Scenario B: Post isn't mirrored but just became visible (Live/Approved)
        else if (!publicLog && (state === ItemState.Live || state === ItemState.Approved)) {
            await this.handle({ id: postId }, context, contentItem);
        }
    }
}