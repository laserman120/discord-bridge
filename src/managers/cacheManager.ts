import { Devvit } from '@devvit/public-api';

export class CacheManager {

    private static POST_CACHE_TTL = 20;

    private static getContentKey(id: string): string {
        return `cache:content:${id}`;
    }

    static async cacheContent(id: string, data: any, context: Devvit.Context): Promise<void> {
        try {
            await context.redis.set(this.getContentKey(id), JSON.stringify(data), {
                expiration: new Date(Date.now() + this.POST_CACHE_TTL * 1000)
            });
        } catch (e) {
            console.error(`[CacheManager] Failed to cache content ${id}:`, e);
        }
    }

    static async getCachedContent(id: string, context: Devvit.Context): Promise<any | null> {
        try {
            const data = await context.redis.get(this.getContentKey(id));
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    private static getModActionKey(moderatorName: string): string {
        return `cache:mod_actions:${moderatorName}`;
    }

    private static getWarningCooldownKey(moderatorName: string): string {
        return `cache:mod_warning_cooldown:${moderatorName}`;
    }

    static async trackModAction(moderatorName: string, actionType: string, targetId: string, context: Devvit.Context): Promise<void> {
        const key = this.getModActionKey(moderatorName);
        const now = Math.floor(Date.now() / 1000);
        const oneHourAgo = now - 3600;

        const member = `${now}:${actionType}:${targetId || 'global'}`;

        try {
            await context.redis.zAdd(key, { member: member, score: now });

            // Clean up old actions (older than 1 hour) to keep the set small
            await context.redis.zRemRangeByScore(key, -1, oneHourAgo);
        } catch (e) {
            console.error(`[CacheManager] Failed to track mod action for ${moderatorName}:`, e);
        }
    }

    static async checkModThreshold(
        moderatorName: string,
        timeframeMinutes: number,
        threshold: number,
        monitoredActions: string[],
        context: Devvit.Context
    ): Promise<number> {
        const key = this.getModActionKey(moderatorName);
        const now = Math.floor(Date.now() / 1000);
        const startTime = now - (timeframeMinutes * 60);

        try {
            const actions = await context.redis.zRange(key, startTime.toString(), '+inf', { by: 'score' });

            const relevantActions = actions.filter(item => {
                const parts = item.member.split(':');
                const actionType = parts[1];
                return monitoredActions.includes(actionType);
            });

            return relevantActions.length;
        } catch (e) {
            console.error(`[CacheManager] Failed to check threshold for ${moderatorName}:`, e);
            return 0;
        }
    }

    static async isWarningOnCooldown(moderatorName: string, context: Devvit.Context): Promise<boolean> {
        const val = await context.redis.get(this.getWarningCooldownKey(moderatorName));
        return !!val;
    }

    static async setWarningCooldown(moderatorName: string, context: Devvit.Context): Promise<void> {
        await context.redis.set(this.getWarningCooldownKey(moderatorName), 'true', {
            expiration: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
        });
    }
}