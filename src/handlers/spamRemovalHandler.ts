import { Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState, TranslationKey } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ComponentManager } from '../managers/componentManager.js';
import { UtilityManager } from '../helpers/utilityHelper.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { TranslationHelper } from '../helpers/translationHelper.js';

/**
 * Handles items flagged as Spam or silently removed by Reddit's internal filters.
 * Routes these notifications to the Removals channel with specific "Reddit Filter" attribution.
 */
export class SpamRemovalHandler extends BaseHandler {
    /**
     * Processes spam triggers and dispatches Discord notifications.
     * @param event - The event data containing the target ID.
     * @param context - The Devvit execution context.
     * @param preFetchedContent - Optional pre-fetched content to save API calls.
     */
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<boolean> {
        const targetId = this.getRedditId(event);
        if (!targetId) return true;

        // Resolve Configuration
        const webhookUrl = await context.settings.get('WEBHOOK_REMOVALS') as string | undefined;
        if (!webhookUrl) return true;

        // Prevent Duplicate Logging
        if (await this.isAlreadyLogged(targetId, ChannelType.Removals, context)) {
            UtilityManager.log(`[SpamRemovalHandler] Item ${targetId} already logged in removals. Skipping.`);
            return true;
        }

        // Resolve Content
        const contentItem = await this.fetchContent(targetId, context, preFetchedContent);
        if (!contentItem) return true;

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);
        
        if(contentData.authorName === '[deleted]') {
            UtilityManager.log(`[SpamRemovalHandler] Content ${targetId} is authored by [deleted]. Skipping spam removal handling.`)
            return true;
        }

        // Fallback attribution for silent removals
        if (!contentData.removedBy) {
            contentData.removedBy = await TranslationHelper.t(TranslationKey.TEXT_REMOVED_SILENTLY_BY_REDDIT, context);
            contentData.removalReason = contentData.removalReason || await TranslationHelper.t(TranslationKey.TEXT_REMOVED_SILENTLY_BY_REDDIT_REASON, context);
        }

        // Ignore Author Filter
        if (await this.isAuthorIgnored(contentData.authorName, context)) {
            return true;
        }

        // Resolve Notification String (Index 3 is reserved for Spam)
        const notificationStrings = await UtilityManager.getMessageFromChannelType(ChannelType.Removals, context);
        const notificationString = (notificationStrings && notificationStrings.length > 3) 
            ? notificationStrings[3] 
            : undefined;

        UtilityManager.log(`[SpamRemovalHandler] Dispatching spam notification for ${targetId}`);

        // Build and Send
        const payload = await ComponentManager.createDefaultMessage(
            contentData,
            ItemState.Spam,
            ChannelType.Removals,
            context,
            notificationString
        );

        const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context);

        if (messageId && !messageId.startsWith('failed')) {
            await StorageManager.createLogEntry({
                redditId: targetId,
                discordMessageId: messageId,
                channelType: ChannelType.Removals,
                currentStatus: ItemState.Spam,
                webhookUrl: webhookUrl
            }, context);
            return true;
        } else {
            return false;
        }

    }

    /**
     * Checks if the content author should be ignored based on subreddit settings.
     * @private
     */
    private static async isAuthorIgnored(authorName: string | undefined, context: TriggerContext): Promise<boolean> {
        if (!authorName) return false;
        const ignoredList = await context.settings.get('REMOVAL_IGNORE_AUTHOR') as string || "";
        const ignoredAuthors = ignoredList.split(";").map(u => u.trim().toLowerCase()).filter(u => u.length > 0);
        return ignoredAuthors.includes(authorName.toLowerCase());
    }
}