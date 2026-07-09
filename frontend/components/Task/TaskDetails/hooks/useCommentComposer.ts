import { useCallback, useRef, useState } from 'react';

export interface StoredAttachment {
    id: string;
    name: string;
    type: string;
    size: number;
    dataUrl: string;
}

interface UseCommentComposerOptions {
    onError: (message: string) => void;
    onStatusChange?: (message: string | null) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
        reader.readAsDataURL(file);
    });
}

export function useCommentComposer({
    onError,
    onStatusChange,
}: UseCommentComposerOptions) {
    const [draft, setDraft] = useState('');
    const [attachments, setAttachments] = useState<StoredAttachment[]>([]);
    const [draggingFiles, setDraggingFiles] = useState(false);
    const [sending, setSending] = useState(false);

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFormat = useCallback(
        (token: '**' | '*' | '~~' | '`') => {
            const input = inputRef.current;
            if (!input) return;

            const start = input.selectionStart ?? draft.length;
            const end = input.selectionEnd ?? draft.length;
            const selected = draft.slice(start, end);
            const before = draft.slice(0, start);
            const after = draft.slice(end);

            const nextValue = `${before}${token}${selected}${token}${after}`;
            setDraft(nextValue);

            window.requestAnimationFrame(() => {
                input.focus();
                input.setSelectionRange(start + token.length, end + token.length);
            });
        },
        [draft],
    );

    const openAttachmentPicker = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const ingestFiles = useCallback(
        async (incomingFiles: File[]) => {
            if (incomingFiles.length === 0) return;

            const MAX_FILES = 6;
            const MAX_SIZE_MB = 8;
            const allowed = incomingFiles.slice(0, MAX_FILES);
            const oversized = allowed.filter((file) => file.size > MAX_SIZE_MB * 1024 * 1024);
            const accepted = allowed.filter((file) => file.size <= MAX_SIZE_MB * 1024 * 1024);

            if (oversized.length > 0) {
                onError(`Some files are larger than ${MAX_SIZE_MB}MB and were skipped`);
            }

            if (accepted.length === 0) return;

            const nextAttachments = await Promise.all(
                accepted.map(async (file) => ({
                    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
                    name: file.name,
                    type: file.type || 'application/octet-stream',
                    size: file.size,
                    dataUrl: await readFileAsDataUrl(file),
                })),
            );

            setAttachments((current) => {
                const merged = [...current, ...nextAttachments];
                onStatusChange?.(`${merged.length} attachment${merged.length === 1 ? '' : 's'} ready`);
                return merged;
            });
        },
        [onError, onStatusChange],
    );

    const handleFileSelect = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            await ingestFiles(files);
        },
        [ingestFiles],
    );

    const handleDrop = useCallback(
        async (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setDraggingFiles(false);
            const files = Array.from(event.dataTransfer.files ?? []);
            await ingestFiles(files);
        },
        [ingestFiles],
    );

    const removeAttachment = useCallback((attachmentId: string) => {
        setAttachments((current) => current.filter((item) => item.id !== attachmentId));
    }, []);

    const resetComposer = useCallback(() => {
        setDraft('');
        setAttachments([]);
        setSending(false);
        setDraggingFiles(false);
    }, []);

    return {
        draft,
        setDraft,
        attachments,
        setAttachments,
        draggingFiles,
        setDraggingFiles,
        sending,
        setSending,
        inputRef,
        fileInputRef,
        handleFormat,
        openAttachmentPicker,
        handleFileSelect,
        handleDrop,
        removeAttachment,
        resetComposer,
    };
}
export type UseCommentComposerReturn = ReturnType<typeof useCommentComposer>;