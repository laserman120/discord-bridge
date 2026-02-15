
# Discord-Bridge

An app to help bridge the gap between reddit and discord. 
Making at easy to keep track of anything related to your subreddit directly from your discord server.

![Preview Gif](https://raw.githubusercontent.com/laserman120/discord-bridge/262e0344fe9f93b9fa9f374be2c0b0f0012fc63a/assets/Discord-Bridge_Preview.gif)

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
  - If a post is approved/removed/deleted or similar all private messages related to the post or comment will update to reflect the current state
  - ModMail notifications will update when replied or when archived

| New Post Notification | Same Message after removal |
| :---: | :---: |
| ![New Post](https://raw.githubusercontent.com/laserman120/discord-bridge/7911dd9c27a6d9ef20fcf38abfcb6830af0aeb52/assets/NewPost.png) | ![Same Message after removal](https://raw.githubusercontent.com/laserman120/discord-bridge/7911dd9c27a6d9ef20fcf38abfcb6830af0aeb52/assets/NewPostUpdated.png) |

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

- **Before installing it is highly recommended to check out the Wiki pages here:** [Discord Bridge Wiki](https://github.com/laserman120/discord-bridge/wiki)
- These pages contain detailed explanations of each feature, as well as configuration instructions and examples.

---

# This app is still in development!

- It is likely that bugs or incorrectly identified events may occur.
- If you run into any issues feel free to let me know.
- The app will never perform any action on your subreddit, it is read-only by design.

---

## Changelog

**Full Patch Notes:** For a detailed list of every bug fix and minor change, please visit our [Wiki Page](https://github.com/laserman120/discord-bridge/wiki/X-%E2%80%90-Patch-Notes).

- v0.X.XX
  - Spam Detection
	- If items are silently removed by reddit they can now be properly shown in the removal stream
	- This can be toggled off in the removal settings.
	- A scan only occurs once every 15 minutes.
  - Ban detection. If a user is banned from reddit (or shadowbanned) this will be shown accordingly in the message
  - Adjusted message layout. Now grouping up fields to decrease overall size and increase readability.
	- For example the layout is now grouped up into:
	  - Author information
	  - Post/Comment information
	  - Karma information
	  - Moderation and status information
  - Adjusted the way message details are configured. 
	- All settings are now by default setup so enabled in the settings also correlates to enabled in the notification.
	- This is to streamline the configuration process and avoid confusion about what is enabled or not.
  - Added new options for private messages.
	- You can now show the amount of karma the author has
	  - This is split up into seperate fields for: Total Karma, Total Subreddit Karma, Post Karma, Subreddit Post Karma, Comment Karma, Subreddit Comment Karma
	  - Each can be toggled individually
	- Added the option to show the account age of the author.
	- Added the option to show the user flair of the author.
  - Fixed issue in which messages would not update if no webhook was provided for the report feed.
	- Now even if no webhook is provided for the report feed, all related messages will still be updated to reflect the reported state.
  - Fixed usernames getting incorrect formatting applied when they included two underscores
  - Improved overall formatting by converting reddit formatting styles to discord formatting styles where possible.
	
- v0.0.63
  - System Rework: Complete overhaul of the message system for improved UI, maintainability, and field customization; replaced title hyperlinks with buttons.
  - ModQueue Stream: New stream that mirrors the subreddit mod queue and auto-deletes handled items from Discord.
  - Notifications: Added opt-out system for app updates and general news delivered via Modmail.
  - Enhanced Filtering: Added ignore settings for specific Modmail authors, moderator-initiated removals, and specific user removals (e.g., AutoMod).
  - UI/UX: Improved Modmail thread handling and added Arctic-Shift user info integration.

-v0.0.50
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