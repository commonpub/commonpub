/**
 * The operator-facing note shown beside every cover-image upload.
 *
 * One exported constant rather than the string typed into each surface: cover
 * images are uploaded from four separate places (the content starter form, the
 * project editor's inline cover, the article editor's inline cover, and the
 * event forms), and a copy change that reaches three of them is how surfaces
 * start disagreeing.
 *
 * Scoped to the `cover` purpose on purpose. Avatars and hub banners are a
 * different decision and are not covered by this.
 */
export const COVER_IMAGE_AI_NOTICE = 'Please do not use generative AI for your cover image. It\'s tacky and lame.';
