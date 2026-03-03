import { Post, Comment, TriggerContext, ModAction } from '@devvit/public-api';
import { UtilityManager } from '../helpers/utilityHelper.js';
import { CacheManager } from '../managers/cacheManager.js';
import { DevvitContext } from '../types/context.js';

// #region Interfaces
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
// #endregion

/**
 * Normalizes and enriches data from various Reddit objects (Posts, Comments, ModActions).
 */
export class ContentDataManager {
    /**
     * Gathers extensive details from a Reddit Post or Comment, including crosspost parent info,
     * user karma stats, and moderation history.
     */
    static async gatherDetails(item: Post | Comment, context: DevvitContext, event?: any): Promise<ContentDetails> {
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

        // 1. Handle Crosspost Logic
        await this.enrichCrosspostData(details, item, context, event);

        // 2. Handle User Stats & Karma (Cached)
        await this.enrichUserStats(details, item, context);

        // 3. Handle Visual Warnings (NSFW/Spoiler)
        if (isPost) {
            details.imageUrl = await UtilityManager.getBestImageUrl(item as Post);
            this.setVisualWarnings(details, item as Post);
        }

        // 4. Handle Reports
        this.enrichReportData(details, item);

        // 5. Handle Moderation Logs (Removal Reason/Mod)
        const needsModLogs = item.isRemoved() || item.isSpam() || (isPost && (item as Post).removedByCategory) || !isPost;
        if (needsModLogs) {
            await this.enrichModLogData(details, item, context);
        }

        return details;
    }

    /**
     * Resolves target details for a ModAction event.
     */
    static async gatherModActionTarget(event: any, context: DevvitContext): Promise<ModActionDetails> {
        const result: ModActionDetails = {
            targetType: 'unknown',
            targetName: 'Unknown Target',
        };

        const targetId = event.targetPost?.id || event.targetComment?.id;
        
        // Scenario A: Content Target (Post/Comment)
        if (targetId) {
            result.targetType = 'content';
            result.targetName = event.target?.title || `Comment in ${event.subreddit?.name}`;

            try {
                const item = targetId.startsWith('t3_') 
                    ? await context.reddit.getPostById(targetId) 
                    : await context.reddit.getCommentById(targetId);

                if (item) {
                    result.contentDetails = await this.gatherDetails(item, context);
                    result.targetName = result.contentDetails.title;
                    result.targetUrl = result.contentDetails.permalink;
                }
            } catch (e) {
                console.warn(`[ContentDataManager] Could not fetch content for mod log: ${targetId}`);
                result.targetUrl = event.targetPost?.permalink ? `https://reddit.com${event.targetPost.permalink}` : undefined;
            }
            return result;
        }

        // Scenario B: User Target
        if (event.targetUser?.id) {
            result.targetType = 'user';
            result.targetName = `u/${event.targetUser.name}`;
            result.targetUrl = `https://www.reddit.com/user/${event.targetUser.name}`;
            return result;
        }

        // Scenario C: Subreddit Target
        result.targetType = 'subreddit';
        result.targetName = `r/${event.subreddit?.name || 'Subreddit'}`;
        result.targetUrl = `https://www.reddit.com/r/${event.subreddit?.name}`;

        return result;
    }

    // #region Private Helpers

    private static async enrichCrosspostData(details: ContentDetails, item: Post | Comment, context: DevvitContext, event?: any) {
        let crosspostParentId = event?.crosspostParentId;
        const redditIdRegex = /(?:\/comments\/|\/gallery\/|\/s\/)([a-z0-9]+)/i;

        if (!crosspostParentId && 'title' in item && (item as Post).url) {
            const match = (item as Post).url.match(redditIdRegex);
            if (match && !item.id.includes(match[1])) {
                crosspostParentId = 't3_' + match[1];
            }
        }

        if (crosspostParentId) {
            try {
                const crosspostItem = await context.reddit.getPostById(crosspostParentId);
                details.crossPostBody = crosspostItem.body;
                details.crossPostPermalink = `https://reddit.com${crosspostItem.permalink}`;
                details.crossPostSubredditName = crosspostItem.subredditName;
                details.isCrossPost = true;
            } catch (error) {
                console.error(`[ContentDataManager] Failed to fetch crosspost parent:`, error);
            }
        }
    }

    private static async enrichUserStats(details: ContentDetails, item: Post | Comment, context: DevvitContext) {
        if (!details.authorName || details.authorName.toLowerCase().includes("[deleted]")) return;

        const userCacheKey = `user-stats:${details.authorName}:${details.subredditName}`;
        try {
            const cachedStats = await CacheManager.getCachedContent(userCacheKey, context) as CachedUserStats | null;

            if (cachedStats) {
                details.authorLinkKarma = cachedStats.linkKarma;
                details.authorCommentKarma = cachedStats.commentKarma;
                details.authorSubredditLinkKarma = cachedStats.subredditLinkKarma;
                details.authorSubredditCommentKarma = cachedStats.subredditCommentKarma;
                details.authorShadowbanned = cachedStats.authorShadowbanned;
                details.authorCreatedAt = cachedStats.authorCreatedAt ? new Date(cachedStats.authorCreatedAt) : undefined;
                details.authorFlair = cachedStats.authorFlair;
            } else {
                const [user, rawUser] = await Promise.all([
                    item.getAuthor(),
                    context.reddit.getUserByUsername(item.authorName)
                ]);

                details.authorShadowbanned = !rawUser;

                if (user) {
                    const totalSubKarma = await user.getUserKarmaFromCurrentSubreddit();
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
                        authorShadowbanned: details.authorShadowbanned,
                        authorCreatedAt: user.createdAt,
                        authorFlair: details.authorFlair,
                    }, context);
                }
            }
        } catch {
            console.warn(`[ContentDataManager] Failed user stats for ${details.authorName}`);
        }
    }

    private static setVisualWarnings(details: ContentDetails, item: Post) {
        const nsfw = item.isNsfw();
        const spoiler = item.isSpoiler();

        details.isNSFW = nsfw;
        details.isSpoiler = spoiler;

        if (nsfw && spoiler) details.contentWarning = "NSFW & Spoilers";
        else if (nsfw) details.contentWarning = "NSFW";
        else if (spoiler) details.contentWarning = "Spoilers";
    }

    private static enrichReportData(details: ContentDetails, item: Post | Comment) {
        const raw = item as any;
        details.reportReasons = (item.userReportReasons?.length) ? item.userReportReasons : item.modReportReasons;
        details.reportCount = ('title' in item) ? raw.numberOfReports : raw.numReports;
    }

    private static async enrichModLogData(details: ContentDetails, item: Post | Comment, context: DevvitContext) {
        const cacheKey = `modlog:${details.id}`;
        const cached = await CacheManager.getCachedContent(cacheKey, context) as CachedModLogData | null;

        let reasonLog = cached?.reasonLog;
        let removalLog = cached?.removalLog;
        let cacheMiss = false;

        // Fetch Removal Reason
        if (!reasonLog) {
            cacheMiss = true;
            reasonLog = (await context.reddit.getModerationLog({
                subredditName: item.subredditName,
                type: 'addremovalreason',
                limit: 10,
                more: { parentId: item.id, children: [], depth: 1 }
            }).all()).find(e => e.target?.id === details.id);
        }

        // Fetch Removal Action
        if (!removalLog) {
            cacheMiss = true;
            removalLog = (await context.reddit.getModerationLog({
                subredditName: item.subredditName,
                type: ('title' in item) ? 'removelink' : 'removecomment',
                limit: 10,
                more: { parentId: item.id, children: [], depth: 1 }
            }).all()).find(e => e.target?.id === details.id);
        }

        if (cacheMiss && (reasonLog || removalLog)) {
            await CacheManager.cacheContent(cacheKey, { reasonLog, removalLog }, context);
        }

        if (reasonLog) details.removalReason = reasonLog.description || undefined;
        if (removalLog) {
            details.removedBy = details.removedBy || removalLog.moderatorName;
            details.removalReason = details.removalReason || removalLog.description || undefined;
        }
    }
    // #endregion
}