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
    subredditName: string;
    createdAt: Date;
    flairText?: string;
    thumbnail?: string;
    imageUrl?: string;
    contentWarning?: string;
    isNSFW?: boolean;
    isSpoiler?: boolean;

    authorName: string;
    authorShadowbanned?: boolean;
    authorLinkKarma?: number;
    authorCommentKarma?: number;
    authorSubredditLinkKarma?: number;
    authorSubredditCommentKarma?: number;
    authorCreatedAt?: Date;
    authorFlair?: string;

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

interface CachedUserStats {
    linkKarma: number;
    commentKarma: number;
    subredditLinkKarma: number;
    subredditCommentKarma: number;
    authorShadowbanned?: boolean;
    authorCreatedAt?: Date;
    authorFlair?: string;
}

export class ContentDataManager {
    static async gatherDetails(item: Post | Comment, context: TriggerContext, event?: any): Promise<ContentDetails> {
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
            isCrossPost: false,
        };

        let crosspostItem: Post | undefined;
        if (event?.crosspostParentId) {
            try {
                console.log("[ContentDataManager] Item is a crosspost, fetching parent post " + item.id)
                crosspostItem = await context.reddit.getPostById(event.crosspostParentId)
            } catch (error) {
                console.error(`[ContentDataManager] Failed to fetch full post ${item.id}:`, error);
            }
        }

        details.crossPostBody = crosspostItem ? crosspostItem.body : undefined;
        details.crossPostPermalink = crosspostItem ? `https://reddit.com${crosspostItem.permalink}` : undefined;
        details.crossPostSubredditName = crosspostItem ? crosspostItem.subredditName : undefined;
        details.isCrossPost = !!crosspostItem;

        if (details.authorName && !details.authorName.toLowerCase().includes("[deleted]")) {
            const userCacheKey = `user-stats:${details.authorName}:${details.subredditName}`;

            try {
                const cachedStats = await CacheManager.getCachedContent(userCacheKey, context as any) as CachedUserStats | null;

                if (cachedStats) {
                    details.authorLinkKarma = cachedStats.linkKarma;
                    details.authorCommentKarma = cachedStats.commentKarma;
                    details.authorSubredditLinkKarma = cachedStats.subredditLinkKarma;
                    details.authorSubredditCommentKarma = cachedStats.subredditCommentKarma;
                    details.authorShadowbanned = cachedStats.authorShadowbanned;
                    details.authorCreatedAt = cachedStats.authorCreatedAt ? new Date(cachedStats.authorCreatedAt) : undefined;
                    details.authorFlair = cachedStats.authorFlair;
                } else {

                    const user = await item.getAuthor();
                    const rawUser = await context.reddit.getUserByUsername(item.authorName);

                    let isShadowbanned = false;
                    if (!rawUser) {
                        isShadowbanned = true;
                    }

                    details.authorShadowbanned = isShadowbanned;

                    if (user) {
                        const totalSubKarma = await user.getUserKarmaFromCurrentSubreddit() || undefined;

                        details.authorLinkKarma = user.linkKarma;
                        details.authorCommentKarma = user.commentKarma;
                        details.authorSubredditLinkKarma = totalSubKarma?.fromPosts;
                        details.authorSubredditCommentKarma = totalSubKarma?.fromComments;

                        const flair = await user.getUserFlairBySubreddit(details.subredditName);
                        details.authorFlair = flair?.flairText || undefined;

                        details.authorCreatedAt = user.createdAt;

                        await CacheManager.cacheContent(userCacheKey, {
                            linkKarma: user.linkKarma,
                            commentKarma: user.commentKarma,
                            subredditLinkKarma: totalSubKarma?.fromPosts,
                            subredditCommentKarma: totalSubKarma?.fromComments,
                            authorShadowbanned: isShadowbanned,
                            authorCreatedAt: user.createdAt,
                            authorFlair: flair?.flairText || undefined,
                        }, context as any);
                    }
                }
            } catch {
                console.warn(`[ContentDataManager] Failed to fetch user stats for ${details.authorName}`);
            }
        }


        if (isPost) {
            details.imageUrl = await UtilityManager.getBestImageUrl(item);

            if (item.isNsfw() && !item.isSpoiler()) {
                details.contentWarning = "NSFW"
                details.isNSFW = true;
                details.isSpoiler = false;
            }
            else if (item.isSpoiler() && !item.isNsfw()) {
                details.contentWarning = "Spoilers"
                details.isNSFW = false;
                details.isSpoiler = true;
            }
            else if (item.isSpoiler() && item.isNsfw()) {
                details.contentWarning = "NSFW & Spoilers"
                details.isNSFW = true;
                details.isSpoiler = true;
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

            if (!reasonLog) {
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
                } catch {
                    console.error(`[ContentDataManager] Failed to fetch ModLog for ${details.id}:`);
                }
            }

            if (!removalLog) {
                cacheMiss = true;
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
                } catch {
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
                details.removalReason = reasonLog.description || undefined;
                if (details.removalReason) {
                    console.log(`[ContentDataManager] Found removal reason: ${details.removalReason}`);
                }
            }

            if (removalLog) {
                if (removalLog.moderatorName && !details.removedBy) {
                    details.removedBy = removalLog.moderatorName;
                }
                // Sometimes the reason is in the removal action details themselves
                if (!details.removalReason && removalLog.description) {
                    details.removalReason = removalLog.description;
                    console.log(`[ContentDataManager] Found removal reason from removal log: ${details.removalReason}`);
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