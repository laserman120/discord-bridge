import { Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { ComponentManager } from '../managers/componentManager.js';
import { UtilityManager } from '../helpers/utilityHelper.js';

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
    static async handle(triggerPost: { id: string }, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<boolean> {
        const targetId = triggerPost.id;
        if (!targetId) {
            UtilityManager.log('[ReportHandler] Exit: No targetId provided in payload.');
            return true;
        }

        // Resolve Content and Stats
        const contentItem = await this.fetchContent(targetId, context, preFetchedContent);
        if (!contentItem) {
            UtilityManager.log(`[ReportHandler] Exit: Could not fetch content for ${targetId}.`);
            return true;
        }

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);
        
        if(contentData.authorName === '[deleted]') {
            UtilityManager.log(`[ReportHandler] Exit: Content ${targetId} is authored by [deleted]. Skipping report handling.`)
            return true;
        }

        if (!contentData.reportCount || contentData.reportCount <= 0) {
            UtilityManager.log(`[ReportHandler] Exit: Content ${targetId} Has no reports.`)
            return true;
        }

        const logEntries = await StorageManager.getLinkedLogEntries(targetId, context);
        const status = ItemState.Unhandled_Report;

        await this.handleReportsChannel(targetId, contentData, status, logEntries, context);

        const syncableChannels = [
            ChannelType.NewPosts,
            ChannelType.Removals,
            ChannelType.FlairWatch,
            ChannelType.ModActivity
        ];

        UtilityManager.log(`[ReportHandler] Broadcasting report count (${contentData.reportCount}) to ${logEntries.length} logs.`);

        for (const entry of logEntries) {
            if (syncableChannels.includes(entry.channelType)) {
                const payload = await ComponentManager.createDefaultMessage(
                    contentData, 
                    status, 
                    entry.channelType, 
                    context
                );

                const success = await WebhookManager.editMessage(entry.webhookUrl, entry.discordMessageId, payload);
            }
        }
        return true;
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
        } else {
            UtilityManager.log(`[ReportHandler] Report for ${id} already logged in Reports channel. Skipping creation.`);
        }
    }
}