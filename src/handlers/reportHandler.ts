import { Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { ComponentManager } from '../managers/componentManager.js';

/**
 * Handles Reddit report events. 
 * Dispatches new notifications to the Reports channel and synchronizes 
 * updated report counts to all other existing Discord logs for the same item.
 */
export class ReportHandler extends BaseHandler {
    /**
     * Processes report triggers and syncs report data across Discord.
     * @param triggerPost - Object containing the Reddit ID.
     * @param context - The Devvit execution context.
     * @param preFetchedContent - Optional pre-fetched content to save API calls.
     */
    static async handle(triggerPost: { id: string }, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        const targetId = triggerPost.id;
        if (!targetId) return;

        // 1. Resolve Content and Stats
        const contentItem = await this.fetchContent(targetId, context, preFetchedContent);
        if (!contentItem) return;

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);
        
        // Safety: If there are no reports, there's nothing for this handler to do.
        if (!contentData.reportCount || contentData.reportCount <= 0) {
            return;
        }

        // 2. Load all existing logs for this item
        const logEntries = await StorageManager.getLinkedLogEntries(targetId, context);
        const status = ItemState.Unhandled_Report;

        // 3. Handle the dedicated Reports Channel
        await this.handleReportsChannel(targetId, contentData, status, logEntries, context);

        // 4. Broadcast Updates to other channels
        // We update New Posts, Removals, etc., so the report count is visible everywhere.
        const syncableChannels = [
            ChannelType.NewPosts,
            ChannelType.Removals,
            ChannelType.FlairWatch,
            ChannelType.ModActivity
        ];

        console.log(`[ReportHandler] Broadcasting report count (${contentData.reportCount}) to ${logEntries.length} logs.`);

        for (const entry of logEntries) {
            if (syncableChannels.includes(entry.channelType)) {
                const payload = await ComponentManager.createDefaultMessage(
                    contentData, 
                    status, 
                    entry.channelType, 
                    context
                );

                await WebhookManager.editMessage(entry.webhookUrl, entry.discordMessageId, payload);
            }
        }
    }

    /**
     * Specific logic for the Reports feed. Creates a new message if one doesn't exist.
     * @private
     */
    private static async handleReportsChannel(id: string, data: any, status: ItemState, logs: any[], context: TriggerContext): Promise<void> {
        const webhookUrl = await context.settings.get('WEBHOOK_REPORTS') as string | undefined;
        if (!webhookUrl) return;

        const alreadyLogged = logs.some(entry => 
            entry.channelType === ChannelType.Reports && 
            entry.currentStatus === ItemState.Unhandled_Report
        );

        if (!alreadyLogged) {
            const notificationString = await context.settings.get('REPORT_MESSAGE') as string | undefined;
            const payload = await ComponentManager.createDefaultMessage(data, status, ChannelType.Reports, context, notificationString);
            
            const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context);

            if (messageId && !messageId.startsWith('failed')) {
                await StorageManager.createLogEntry({
                    redditId: id,
                    discordMessageId: messageId,
                    channelType: ChannelType.Reports,
                    currentStatus: status,
                    webhookUrl: webhookUrl
                }, context);
            }
        }
    }
}