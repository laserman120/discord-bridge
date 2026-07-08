import { JobContext } from '@devvit/public-api';
import { NEWS_SOURCE_SUBREDDIT, NEWS_SOURCE_AUTHOR } from '../config/constants.js';
import { NEWS_MAX_AGE_MS, PRUNE_AGE_SECONDS } from '../config/constants.js';
import { UtilityManager } from '../helpers/utilityHelper.js';
export async function checkNewsUpdates(event: any, context: JobContext): Promise<void> {

    const enableNews = await context.settings.get('ENABLE_NEWS_NOTIFICATIONS') as boolean;
    const enableUpdates = await context.settings.get('ENABLE_UPDATE_NOTIFICATIONS') as boolean;

    if (!enableNews && !enableUpdates) {
        return;
    }

    UtilityManager.log('[NewsCheck] Checking for global updates...');

    try {
        const recentPosts = await context.reddit.getNewPosts({
            subredditName: NEWS_SOURCE_SUBREDDIT,
            limit: 25
        }).all();
        if(!recentPosts){
            UtilityManager.error('[NewsCheck] Failed to fetch recent posts from subreddit.');
            return;
        }

        const currentSub = await context.reddit.getCurrentSubreddit();

        const cutoffTime = Date.now() - NEWS_MAX_AGE_MS;

        const validPosts = recentPosts.filter(post => 
            post.createdAt.getTime() >= cutoffTime && 
            post.authorName && 
            post.authorName.toLowerCase() === NEWS_SOURCE_AUTHOR.toLowerCase()
        );

        if (validPosts.length === 0) return;

        const keysToCheck = validPosts.map(post => `news_seen:${post.id}`);
        const seenStatuses = await context.redis.mGet(keysToCheck);

        for (let i = 0; i < validPosts.length; i++) {
            const post = validPosts[i];
            const hasSeen = seenStatuses[i];

            if (hasSeen) continue;

            let notificationType: string | null = null;
            if (post.title.startsWith('[News]') && enableNews) {
                notificationType = 'News';
            } else if (post.title.startsWith('[Update]') && enableUpdates) {
                notificationType = 'Update';
            }

            if (!notificationType) continue;

            UtilityManager.log(`[NewsCheck] Sending ${notificationType} notification for post ${post.id} in sub: ${currentSub.name} with id ${currentSub.id}`);

            const cleanTitle = post.title.replace(/\[.*?\]/, '').trim();
            const cleanBody = UtilityManager.cleanBodyText(post.body || '');
            const convId = await context.reddit.modMail.createModNotification({
                subject: `Discord Bridge ${notificationType}: ${cleanTitle}`,
                bodyMarkdown: `**Discord Bridge ${notificationType}**\n\n${post.url}\n\n${cleanBody ? cleanBody.substring(0, 1000) + '...' : ''}\n\n*You can disable these notifications in the App Settings.*\n\n*This is an automatic message, if you require assistance, have questions or want to request a feature, contact me directly* ( [Here](https://www.reddit.com/message/compose/?to=_GLAD0S_) ) *or create a post in* [r/Discord_Bridge](https://www.reddit.com/r/Discord_Bridge/)`,
                subredditId: currentSub.id
            });

            if(!convId){
                UtilityManager.error(`[NewsCheck] Failed to create mod notification for post ${post.id}, failed to return conversation ID.`);
                continue;
            }
            
            await context.redis.set(`news_seen:${post.id}`, 'true', { 
                expiration: new Date(Date.now() + PRUNE_AGE_SECONDS * 1000) 
            });
        }

    } catch (e) {
        UtilityManager.error('[NewsCheck] Failed to check for news:', e);
    }
}
