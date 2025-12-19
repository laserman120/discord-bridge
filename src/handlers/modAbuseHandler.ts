import { Devvit, TriggerContext } from '@devvit/public-api';
import { CacheManager } from '../managers/cacheManager.js';
import { WebhookManager } from '../managers/webhookManager.js';

export class ModAbuseHandler {

    static async handle(event: any, context: TriggerContext): Promise<void> {
        const moderatorName = event.moderatorName || event.moderator?.name;

        if (!moderatorName || moderatorName === 'AutoModerator' || moderatorName === 'reddit' || moderatorName === 'Anti-Evil Operations') {
            return;
        }

        const webhookUrl = await context.settings.get('WEBHOOK_MOD_ABUSE') as string | undefined;
        if (!webhookUrl) return; 

        const message = await context.settings.get('MOD_ABUSE_MESSAGE') as string || "";
        const timeframe = await context.settings.get('MOD_ABUSE_TIMEFRAME') as number || 10;
        const threshold = await context.settings.get('MOD_ABUSE_THRESHOLD') as number || 20;
        const monitoredActions = await context.settings.get('MOD_ABUSE_ACTIONS') as string[] || [];

        const targetId = event.targetPost?.id || event.targetComment?.id || event.targetUser?.id || 'subreddit';
        await CacheManager.trackModAction(moderatorName, event.action, targetId, context as any);

        if (!monitoredActions.includes(event.action)) {
            return;
        }

        const count = await CacheManager.checkModThreshold(moderatorName, timeframe, threshold, monitoredActions, context as any);

        if (count >= threshold) {
            const isCooldown = await CacheManager.isWarningOnCooldown(moderatorName, context as any);
            if (isCooldown) {
                console.log(`[ModAbuse] Threshold hit for ${moderatorName} (${count}/${threshold}), but on cooldown.`);
                return;
            }

            console.log(`[ModAbuse] TRIGGERED for ${moderatorName}: ${count} actions in ${timeframe}m.`);

            const payload = {
                content: message,
                embeds: [{
                    title: "High Activity Detected",
                    color: 0xFF0000, // Red
                    description: `Threshold: ${threshold} actions.\nLast Action: \`${event.action}\``,
                    timestamp: new Date().toISOString(),
                    fields: [
                        { name: 'Moderator', value: `u/${moderatorName}`, inline: true },
                        { name: 'Count', value: `${count}`, inline: true },
                        { name: 'Timeframe', value: `${timeframe} Minutes`, inline: true },
                    ]
                }]
            };

            await WebhookManager.sendNewMessage(webhookUrl, payload, context);

            await CacheManager.setWarningCooldown(moderatorName, context as any);
        }
    }
}