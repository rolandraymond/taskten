import { getApiPath } from '../config/paths';
import { Comment } from '../entities/Comment';
import { fetchWithCsrf } from './csrfService';
import { handleAuthResponse } from './authUtils';

async function parseJson<T>(response: Response): Promise<T> {
    return await response.json();
}

export async function fetchComments(taskUid: string): Promise<Comment[]> {
    const response = await fetch(getApiPath(`task/${taskUid}/comments`), {
        method: 'GET',
        credentials: 'include',
    });

    await handleAuthResponse(response, 'Failed to fetch comments');
    return parseJson<Comment[]>(response);
}

export async function addComment(
    taskUid: string,
    content: string
): Promise<Comment> {
    const response = await fetchWithCsrf(
        getApiPath(`task/${taskUid}/comments`),
        {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
        }
    );

    await handleAuthResponse(response, 'Failed to add comment');
    return parseJson<Comment>(response);
}

export async function editComment(
    taskUid: string,
    commentId: string | number,
    content: string
): Promise<Comment> {
    const response = await fetchWithCsrf(
        getApiPath(`task/${taskUid}/comments/${commentId}`),
        {
            method: 'PATCH',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
        }
    );

    await handleAuthResponse(response, 'Failed to edit comment');
    return parseJson<Comment>(response);
}

export async function deleteComment(
    taskUid: string,
    commentId: string | number
): Promise<void> {
    const response = await fetchWithCsrf(
        getApiPath(`task/${taskUid}/comments/${commentId}`),
        {
            method: 'DELETE',
            credentials: 'include',
        }
    );

    await handleAuthResponse(response, 'Failed to delete comment');
}
