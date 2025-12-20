import { Post, Comment, Context, TriggerContext, ModAction } from '@devvit/public-api';
import { UtilityManager } from './utilityManager.js';
import { CacheManager } from '../managers/cacheManager.js';

export interface ContentDetails {
    id: string;
    type: 'post' | 'comment';
    title: string;
    body: string;
    url: string;
    permalink: string;
    authorName: string;
    subredditName: string;
    createdAt: Date;
    flairText?: string;
    thumbnail?: string;
    imageUrl?: string;
    contentWarning?: string;


    // Enriched Data
    removalReason?: string;
    removedBy?: string;
    reportReasons?: string[];
    reportCount?: number;
    modNote?: string;

    // Crosspost Data
    isCrossPost: boolean;
    crossPostBody?: string;
    crossPostPermalink?: string;
    crossPostSubredditName?: string;
}

export interface ModActionDetails {
    targetType: 'content' | 'user' | 'subreddit' | 'unknown';
    targetName: string;
    targetUrl?: string;
    details?: string; 
    contentDetails?: ContentDetails;
}

interface CachedModLogData {
    reasonLog?: ModAction;
    removalLog?: ModAction;
}

export class ContentDataManager {
    static async gatherDetails(item: Post | Comment, context: TriggerContext, crosspostItem?: Post): Promise<ContentDetails> {
        const isPost = 'title' in item;

        const details: ContentDetails = {
            id: item.id,
            type: isPost ? 'post' : 'comment',
            title: isPost ? (item as Post).title : `Comment by ${item.authorName}`,
            body: item.body || '',
            url: isPost ? (item as Post).url : '',
            permalink: `https://reddit.com${item.permalink}`,
            authorName: item.authorName || '[Deleted]',
            subredditName: item.subredditName,
            createdAt: item.createdAt,
            flairText: isPost ? (item as Post).flair?.text : undefined,
            thumbnail: isPost ? (item as Post).thumbnail?.url : undefined,
            imageUrl: undefined,
            removedBy: undefined,
            removalReason: undefined,
            reportReasons: undefined,
            crossPostBody: crosspostItem ? crosspostItem.body : undefined,
            crossPostPermalink: crosspostItem ? `https://reddit.com${crosspostItem.permalink}` : undefined,
            crossPostSubredditName: crosspostItem ? crosspostItem.subredditName : undefined,
            isCrossPost: !!crosspostItem,

        };

        if (isPost) {
            details.imageUrl = await UtilityManager.getBestImageUrl(item);

            if (item.isNsfw()) {
                details.contentWarning = "NSFW"
            } else if (item.isSpoiler()) {
                details.contentWarning = "Spoilers"
            }
        }

        if (item.userReportReasons && item.userReportReasons.length > 0) {
            details.reportReasons = item.userReportReasons;
        } else if (item.modReportReasons && item.modReportReasons.length > 0) {
            details.reportReasons = item.modReportReasons;
        }

        if (isPost && item.numberOfReports && item.numberOfReports > 0)
        {
            details.reportCount = item.numberOfReports;
        }
        else if (!isPost && item.numReports && item.numReports > 0)
        {
            details.reportCount = item.numReports;
        }

        if (item.isRemoved() || item.isSpam() || isPost && item.removedByCategory || !isPost) {

            const cachedModLogs = await CacheManager.getCachedContent(`modlog:${details.id}`, context as any) as CachedModLogData | null;

            let reasonLog = cachedModLogs?.reasonLog;
            let removalLog = cachedModLogs?.removalLog;
            let cacheMiss = false;

            if (!reasonLog && !removalLog) {
                cacheMiss = true;
                try {
                    const modLogEntries = await context.reddit.getModerationLog({
                        subredditName: item.subredditName,
                        type: 'addremovalreason',
                        limit: 10,
                        more: {
                            parentId: item.id,
                            children: [],
                            depth: 1
                        }
                    }).all();

                    reasonLog = modLogEntries.find(entry => entry.target?.id === details.id);
                } catch (e) {
                    console.error(`[ContentDataManager] Failed to fetch ModLog for ${details.id}:`);
                }

                try {
                    const removalActionType = isPost ? 'removelink' : 'removecomment';


                    const modLogEntries = await context.reddit.getModerationLog({
                        subredditName: item.subredditName,
                        type: removalActionType,
                        limit: 10,
                        more: {
                            parentId: item.id,
                            children: [],
                            depth: 1
                        }
                    }).all();

                    removalLog = modLogEntries.find(entry => entry.target?.id === details.id);
                } catch (e) {
                    console.error(`[ContentDataManager] Failed to fetch ModLog for ${details.id}:`);
                }
            }

            if (cacheMiss && (reasonLog || removalLog)) {
                await CacheManager.cacheContent(`modlog:${details.id}`, {
                    reasonLog,
                    removalLog
                }, context as any);
            }

            if (reasonLog) {
                details.removalReason = reasonLog.description || reasonLog.details || undefined;
                if (details.removalReason) {
                    console.log(`[ContentDataManager] Found removal reason: ${details.removalReason}`);
                }
            }

            if (removalLog) {
                if (removalLog.moderatorName && !details.removedBy) {
                    details.removedBy = removalLog.moderatorName;
                }
                // Sometimes the reason is in the removal action details themselves
                if (!details.removalReason && (removalLog.details || removalLog.description)) {
                    details.removalReason = removalLog.details || removalLog.description;
                }
            }
        }

        return details;
    }

    static async gatherModActionTarget(event: any, context: TriggerContext): Promise<ModActionDetails> {
        const result: ModActionDetails = {
            targetType: 'unknown',
            targetName: 'Unknown Target',
        };

        const targetId = event.targetPost?.id || event.targetComment?.id;
        if (targetId != "") {
            result.targetType = 'content';
            result.targetName = event.target?.title || `Comment in ${event.subreddit?.name}`;

            try {
                let item: Post | Comment | undefined;
                if (targetId.startsWith('t3_')) {
                    item = await context.reddit.getPostById(targetId);
                } else if (targetId.startsWith('t1_')) {
                    item = await context.reddit.getCommentById(targetId);
                }

                if (item) {
                    result.contentDetails = await this.gatherDetails(item, context);
                    result.targetName = result.contentDetails.title;
                    result.targetUrl = result.contentDetails.permalink;
                }
            } catch (e) {
                console.warn(`[ContentDataManager] Could not fetch full content for mod log: ${targetId}`);
                result.targetUrl = event.targetPost?.permalink ? `https://reddit.com${event.targetPost.permalink}` : undefined;
            }
            return result;
        }

        if (event.targetUser.id != "") {
            result.targetType = 'user';
            result.targetName = `u/${event.targetUser.name}`;
            result.targetUrl = `https://www.reddit.com/user/${event.targetUser.name}`;
            return result;
        }

        result.targetType = 'subreddit';
        result.targetName = `r/${event.subreddit?.name || 'Subreddit'}`;
        result.targetUrl = `https://www.reddit.com/r/${event.subreddit?.name}`;

        return result;
    }
}