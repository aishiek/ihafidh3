/**
 * HTML Sanitizer for Announcement Content
 * Removes potentially dangerous HTML/JS to prevent XSS attacks
 */

export function sanitizeHtml(html: string): string {
    if (!html) return '';

    let clean = html;

    // Remove script tags and their content
    clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove event handlers (onclick, onerror, onload, etc.)
    clean = clean.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    clean = clean.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

    // Remove javascript: protocol
    clean = clean.replace(/javascript:/gi, '');

    // Remove data: protocol (can be used for XSS)
    clean = clean.replace(/data:text\/html/gi, '');

    // Remove iframe tags
    clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

    // Remove object and embed tags
    clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
    clean = clean.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');

    return clean;
}
