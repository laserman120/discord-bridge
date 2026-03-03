import { Devvit } from '@devvit/public-api';
import { ItemState, ChannelType } from '../config/enums.js';
import { DevvitContext } from '../types/context.js';

export interface LogEntry {
    redditId: string;
    discordMessageId: string;
    channelType: ChannelType;
    currentStatus: ItemState;
    webhookUrl: string;
    createdAt: string;
    unixTimestamp: number;
}

/**
 * Manages all Redis persistence logic. 
 * Uses HASH for log storage and Sorted Sets (ZSET) for indexing and chronological ordering.
 */
export class StorageManager {
    // #region Key Generators
    private static getLogKey(discordMessageId: string): string {
        return `log:d:${discordMessageId}`;
    }

    private static getIndexKey(redditId: string): string {
        return `index:r:${redditId}`;
    }

    private static getChronoIndexKey(): string {
        return `chrono:log:index`;
    }

    private static getActiveModmailIndexKey(): string {
        return `index:modmail:active`;
    }

    private static getProcessedMessagesKey(redditId: string): string {
        return `processed:messages:${redditId}`;
    }
    // #endregion

    /**
     * Creates a new log entry and updates all relevant indexes.
     */
    static async createLogEntry(entry: Omit<LogEntry, 'createdAt' | 'unixTimestamp'>, context: DevvitContext): Promise<void> {
        const { redis } = context;
        const now = new Date();
        const unixTimestamp = Math.floor(now.getTime() / 1000);

        const redisPayload: Record<string, string> = {
            redditId: entry.redditId,
            discordMessageId: entry.discordMessageId,
            channelType: entry.channelType,
            currentStatus: entry.currentStatus,
            webhookUrl: entry.webhookUrl,
            createdAt: now.toISOString(),
            unixTimestamp: unixTimestamp.toString()
        };

        await redis.hSet(this.getLogKey(entry.discordMessageId), redisPayload);
        
        // Index by Reddit ID (for finding messages linked to a post)
        await redis.zAdd(this.getIndexKey(entry.redditId), { score: 1, member: entry.discordMessageId });
        
        // Index by Time (for cleanup and "Recent" queries)
        await redis.zAdd(this.getChronoIndexKey(), { score: unixTimestamp, member: entry.discordMessageId });
    }

    /**
     * Retrieves a single log entry.
     */
    static async getLogEntry(discordMessageId: string, context: DevvitContext): Promise<LogEntry | null> {
        const record = await context.redis.hGetAll(this.getLogKey(discordMessageId));
        if (!record || Object.keys(record).length === 0) return null;

        return {
            redditId: record.redditId,
            discordMessageId: record.discordMessageId,
            channelType: record.channelType as ChannelType,
            currentStatus: record.currentStatus as ItemState,
            webhookUrl: record.webhookUrl,
            createdAt: record.createdAt,
            unixTimestamp: parseInt(record.unixTimestamp || '0', 10)
        };
    }

    /**
     * Updates the status of an existing log.
     */
    static async updateLogStatus(discordMessageId: string, newStatus: ItemState, context: DevvitContext): Promise<void> {
        await context.redis.hSet(this.getLogKey(discordMessageId), { currentStatus: newStatus });
    }

    /**
     * Deletes a log and removes it from all indexes.
     */
    static async deleteLogEntry(entry: LogEntry, context: DevvitContext): Promise<void> {
        const { redis } = context;
        await redis.del(this.getLogKey(entry.discordMessageId));
        await redis.zRem(this.getIndexKey(entry.redditId), [entry.discordMessageId]);
        await redis.zRem(this.getChronoIndexKey(), [entry.discordMessageId]);

        if (await redis.zCard(this.getIndexKey(entry.redditId)) === 0) {
            await redis.del(this.getIndexKey(entry.redditId));
        }
    }

    /**
     * Returns all full log entries associated with a specific Reddit ID.
     */
    static async getLinkedLogEntries(redditId: string, context: DevvitContext): Promise<LogEntry[]> {
        const messageIds = await context.redis.zRange(this.getIndexKey(redditId), 0, -1);
        const entries: LogEntry[] = [];

        for (const item of messageIds) {
            const entry = await this.getLogEntry(item.member, context);
            if (entry) {
                entries.push(entry);
            } else {
                await context.redis.zRem(this.getIndexKey(redditId), [item.member]);
            }
        }
        return entries;
    }

    /**
     * Fetches the most recent log entries across the entire subreddit.
     */
    static async getRecentLogEntries(limit: number, context: DevvitContext): Promise<LogEntry[]> {
        const scoreMembers = await context.redis.zRange(
            this.getChronoIndexKey(), 
            0, 
            limit - 1, 
            { by: 'rank', reverse: true } // Added by: 'rank'
        );
        const entries: LogEntry[] = [];
        
        for (const item of scoreMembers) {
            const entry = await this.getLogEntry(item.member, context);
            if (entry) entries.push(entry);
        }
        return entries;
    }


    /**
     * Finds unique Reddit IDs that have been tracked recently, filtering for Posts/Comments.
     */
    static async getRecentTrackedPostIds(limit: number, context: DevvitContext): Promise<string[]> {
        const uniqueIds = new Set<string>();
        let cursor = 0;
        const batchSize = 50;

        while (uniqueIds.size < limit) {
            const scoreMembers = await context.redis.zRange(
                this.getChronoIndexKey(), 
                0, 
                -1, 
                { 
                    by: 'rank', // Added by: 'rank'
                    reverse: true, 
                    limit: { offset: cursor, count: batchSize } 
                }
            );

            if (scoreMembers.length === 0) break;

            for (const item of scoreMembers) {
                const logEntry = await this.getLogEntry(item.member, context);
                if (logEntry && logEntry.currentStatus !== ItemState.Deleted) {
                    if (logEntry.redditId.startsWith('t3_') || logEntry.redditId.startsWith('t1_')) {
                        uniqueIds.add(logEntry.redditId);
                    }
                }
                if (uniqueIds.size >= limit) break;
            }
            cursor += batchSize;
            if (cursor > 2000) break;
        }
        return Array.from(uniqueIds);
    }

    /**
     * Returns Discord message IDs older than a certain age for cleanup.
     */
    static async getExpiredLogKeys(ageInSeconds: number, context: DevvitContext): Promise<string[]> {
        const cutoff = Math.floor(Date.now() / 1000) - ageInSeconds;
        const results = await context.redis.zRange(this.getChronoIndexKey(), '-inf', cutoff.toString(), { by: 'score' });
        return results.map(item => item.member);
    }

    /**
     * Retrieves all conversation IDs currently tracked as "Active" Modmail.
     * Used by scheduled sync jobs to check for new replies in open threads.
     */
    static async getActiveModmailIds(context: DevvitContext): Promise<string[]> {
        const results = await context.redis.zRange(
            this.getActiveModmailIndexKey(), 
            0, 
            -1, 
            { by: 'rank' } // Explicitly defined for type safety
        );
        return results.map(item => item.member);
    }

    // #region Modmail & Processed Message Tracking
    static async trackActiveModmail(id: string, context: DevvitContext) {
        await context.redis.zAdd(this.getActiveModmailIndexKey(), { score: Date.now(), member: id });
    }

    static async untrackActiveModmail(id: string, context: DevvitContext) {
        await context.redis.zRem(this.getActiveModmailIndexKey(), [id]);
    }

    static async markMessageAsProcessed(redditId: string, messageId: string, context: DevvitContext) {
        await context.redis.zAdd(this.getProcessedMessagesKey(redditId), { score: Date.now(), member: messageId });
    }

    static async getProcessedMessageIds(redditId: string, context: DevvitContext): Promise<string[]> {
        const results = await context.redis.zRange(this.getProcessedMessagesKey(redditId), 0, -1);
        return results.map(item => item.member);
    }
    // #endregion
}