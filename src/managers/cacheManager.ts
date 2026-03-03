import { DevvitContext } from '../types/context.js';

/**
 * Manages short-term data persistence in Redis.
 * Handles content caching to save API calls and moderator action tracking for abuse detection.
 */
export class CacheManager {
    /** Time-to-live for cached post/comment data in seconds */
    private static readonly POST_CACHE_TTL = 20;

    // #region Key Generators
    private static getContentKey(id: string): string {
        return `cache:content:${id}`;
    }

    private static getModActionKey(moderatorName: string): string {
        return `cache:mod_actions:${moderatorName}`;
    }

    private static getWarningCooldownKey(moderatorName: string): string {
        return `cache:mod_warning_cooldown:${moderatorName}`;
    }
    // #endregion

    /**
     * Caches raw content data (Post or Comment) with a short expiration.
     * @param id - The Reddit ThingID.
     * @param data - The object to stringify and store.
     * @param context - The Devvit execution context.
     */
    static async cacheContent(id: string, data: any, context: DevvitContext): Promise<void> {
        try {
            await context.redis.set(this.getContentKey(id), JSON.stringify(data), {
                expiration: new Date(Date.now() + this.POST_CACHE_TTL * 1000)
            });
        } catch (e) {
            console.error(`[CacheManager] Failed to cache content ${id}:`, e);
        }
    }

    /**
     * Retrieves cached content data.
     * @returns The parsed object or null if expired/missing.
     */
    static async getCachedContent(id: string, context: DevvitContext): Promise<any | null> {
        try {
            const data = await context.redis.get(this.getContentKey(id));
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Records a moderator action in a sorted set for threshold monitoring.
     * @param moderatorName - The username of the moderator.
     * @param actionType - The string identifier of the action (e.g., 'removelink').
     * @param targetId - The ID of the item acted upon.
     * @param context - The Devvit execution context.
     */
    static async trackModAction(moderatorName: string, actionType: string, targetId: string, context: DevvitContext): Promise<void> {
        const key = this.getModActionKey(moderatorName);
        const nowUnix = Math.floor(Date.now() / 1000);
        const oneHourAgo = nowUnix - 3600;

        // Member format: timestamp:action:target to ensure uniqueness in the sorted set
        const member = `${nowUnix}:${actionType}:${targetId || 'global'}`;

        try {
            await context.redis.zAdd(key, { member: member, score: nowUnix });

            // Maintenance: Remove actions older than 1 hour to prevent memory bloat
            await context.redis.zRemRangeByScore(key, -1, oneHourAgo);
        } catch (e) {
            console.error(`[CacheManager] Failed to track mod action for ${moderatorName}:`, e);
        }
    }

    /**
     * Calculates how many monitored actions a moderator has performed within a specific window.
     * @param timeframeMinutes - The look-back window in minutes.
     * @param monitoredActions - List of action strings to count.
     * @returns The total count of relevant actions.
     */
    static async checkModThreshold(
        moderatorName: string,
        timeframeMinutes: number,
        threshold: number,
        monitoredActions: string[],
        context: DevvitContext
    ): Promise<number> {
        const key = this.getModActionKey(moderatorName);
        const nowUnix = Math.floor(Date.now() / 1000);
        const startTime = nowUnix - (timeframeMinutes * 60);

        try {
            // Retrieve all actions within the timeframe
            const actions = await context.redis.zRange(key, startTime, nowUnix, { by: 'score' });

            const relevantActions = actions.filter(item => {
                const parts = item.member.split(':');
                const actionType = parts[1];
                return monitoredActions.includes(actionType);
            });

            return relevantActions.length;
        } catch (e) {
            console.error(`[CacheManager] Threshold check failed for ${moderatorName}:`, e);
            return 0;
        }
    }

    /**
     * Checks if a moderator is currently in a "warning cooldown" period.
     */
    static async isWarningOnCooldown(moderatorName: string, context: DevvitContext): Promise<boolean> {
        const val = await context.redis.get(this.getWarningCooldownKey(moderatorName));
        return !!val;
    }

    /**
     * Sets a 15-minute cooldown to prevent multiple alerts for the same activity spike.
     */
    static async setWarningCooldown(moderatorName: string, context: DevvitContext): Promise<void> {
        await context.redis.set(this.getWarningCooldownKey(moderatorName), 'true', {
            expiration: new Date(Date.now() + 15 * 60 * 1000) 
        });
    }
}