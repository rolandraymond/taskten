export interface MentionUser {
    id: number;
    uid?: string;
    label: string;
    avatar?: string | null;
    role?: string;
    isAdmin?: boolean;
}

export interface MentionMatch {
    query: string;
    start: number;
    end: number;
}

export interface MentionState {
    open: boolean;
    loading: boolean;
    users: MentionUser[];
    filteredUsers: MentionUser[];
    selectedIndex: number;
    match: MentionMatch | null;
}