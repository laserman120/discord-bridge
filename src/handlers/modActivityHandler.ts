import { Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { ComponentManager } from '../managers/componentManager.js';

/**
 * Monitors and logs activity (posts and comments) from subreddit moderators.
 * Useful for transparency or tracking official announcements in Discord.
 */
export class ModActivityHandler extends BaseHandler {
    /**
     * Handles moderator posts/comments and bridges them to the Mod Activity channel.
     * @param event - The trigger event containing the content ID.
     * @param context - The Devvit execution context.
     * @param preFetchedContent - Content already fetched by the QueueManager.
     */
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        const targetId = this.getRedditId(event);
        if (!targetId || !context.subredditName) return;

        // 1. Resolve Settings
        const webhookUrl = await context.settings.get('MOD_ACTIVITY_WEBHOOK') as string | undefined;
        if (!webhookUrl) return;

        const checkPosts = await context.settings.get('MOD_ACTIVITY_CHECK_POSTS') as boolean ?? true;
        const checkComments = await context.settings.get('MOD_ACTIVITY_CHECK_COMMENTS') as boolean ?? true;

        const isPost = targetId.startsWith('t3_');
        if ((isPost && !checkPosts) || (!isPost && !checkComments)) return;

        // 2. Prevent Duplicate bridge notifications
        if (await this.isAlreadyLogged(targetId, ChannelType.ModActivity, context)) {
            console.log(`[ModActivityHandler] Item ${targetId} already logged, skipping.`);
            return;
        }

        // 3. Content Resolution
        const contentItem = await this.fetchContent(targetId, context, preFetchedContent);
        if (!contentItem) return;

        // 4. Mod Status Verification
        // We defer this check until after the "Already Logged" check to save an API call.
        const isMod = await this.verifyAuthorIsMod(contentItem, context);
        if (!isMod) return;

        console.log(`[ModActivityHandler] Validated mod activity for u/${contentItem.authorName}`);

        // 5. Build Payload & Dispatch
        const details = await ContentDataManager.gatherDetails(contentItem, context, event);
        const customMessage = await context.settings.get('MOD_ACTIVITY_MESSAGE') as string | undefined;

        const payload = await ComponentManager.createDefaultMessage(
            details, 
            ItemState.Live, 
            ChannelType.ModActivity, 
            context, 
            customMessage
        );

        const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context);

        if (messageId && !messageId.startsWith('failed')) {
            await StorageManager.createLogEntry({
                redditId: targetId,
                discordMessageId: messageId,
                channelType: ChannelType.ModActivity,
                currentStatus: ItemState.Live,
                webhookUrl: webhookUrl
            }, context);
        }
    }

    /**
     * Checks if the author of the provided content is a moderator of the current subreddit.
     * @private
     */
    private static async verifyAuthorIsMod(item: Post | Comment, context: TriggerContext): Promise<boolean> {
        try {
            const author = await item.getAuthor();
            if (!author || !context.subredditName) return false;

            const mods = await context.reddit.getModerators({ 
                subredditName: context.subredditName, 
                username: author.username 
            }).all();
            
            return mods.length > 0;
        } catch (e) {
            console.error(`[ModActivityHandler] Failed to verify mod status for ${item.authorName}:`, e);
            return false;
        }
    }
}