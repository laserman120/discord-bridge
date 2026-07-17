
# Discord-Bridge

An app to help bridge the gap between reddit and discord. 
Making at easy to keep track of anything related to your subreddit directly from your discord server.

| Preview |
| :---: |
| ![Preview Gif](https://raw.githubusercontent.com/laserman120/discord-bridge/262e0344fe9f93b9fa9f374be2c0b0f0012fc63a/assets/Discord-Bridge_Preview.gif) |


---

## Features

- Automatic notifications for a variety of events:
  - New posts
  - Removals, as well as why the removal occured
  - Spam removals
  - Reports
  - ModMail
  - ModLog
  - Posts made with specific flairs
  - Comments/Posts made by users with specific flairs
  - Possible Moderator Abuse detection
  - Comments/Posts made by moderators

- State Aware Messages:
  -  Every post / comment / ModMail has a state it can be in, a few examples would be:
	  -  Live (Visible to everyone)
	  - Approved (Approved by a moderator)
	  - Removed (Removed by a moderator)
	  - Automated Removal (Removed by AutoMod or similar)
	  - Deleted ( Deleted by the author or reddit)
	  - ...
  - If a post is approved/removed/deleted all private messages will update to reflect the change.
  - ModMail notifications will update when replied or when archived

  - Read Only by design, the App will never perform actions on your subreddit.

---	

## Basic Setup and Configuration

- To learn how to create a webhook URL, check out the official [Intro to Webhooks (Discord Support)](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks)

- If you want to ping a specific user or role in custom messages you can use this format:
 	- User: `<@USER__ID>`
	- Role: `<@&ROLE__ID>`

- **Any feature will only become active once a valid Discord webhook URL is provided for that feed type.**
- Pingable notification messages are **optional** and can be left empty if not desired.

	![Basic Setup Example](https://raw.githubusercontent.com/laserman120/discord-bridge/7911dd9c27a6d9ef20fcf38abfcb6830af0aeb52/assets/Settings.png)

---

## Detailed Explanation of Features and Configuration

- **Before installing it is highly recommended to check out the Wiki here:** 
  ## [Discord Bridge Wiki](https://github.com/laserman120/discord-bridge/wiki)

---

## The App is still in active development.

- If you encounter issues or have suggestions feel free to reach out to me, or to make a post on my subreddit [r/Discord_Bridge](https://www.reddit.com/r/Discord_Bridge/).
- I always appreciate feedback and suggestions, and I try my best to respond to everyone in a timely manner.

---

## Changelog

**Full Patch Notes:** For a detailed list of every bug fix and minor change, please visit our [Wiki Page](https://github.com/laserman120/discord-bridge/wiki/X-%E2%80%90-Patch-Notes).

- 0.15.10
  - Backend safety features to prevent data overflow.
  - Improved handling of Spam removals

- 0.15.08
  - Fixed major issue with discord error handling.
  - Implemented Debug options in the settings. (Warning: Debug options are only meant to be used when instructed to do so.)

- 0.15.00
  - Added setting to the Report Feed to remove handled messages instead of updating.
  - Added setting to the ModMail Feed to remove handled messages instead of updating.
  - Major backend improvements and rewrites.
    - Fixed keys with missing TTL
    - Improved Safeguards in which the Queue could become stuck.
    - Implemented Safeguards to ignore items in the queue older than 13 days.
    - Improved logging.
  - Improved performance in cases in which not all feeds / features are enabled.
  - Improvements to the report handling.
  - Improvements to ModMail handling.
  - Implemented Safeguad for Discord Rate Limiting, the app should no longer drop messages when sending to Discord fails.

- 0.14.32
  - Minor fix to prevent double handling of ModLog entries

- 0.14.30
  - Minor timing adjustments.
  - Minor formatting fixes.
  - Fixed cases in which deleted posts were sent to webhooks which should not include deleted posts.

- 0.14.28
  - Minor timing adjustements to prevent missed message updates.
    - (Primarily for the new post and flair posts)
  - Fixed the spam check incorrectly flagging automod filtered posts as spam removals.

- 0.14.24
  - Minor bug fixes
  - Self release lock system to prevent the system from locking up
  - Minor formatting fixes.
  - Improved handling of reddit/devvit downtimes

- v0.14.16
  - Infrastructure: Major codebase refactor and improved stability during Reddit API downtimes.
  - Translations: Added global translation settings (see Wiki for setup).
  - Mod Queue Feed: Implemented JSON threshold configurations to trigger custom pings based on queue size (default ping at 10+ items).
  - Modmail: Enhanced grouping for moderator replies and added an age-check filter to ignore outdated messages.
  - Refinements: Improved markdown escaping and fixed minor issues with silent removal checks.

- v0.14.4 – v0.14.6
  - Spam & Ban Detection: Added detection for shadowbanned users and items silently removed by Reddit (scans every 15 minutes).
  - UI Overhaul: Regrouped notification layouts into logical sections (Author, Post/Comment, Karma, and Mod Status) to reduce message size.
  - Author Insights: Added toggleable fields for account age, user flairs, and granular karma breakdowns (Total vs. Subreddit-specific).
  - Modmail Enhancements: Improved layout density, integrated Arctic Shift user buttons, and optimized handling for rapid-fire messages.
  - Formatting Engine: Added a conversion layer to translate Reddit-style formatting into Discord-compatible styles, fixing issues like underscore-heavy usernames.
  - Crossposts: Significantly improved detection logic for crossposts, even within removed or approved content.
  - Settings Streamlining: Synced settings so that "Enabled" in the dashboard consistently correlates to "Enabled" in the notification.

- v0.0.63
  - System Rework: Complete overhaul of the message system for improved UI, maintainability, and field customization; replaced title hyperlinks with buttons.
  - ModQueue Stream: New stream that mirrors the subreddit mod queue and auto-deletes handled items from Discord.
  - Notifications: Added opt-out system for app updates and general news delivered via Modmail.
  - Enhanced Filtering: Added ignore settings for specific Modmail authors, moderator-initiated removals, and specific user removals (e.g., AutoMod).
  - UI/UX: Improved Modmail thread handling and added Arctic-Shift user info integration.

- v0.0.50
  - Admin Removals: Reworked logic to use a static list for Admin removals to eliminate false positives.
  - Performance: Reduced Reddit API overhead and optimized deletion tracking.

- v0.0.37
  - Stability: Implemented a Queue System to prevent rate-limiting and ensure correct execution order.
  - Logic Updates: Added more automatic removal options and updated to the latest Devvit version.
  - Bug Fixes: Resolved duplicate report notifications and incorrect removal reason displays.

- v0.0.26
  - Monitoring Systems: Introduced Moderator Watching and Moderator Abuse warning systems.
  - Dynamic Updates: Added real-time message updates for author body edits, flair changes, and content warnings.
  - Customization: Added support for custom mod log messages and a user-defined list for automatic removal apps.
  - Performance: Implemented caching for frequently accessed Reddit data.

- v0.0.23
  - Flair Watching: New feature to track specific post flair changes.
  - Crosspost Support: Added detailed crosspost metadata, including original subreddit links and body text fetching.
  - Rate Limiting: Added delays to Discord message deletions to prevent webhook throttling.
  - Fixes: Resolved issues with "No Body" text displays and incorrect Admin removal tagging on comments.

- v0.0.14
  - Initial Release.

---

## Important Links:
- [Source Code](https://github.com/laserman120/discord-bridge)
- [Privacy Policy](https://github.com/laserman120/discord-bridge/blob/main/PRIVACY.md)
- [Terms](https://github.com/laserman120/discord-bridge/blob/main/TERMS.md)