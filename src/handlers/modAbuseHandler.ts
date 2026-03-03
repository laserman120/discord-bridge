import { Devvit, TriggerContext } from '@devvit/public-api';
import { CacheManager } from '../managers/cacheManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { BaseHandler } from './baseHandler.js';

export class ModAbuseHandler extends BaseHandler {
    /**
     * Tracks moderator actions in Redis and triggers a Discord alert if thresholds are met.
     * @param event - The ModAction event data.
     * @param context - The Devvit execution context.
     */
    static async handle(event: any, context: TriggerContext): Promise<void> {
        // 1. Resolve Moderator Identity
        const moderatorName = event.moderatorName || event.moderator?.name;

        // Ignore system accounts and automated actions
        const systemAccounts = ['AutoModerator', 'reddit', 'Anti-Evil Operations'];
        if (!moderatorName || systemAccounts.includes(moderatorName)) {
            return;
        }

        // 2. Load Configuration Settings
        const webhookUrl = await context.settings.get('WEBHOOK_MOD_ABUSE') as string | undefined;
        if (!webhookUrl) return; 

        const alertMessage = await context.settings.get('MOD_ABUSE_MESSAGE') as string || "";
        const timeframeMins = await context.settings.get('MOD_ABUSE_TIMEFRAME') as number || 10;
        const thresholdLimit = await context.settings.get('MOD_ABUSE_THRESHOLD') as number || 20;
        const monitoredActions = await context.settings.get('MOD_ABUSE_ACTIONS') as string[] || [];

        // 3. Log the action in the cache
        // We use BaseHandler.getRedditId to identify WHAT was acted upon (post, comment, or user)
        const targetId = this.getRedditId(event) || 'subreddit';
        await CacheManager.trackModAction(moderatorName, event.action, targetId, context);

        // 4. Threshold Evaluation
        if (!monitoredActions.includes(event.action)) return;

        const actionCount = await CacheManager.checkModThreshold(
            moderatorName, 
            timeframeMins, 
            thresholdLimit, 
            monitoredActions, 
            context as any
        );

        if (actionCount >= thresholdLimit) {
            // 5. Cooldown Check to prevent Discord spamming
            const isCooldown = await CacheManager.isWarningOnCooldown(moderatorName, context);
            if (isCooldown) {
                console.log(`[ModAbuse] ${moderatorName} hit threshold (${actionCount}), but alert is on cooldown.`);
                return;
            }

            console.log(`[ModAbuse] Alert triggered for ${moderatorName}: ${actionCount} actions in ${timeframeMins}m.`);

            // 6. Build and Send Discord Notification
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

            await WebhookManager.sendNewMessage(webhookUrl, payload, context);

            // Set cooldown to prevent repeated alerts for the same burst
            await CacheManager.setWarningCooldown(moderatorName, context);
        }
    }
}