import { Devvit, TriggerContext } from '@devvit/public-api';
import { CacheManager } from '../managers/cacheManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { BaseHandler } from './baseHandler.js';
import { UtilityManager } from '../helpers/utilityHelper.js';

export class ModAbuseHandler extends BaseHandler {
    /**
     * Tracks moderator actions in Redis and triggers a Discord alert if thresholds are met.
     * @param event - The ModAction event data.
     * @param context - The Devvit execution context.
     */
    static async handle(event: any, context: TriggerContext): Promise<boolean> {
        // Resolve Moderator Identity
        const moderatorName = event.moderatorName || event.moderator?.name;

        // Ignore system accounts and automated actions
        const systemAccounts = ['AutoModerator', 'reddit', 'Anti-Evil Operations'];
        if (!moderatorName || systemAccounts.includes(moderatorName)) {
            return true;
        }

        // Load Configuration Settings
        const webhookUrl = await context.settings.get('WEBHOOK_MOD_ABUSE') as string | undefined;
        if (!webhookUrl) return true; 

        const alertMessage = await context.settings.get('MOD_ABUSE_MESSAGE') as string || "";
        const timeframeMins = await context.settings.get('MOD_ABUSE_TIMEFRAME') as number || 10;
        const thresholdLimit = await context.settings.get('MOD_ABUSE_THRESHOLD') as number || 20;
        const monitoredActions = await context.settings.get('MOD_ABUSE_ACTIONS') as string[] || [];

        // Log the action in the cache
        // We use BaseHandler.getRedditId to identify WHAT was acted upon (post, comment, or user)
        const targetId = this.getRedditId(event) || 'subreddit';
        await CacheManager.trackModAction(moderatorName, event.action, targetId, context);

        // Threshold Evaluation
        if (!monitoredActions.includes(event.action)) return true;

        const actionCount = await CacheManager.checkModThreshold(
            moderatorName, 
            timeframeMins, 
            thresholdLimit, 
            monitoredActions, 
            context as any
        );

        if (actionCount >= thresholdLimit) {
            // Cooldown Check to prevent Discord spamming
            const isCooldown = await CacheManager.isWarningOnCooldown(moderatorName, context);
            if (isCooldown) {
                UtilityManager.log(`[ModAbuse] ${moderatorName} hit threshold (${actionCount}), but alert is on cooldown.`)
                return true;
            }

            UtilityManager.log(`[ModAbuse] Alert triggered for ${moderatorName}: ${actionCount} actions in ${timeframeMins}m.`);
            // Build and Send Discord Notification
            const payload = {
                content: alertMessage,
                embeds: [{
                    title: "⚠️ High Activity Detected",
                    color: 0xFF0000, // Red
                    description: `Threshold of **${thresholdLimit}** actions reached.\nLast Action: \`${event.action}\``,
                    timestamp: new Date().toISOString(),
                    fields: [
                        { name: 'Moderator', value: `u/${moderatorName}`, inline: true },
                        { name: 'Count', value: `${actionCount}`, inline: true },
                        { name: 'Timeframe', value: `${timeframeMins} Minutes`, inline: true },
                    ]
                }]
            };

            const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context);
            if (messageId && !messageId.startsWith('failed'))
            {
                // Set cooldown to prevent repeated alerts for the same burst
                await CacheManager.setWarningCooldown(moderatorName, context);
                return true;
            } else {
                return false;
            }
            
            
        }
        return true;
    }
}