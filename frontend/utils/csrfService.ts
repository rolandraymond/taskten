import { getApiPath } from '../config/paths';

let csrfToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

export const getCsrfToken = async (): Promise<string> => {
    if (csrfToken) return csrfToken;
    if (tokenPromise) return tokenPromise;

    tokenPromise = fetch(getApiPath('csrf-token'), { credentials: 'include' })
        .then((response) => {
            if (!response.ok) throw new Error('Failed to fetch CSRF token');
            return response.json();
        })
        .then((data) => {
            csrfToken = data.csrfToken;
            tokenPromise = null;
            return csrfToken!;
        })
        .catch((error) => {
            tokenPromise = null;
            throw error;
        });

    return tokenPromise;
};

export const clearCsrfToken = (): void => {
    csrfToken = null;
    tokenPromise = null;
};

export const clearCsrfCache = clearCsrfToken;

export const fetchWithCsrf = async (
    url: string,
    options: RequestInit = {}
): Promise<Response> => {
    const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
        options.method?.toUpperCase() || 'GET'
    );

    if (!needsCsrf) return fetch(url, options);

    const token = await getCsrfToken();
    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'x-csrf-token': token,
        },
    });

    // ✅ لو الـ server رفض الـ token — امسحه وحاول مرة تانية بـ token جديد
    if (response.status === 403 || response.status === 500) {
        const body = await response.clone().json().catch(() => ({}));
        const isCsrfError =
            body?.error?.toLowerCase().includes('csrf') ||
            body?.message?.toLowerCase().includes('csrf') ||
            response.headers.get('x-csrf-error') !== null;

        if (isCsrfError) {
            clearCsrfToken();
            const freshToken = await getCsrfToken();
            return fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    'x-csrf-token': freshToken,
                },
            });
        }
    }

    return response;
};