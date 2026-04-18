import { Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { UtilityManager } from '../helpers/utilityHelper.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { isAdminAccount } from '../helpers/adminAccountHelper.js';
import { ComponentManager } from '../managers/componentManager.js';

/**
 * Handles moderator removal actions (remove/spam).
 * Routes notifications to the removals channel with logic to identify 
 * automated vs. manual moderator actions.
 */
export class RemovalHandler extends BaseHandler {
    /**
     * Entry point for removal events.
     * @param event - The ModAction event data.
     * @param context - The Devvit execution context.
     * @param preFetchedContent - Optional pre-fetched content.
     */
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        const targetId = this.getRedditId(event);
        if (!targetId) return;

        // 1. Validate State: Only process 'Removed' or 'Spam' actions
        let state = UtilityManager.getStateFromModAction(event.action);
        if (state !== ItemState.Removed && state !== ItemState.Spam) return;

        // 2. Resolve Configuration
        const webhookUrl = await context.settings.get('WEBHOOK_REMOVALS') as string | undefined;
        if (!webhookUrl) return;

        // 3. Prevent Duplicates
        if (await this.isAlreadyLogged(targetId, ChannelType.Removals, context)) {
            console.log(`[RemovalHandler] Log already exists for ${targetId}. Skipping.`);
            return;
        }

        // 4. Resolve Content and Data
        const contentItem = await this.fetchContent(targetId, context, preFetchedContent);
        if (!contentItem) return;

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);

        if(contentData.authorName === '[deleted]') {
            console.log(`[RemovalHandler] Content ${targetId} is authored by [deleted]. Skipping report handling.`)
            return;
        }

        // 5. Integrity Check: Ensure it's actually removed/spam and not approved
        if (contentItem.isApproved() || (!contentItem.isRemoved() && !contentItem.isSpam() && !contentData.removedBy)) {
            return;
        }

        // 6. Refined State Logic: Detect Automated Removals
        if (state === ItemState.Removed && await this.isAutomatedRemoval(contentData.removedBy, context)) {
            state = ItemState.Awaiting_Review;
        }

        // 7. Filters: Ignore Moderator self-removals or specific authors
        if (await this.shouldSkipNotification(contentData, state, context)) return;

        // 8. Resolve Notification String
        const notificationString = await this.getNotificationString(state, contentData.removedBy, context);

        // 9. Dispatch
        const payload = await ComponentManager.createDefaultMessage(contentData, state, ChannelType.Removals, context, notificationString);
        const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context);

        if (messageId && !messageId.startsWith('failed')) {
            await StorageManager.createLogEntry({
                redditId: targetId,
                discordMessageId: messageId,
                channelType: ChannelType.Removals,
                currentStatus: state,
                webhookUrl: webhookUrl
            }, context);
        }
    }

    /**
     * Determines if the user who performed the removal is in the 'Automated' list.
     * @private
     */
    private static async isAutomatedRemoval(removedBy: string | undefined, context: TriggerContext): Promise<boolean> {
        if (!removedBy) return false;
        const autoUsers = await context.settings.get('AUTOMATIC_REMOVALS_USERS') as string[] || [];
        const customAutoStr = await context.settings.get('AUTOMATIC_REMOVALS_USERS_CUSTOM') as string || "";
        const customAutoUsers = customAutoStr.split(";").map(u => u.trim().toLowerCase()).filter(u => u.length > 0);
        
        const allAutoUsers = [...autoUsers, ...customAutoUsers];
        return allAutoUsers.includes(removedBy.toLowerCase());
    }

    /**
     * Checks multiple ignore-settings to see if we should abort the notification.
     * @private
     */
    private static async shouldSkipNotification(data: any, state: ItemState, context: TriggerContext): Promise<boolean> {
        // Filter by specific Authors
        const ignoredAuthorsList = await context.settings.get('REMOVAL_IGNORE_AUTHOR') as string || "";
        const ignoredAuthors = ignoredAuthorsList.split(";").map(u => u.trim().toLowerCase());
        if (data.authorName && ignoredAuthors.includes(data.authorName.toLowerCase())) return true;

        // Filter out manual Moderator removals if setting is enabled
        const skipModRemovals = await context.settings.get('REMOVALS_IGNORE_MODERATOR') as boolean || false;
        if (skipModRemovals && state === ItemState.Removed) return true;

        return false;
    }

    /**
     * Maps the specific removal scenario to a notification string index.
     * Index 0: Mod, 1: Auto, 2: Admin, 3: Spam
     * @private
     */
    private static async getNotificationString(state: ItemState, removedBy: string | undefined, context: TriggerContext): Promise<string | undefined> {
        const strings = await UtilityManager.getMessageFromChannelType(ChannelType.Removals, context);
        if (!strings || strings.length === 0) return undefined;

        if (state === ItemState.Awaiting_Review) return strings[1]; // Automated
        if (state === ItemState.Spam) return strings[3]; // Spam
        if (removedBy && isAdminAccount(removedBy.toLowerCase())) return strings[2]; // Admin

        return strings[0]; // Standard Mod Removal
    }
}