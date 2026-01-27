import { JobContext } from '@devvit/public-api';

const NEWS_SOURCE_SUBREDDIT = 'Discord_Bridge';
const NEWS_SOURCE_AUTHOR = '_GLAD0S_';

export async function checkNewsUpdates(event: any, context: JobContext): Promise<void> {

    // 1. Check Settings
    const enableNews = await context.settings.get('ENABLE_NEWS_NOTIFICATIONS') as boolean;
    const enableUpdates = await context.settings.get('ENABLE_UPDATE_NOTIFICATIONS') as boolean;

    if (!enableNews && !enableUpdates) {
        return;
    }

    console.log('[NewsCheck] Checking for global updates...');

    try {
        const recentPosts = await context.reddit.getNewPosts({
            subredditName: NEWS_SOURCE_SUBREDDIT,
            limit: 25
        }).all();

        const currentSub = await context.reddit.getCurrentSubreddit();

        const MAX_AGE_MS = 3 * 60 * 60 * 1000;
        const cutoffTime = Date.now() - MAX_AGE_MS;

        for (const post of recentPosts) {


            if (post.createdAt.getTime() < cutoffTime) {
                continue;
            }

            if (!post.authorName || post.authorName.toLowerCase() !== NEWS_SOURCE_AUTHOR.toLowerCase()) {
                continue;
            }

            let notificationType: string | null = null;

            if (post.title.startsWith('[News]') && enableNews) {
                notificationType = 'News';
            } else if (post.title.startsWith('[Update]') && enableUpdates) {
                notificationType = 'Update';
            }

            if (!notificationType) continue;

            const redisKey = `news_seen:${post.id}`;
            const hasSeen = await context.redis.get(redisKey);

            if (hasSeen) continue;

            console.log(`[NewsCheck] Sending ${notificationType} notification for ${post.id}`);

            const cleanTitle = post.title.replace(/\[.*?\]/, '').trim();

            await context.reddit.modMail.createModNotification({
                subject: `Discord Bridge ${notificationType}: ${cleanTitle}`,
                bodyMarkdown: `**Discord Bridge ${notificationType}**\n\n${post.url}\n\n${post.body ? post.body.substring(0, 1000) + '...' : ''}\n\n*You can disable these notifications in the App Settings.*\n\n*This is an automatic message, if you require assistance, have questions or want to request a feature, contact me directly* ( [Here](https://www.reddit.com/message/compose/?to=_GLAD0S_) ) *or create a post in* [r/Discord_Bridge](https://www.reddit.com/r/Discord_Bridge/)`,
                subredditId: currentSub.id
            });

            await context.redis.set(redisKey, 'true');
        }

    } catch (e) {
        console.error('[NewsCheck] Failed to check for news:', e);
    }
}