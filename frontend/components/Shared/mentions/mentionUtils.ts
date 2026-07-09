import type { MentionMatch } from './types';

export function findMentionAtCursor(
    text: string,
    cursor: number,
): MentionMatch | null {
    const before = text.slice(0, cursor);

    const match = before.match(/(^|\s)@([a-zA-Z0-9._-]*)$/);

    if (!match) {
        return null;
    }

    const query = match[2];

    return {
        query,
        start: cursor - query.length - 1,
        end: cursor,
    };
}

export function filterMentionUsers<T extends { label: string }>(
    users: T[],
    query: string,
) {
    if (!query.trim()) {
        return users;
    }

    const lower = query.toLowerCase();

    return users.filter((user) =>
        user.label.toLowerCase().includes(lower),
    );
}