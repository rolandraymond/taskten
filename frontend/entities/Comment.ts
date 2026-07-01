export interface CommentAuthor {
    id: number;
    name?: string;
    surname?: string;
    email: string;
}

export interface Comment {
    id: number;
    uid: string;
    task_id: number;
    user_id: number;
    content: string;
    is_edited: boolean;
    edited_at: string | null;
    created_at: string;
    updated_at?: string;
    Author: CommentAuthor;
}
