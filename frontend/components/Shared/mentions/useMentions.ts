import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    filterMentionUsers,
    findMentionAtCursor,
} from './mentionUtils';
import type { MentionMatch, MentionUser } from './types';

interface UseMentionsOptions {
    loadUsers: () => Promise<MentionUser[]>;
}

export function useMentions({
    loadUsers,
}: UseMentionsOptions) {
    const [users, setUsers] = useState<MentionUser[]>([]);
    const [loading, setLoading] = useState(false);

    const [open, setOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [match, setMatch] = useState<MentionMatch | null>(null);
    const insertMention = useCallback(
    (text: string, user: MentionUser) => {
        if (!match) return text;

        const mentionText = `@[${user.label}](user:${user.id})`;
        const before = text.slice(0, match.start);
        const after = text.slice(match.end);

        setOpen(false);
        setMatch(null);
        setSelectedIndex(0);

        return `${before}${mentionText} ${after}`;
    },
    [match],
);

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                setLoading(true);

                const data = await loadUsers();

                if (!mounted) return;

                setUsers(
                data.map((user) => ({
                    id: user.id,
                    uid: user.uid,
                    label: user.label || 'Unknown user',
                    avatar: user.avatar ?? null,
                    role: user.role,
                    isAdmin: Boolean((user as any).isAdmin),
                })),
                );
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }


        load();

        return () => {
            mounted = false;
        };
    }, []);

    const update = useCallback(
        (text: string, cursor: number) => {
            const current = findMentionAtCursor(text, cursor);

            setMatch(current);
            setSelectedIndex(0);

            if (!current) {
                setOpen(false);
                return;
            }

            setOpen(true);
        },
        [],
    );

    const filteredUsers = useMemo(() => {
        if (!match) {
            return [];
        }

        return filterMentionUsers(users, match.query);
    }, [users, match]);

    return {
        loading,

        open,
        setOpen,

        users,
        filteredUsers,

        selectedIndex,
        setSelectedIndex,
        insertMention,
        match,

        update,
    };
}