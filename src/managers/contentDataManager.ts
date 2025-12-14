import { Post, Comment, Context, TriggerContext, ModAction } from '@devvit/public-api';
import { UtilityManager } from './utilityManager.js';

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

    // Enriched Data
    removalReason?: string;
    removedBy?: string;
    reportReasons?: string[];
    reportCount?: number;
    modNote?: string;
}

export interface ModActionDetails {
    targetType: 'content' | 'user' | 'subreddit' | 'unknown';
    targetName: string;
    targetUrl?: string;
    details?: string; 
    contentDetails?: ContentDetails;
}

export class ContentDataManager {
    static async gatherDetails(item: Post | Comment, context: TriggerContext): Promise<ContentDetails> {
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
        };

        if (isPost) {
            details.imageUrl = await UtilityManager.getBestImageUrl(item);
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
     

        if (item.isRemoved() || item.isSpam() || isPost && item.removedByCategory) {
            try {
                const modLogEntries = await context.reddit.getModerationLog({
                    subredditName: item.subredditName,
                    type: 'addremovalreason',
                    limit: 1,
                    more: {
                        parentId: item.id,
                        children: [],
                        depth: 1
                    }
                }).all();

                const match = modLogEntries.find(entry => entry.target?.id === details.id);

                if (match) {
                    details.removalReason = match.description || match.details || undefined;
                    console.log(`[ContentDataManager] Found removal reason in ModLog: ${details.removalReason}`);
                }

            } catch (e) {
                console.error(`[ContentDataManager] Failed to fetch ModLog for ${details.id}:`);
            }


            try {
                const removalActionType = isPost ? 'removelink' : 'removecomment';


                const modLogEntries = await context.reddit.getModerationLog({
                    subredditName: item.subredditName,
                    type: removalActionType,
                    limit: 1,
                    more: {
                        parentId: item.id,
                        children: [],
                        depth: 1
                    }
                }).all();

                console.log(`[ContentDataManager] Fetched ModLog entries for ${details.id}`)
                console.log(modLogEntries)

                const match = modLogEntries.find(entry => entry.target?.id === details.id);

                if (match && match.moderatorName)
                {
                    details.removedBy = match.moderatorName || undefined;
                    console.log(`[ContentDataManager] Found removed By in ModLog: ${details.removedBy}`);
                }

                if (match && match.details && !details.removalReason)
                {
					details.removalReason = match.details || undefined;
					console.log(`[ContentDataManager] Found removal reason in ModLog details: ${details.removalReason}`);
				}

            } catch (e) {
                console.error(`[ContentDataManager] Failed to fetch ModLog for ${details.id}:`);
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