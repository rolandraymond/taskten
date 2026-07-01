import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  DocumentIcon,
  EllipsisHorizontalIcon,
  FaceSmileIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PencilIcon,
  PhotoIcon,
  SparklesIcon,
  TrashIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import { Comment } from '../../../entities/Comment';
import { addComment, deleteComment, editComment, fetchComments } from '../../../utils/commentsService';
import { getCurrentUser } from '../../../utils/userUtils';
import { useToast } from '../../Shared/ToastContext';

interface TaskCommentsCardProps {
  taskUid: string;
  currentUserId?: number;
  onCommentsCountChange?: (count: number) => void;
}

type Author = Comment['Author'];

interface StoredAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

type CommentWithLocalState = Comment & {
  pending?: boolean;
};

type QuoteTarget = Pick<Comment, 'uid' | 'content' | 'Author' | 'created_at'>;

interface ParsedStoredContent {
  body: string;
  quoteBlock: string;
  attachments: StoredAttachment[];
}

const ATTACHMENT_BLOCK_START = '[[attachments:v1]]';
const ATTACHMENT_BLOCK_END = '[[/attachments:v1]]';

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getTheme(seed: string) {
  const hash = hashString(seed || 'default');
  const hue = hash % 360;
  const hue2 = (hue + 28 + (hash % 40)) % 360;
  const hue3 = (hue + 66) % 360;

  return {
    avatar: `linear-gradient(135deg, hsl(${hue} 92% 58%), hsl(${hue2} 88% 47%))`,
    glow: `hsla(${hue3}, 96%, 62%, 0.18)`,
    ring: `hsla(${hue}, 90%, 62%, 0.35)`,
    accent: `hsl(${hue} 90% 58%)`,
    accentSoft: `hsla(${hue} 90%, 58%, 0.12)`,
  };
}

function formatAuthorName(author: Author): string {
  const fullName = [author?.name, author?.surname].filter(Boolean).join(' ').trim();
  return fullName || author?.email || 'Unknown user';
}

function getInitial(author: Author): string {
  const label = formatAuthorName(author).trim();
  return (label.charAt(0) || '?').toUpperCase();
}

function getRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return '';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 45) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
  return DATE_FORMATTER.format(new Date(value));
}

function getDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const sameYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (sameDay) return 'Today';
  if (sameYesterday) return 'Yesterday';
  return DATE_FORMATTER.format(date);
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractPlainText(content: string): string {
  return content
    .replace(/\[\[attachments:v1\]\][\s\S]*?\[\[\/attachments:v1\]\]/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .trim();
}

function buildReplyQuote(comment: QuoteTarget): string {
  const author = formatAuthorName(comment.Author);
  const snippet = extractPlainText(comment.content).replace(/\s+/g, ' ').trim().slice(0, 120);
  const suffix = snippet.length >= 120 ? '…' : '';
  return `> **${author}**\n> ${snippet}${suffix}\n\n`;
}

function normalizeStoredContent(content: string): ParsedStoredContent {
  let working = content || '';
  let attachments: StoredAttachment[] = [];

  const attachmentMatch = working.match(/\[\[attachments:v1\]\]\s*([\s\S]*?)\s*\[\[\/attachments:v1\]\]/);
  if (attachmentMatch) {
    try {
      const parsed = JSON.parse(attachmentMatch[1]);
      if (Array.isArray(parsed)) {
        attachments = parsed.filter(Boolean).map((item) => ({
          id: String(item.id ?? `${Date.now()}-${Math.random()}`),
          name: String(item.name ?? 'file'),
          type: String(item.type ?? 'application/octet-stream'),
          size: Number(item.size ?? 0),
          dataUrl: String(item.dataUrl ?? ''),
        }));
      }
    } catch {
      attachments = [];
    }

    working = working.replace(attachmentMatch[0], '').trim();
  }

  let quoteBlock = '';
  if (working.startsWith('>')) {
    const lines = working.split('\n');
    let end = 0;
    while (end < lines.length) {
      const line = lines[end];
      if (line.startsWith('>') || line.trim() === '') {
        end += 1;
        continue;
      }
      break;
    }

    quoteBlock = lines.slice(0, end).join('\n').trim();
    working = lines.slice(end).join('\n').trimStart();
  }

  return {
    body: working.trim(),
    quoteBlock,
    attachments,
  };
}

function composeStoredContent(body: string, quoteBlock: string, attachments: StoredAttachment[]): string {
  const parts = [] as string[];
  if (quoteBlock.trim()) parts.push(quoteBlock.trimEnd());
  if (body.trim()) parts.push(body.trim());

  let content = parts.join('\n\n').trim();
  if (attachments.length > 0) {
    const serialized = JSON.stringify(attachments);
    content = content ? `${content}\n\n${ATTACHMENT_BLOCK_START}\n${serialized}\n${ATTACHMENT_BLOCK_END}` : `${ATTACHMENT_BLOCK_START}\n${serialized}\n${ATTACHMENT_BLOCK_END}`;
  }
  return content;
}

function isImageFile(file: { type: string; name: string }): boolean {
  return /^image\//i.test(file.type) || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
}

function formatAttachmentLabel(file: StoredAttachment): string {
  return `${file.name} · ${formatFileSize(file.size)}`;
}

function parseInlineNodes(text: string, keyPrefix: string, query?: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const escapedQuery = query?.trim() ? escapeRegExp(query.trim()) : '';
  const queryRegex = escapedQuery ? new RegExp(`(${escapedQuery})`, 'ig') : null;

  const pushText = (segment: string, segmentKey: string) => {
    if (!segment) return;
    if (!queryRegex) {
      nodes.push(<span key={segmentKey}>{segment}</span>);
      return;
    }

    const pieces = segment.split(queryRegex);
    nodes.push(
      <span key={segmentKey}>
        {pieces.map((piece, index) =>
          queryRegex.test(piece) ? (
            <mark
              key={`${segmentKey}-mark-${index}`}
              className="rounded-md bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-400/20"
            >
              {piece}
            </mark>
          ) : (
            <React.Fragment key={`${segmentKey}-frag-${index}`}>{piece}</React.Fragment>
          ),
        )}
      </span>,
    );
    queryRegex.lastIndex = 0;
  };

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushText(text.slice(lastIndex, match.index), `${keyPrefix}-text-${lastIndex}`);
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-bold-${match.index}`} className="font-bold text-inherit">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={`${keyPrefix}-italic-${match.index}`} className="italic text-inherit">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${match.index}`}
          className="rounded-md bg-black/5 px-1.5 py-0.5 font-mono text-[0.92em] text-gray-900 dark:bg-white/10 dark:text-gray-100"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const linkMatch = token.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        nodes.push(
          <a
            key={`${keyPrefix}-link-${match.index}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700 dark:text-indigo-400"
          >
            {linkMatch[1]}
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
          </a>,
        );
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    pushText(text.slice(lastIndex), `${keyPrefix}-text-${lastIndex}`);
  }

  return nodes.length > 0 ? nodes : [text];
}

function renderRichContent(text: string, query?: string): React.ReactNode {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, index) => {
        if (!line.trim()) {
          return <div key={`empty-${index}`} className="h-2" />;
        }

        if (line.startsWith('>')) {
          const content = line.replace(/^>\s?/, '');
          return (
            <blockquote
              key={`quote-${index}`}
              className="rounded-r-2xl border-l-4 border-indigo-500 bg-indigo-50/80 px-3 py-2 text-sm italic text-gray-700 dark:bg-indigo-500/10 dark:text-gray-300"
            >
              {parseInlineNodes(content, `quote-${index}`, query)}
            </blockquote>
          );
        }

        return (
          <div key={`line-${index}`} className="break-words leading-7">
            {parseInlineNodes(line, `line-${index}`, query)}
          </div>
        );
      })}
    </div>
  );
}

function groupCommentsByDate(items: CommentWithLocalState[]): Array<{ label: string; items: CommentWithLocalState[] }> {
  const groups: Array<{ label: string; items: CommentWithLocalState[] }> = [];
  let currentLabel: string | null = null;

  items.forEach((comment) => {
    const label = getDateLabel(comment.created_at);
    const lastGroup = groups[groups.length - 1];

    if (!lastGroup || currentLabel !== label) {
      groups.push({ label, items: [comment] });
      currentLabel = label;
      return;
    }

    lastGroup.items.push(comment);
  });

  return groups;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function composeSearchableText(comment: Comment): string {
  const normalized = normalizeStoredContent(comment.content);
  const attachmentNames = normalized.attachments.map((item) => item.name).join(' ');
  return `${formatAuthorName(comment.Author)} ${normalized.body} ${normalized.quoteBlock} ${attachmentNames}`.toLowerCase();
}

const ComposerHint = () => (
  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
    <SparklesIcon className="h-3.5 w-3.5" />
    <span>Ctrl+Enter sends</span>
  </div>
);

const TaskCommentsCard: React.FC<TaskCommentsCardProps> = ({ taskUid, currentUserId, onCommentsCountChange }) => {
  const { t } = useTranslation();
  const { showErrorToast, showSuccessToast } = useToast();
  const currentUser = useMemo(() => getCurrentUser(), []);
  const resolvedCurrentUserId = currentUserId ?? currentUser?.id ?? 0;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.is_admin === true;

  const [comments, setComments] = useState<CommentWithLocalState[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<QuoteTarget | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuUid, setActiveMenuUid] = useState<string | null>(null);
  const [jumpVisible, setJumpVisible] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<StoredAttachment[]>([]);
  const [draggingFiles, setDraggingFiles] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const requestIdRef = useRef(0);

  const syncCount = useCallback(
    (items: CommentWithLocalState[]) => {
      onCommentsCountChange?.(items.length);
    },
    [onCommentsCountChange],
  );

  const loadComments = useCallback(
    async (showSpinner = true) => {
      const requestId = ++requestIdRef.current;
      try {
        if (showSpinner) setLoading(true);
        else setRefreshing(true);

        const data = await fetchComments(taskUid);
        if (requestId !== requestIdRef.current) return;

        const normalized = [...data].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );

        setComments(normalized);
        syncCount(normalized);
      } catch (error: any) {
        showErrorToast(error?.message || t('task.comments.loadError', 'Failed to load comments'));
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [showErrorToast, syncCount, t, taskUid],
  );

  useEffect(() => {
    loadComments(true);
  }, [loadComments]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return undefined;

    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldStickToBottomRef.current = distanceFromBottom < 160;
      setJumpVisible(distanceFromBottom > 220);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (editingUid || searchQuery) return;
    if (!shouldStickToBottomRef.current) return;
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, [comments.length, editingUid, searchQuery, sending]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 220)}px`;
  }, [draft]);

  const filteredComments = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    const base = term
      ? comments.filter((comment) => composeSearchableText(comment).includes(term))
      : comments;

    return [...base].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [comments, searchQuery]);

  const groupedComments = useMemo(() => groupCommentsByDate(filteredComments), [filteredComments]);

  const participants = useMemo(() => {
    const map = new Map<number, { author: Author; count: number }>();
    comments.forEach((comment) => {
      const id = comment.user_id;
      const current = map.get(id);
      if (current) current.count += 1;
      else map.set(id, { author: comment.Author, count: 1 });
    });
    return [...map.entries()].map(([id, value]) => ({ id, ...value }));
  }, [comments]);

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
        showErrorToast(`Some files are larger than ${MAX_SIZE_MB}MB and were skipped`);
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
        setStatusNote(`${merged.length} attachment${merged.length === 1 ? '' : 's'} ready`);
        return merged;
      });
    },
    [showErrorToast],
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

  const quoteComment = useCallback((comment: QuoteTarget) => {
    setReplyingTo(comment);
    setStatusNote(`Replying to ${formatAuthorName(comment.Author)}`);
    inputRef.current?.focus();
  }, []);

  const copyComment = useCallback(
    async (comment: Comment) => {
      try {
        await navigator.clipboard.writeText(extractPlainText(comment.content));
        showSuccessToast('Message copied');
      } catch {
        showErrorToast('Could not copy the message');
      }
    },
    [showErrorToast, showSuccessToast],
  );

  const startEdit = useCallback((comment: Comment) => {
    const parsed = normalizeStoredContent(comment.content);
    setEditingUid(comment.uid);
    setEditDraft(parsed.body || extractPlainText(comment.content));
    setActiveMenuUid(null);
  }, []);

  const canManage = useCallback(
    (comment: Comment) => comment.user_id === resolvedCurrentUserId || isAdmin,
    [isAdmin, resolvedCurrentUserId],
  );

  const scrollToBottom = useCallback(() => {
    shouldStickToBottomRef.current = true;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  const handleSubmit = useCallback(async () => {
    const body = draft.trim();
    if ((body.length === 0 && attachments.length === 0) || sending) return;

    const serialized = composeStoredContent(body, replyingTo ? buildReplyQuote(replyingTo) : '', attachments);
    const optimistic: CommentWithLocalState = {
      id: -Date.now(),
      uid: `temp-${Date.now()}`,
      task_id: 0,
      user_id: resolvedCurrentUserId,
      content: serialized,
      is_edited: false,
      edited_at: null,
      created_at: new Date().toISOString(),
      Author: {
        id: resolvedCurrentUserId,
        name: currentUser?.name,
        surname: currentUser?.surname,
        email: currentUser?.email || '',
      },
      pending: true,
    };

    const previousDraft = draft;
    const previousAttachments = attachments;

    setDraft('');
    setReplyingTo(null);
    setAttachments([]);
    setSending(true);
    setStatusNote(null);

    setComments((current) => {
      const next = [...current, optimistic].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      syncCount(next);
      return next;
    });

    try {
      const saved = await addComment(taskUid, serialized);
      setComments((current) => {
        const next = current.map((item) => (item.uid === optimistic.uid ? { ...saved } : item));
        syncCount(next);
        return next;
      });
      showSuccessToast(t('task.comments.addSuccess', 'Message sent'));
      await loadComments(false);
    } catch (error: any) {
      setComments((current) => {
        const next = current.filter((item) => item.uid !== optimistic.uid);
        syncCount(next);
        return next;
      });
      setDraft(previousDraft);
      setAttachments(previousAttachments);
      showErrorToast(error?.message || t('task.comments.addError', 'Failed to add comment'));
    } finally {
      setSending(false);
    }
  }, [
    attachments,
    currentUser?.email,
    currentUser?.name,
    currentUser?.surname,
    draft,
    loadComments,
    replyingTo,
    resolvedCurrentUserId,
    sending,
    showErrorToast,
    showSuccessToast,
    syncCount,
    t,
    taskUid,
  ]);

  const saveEdit = useCallback(
    async (comment: Comment) => {
      const nextBody = editDraft.trim();
      if (!nextBody) {
        setEditingUid(null);
        return;
      }

      const previous = comments;
      const parsed = normalizeStoredContent(comment.content);
      const nextContent = composeStoredContent(nextBody, parsed.quoteBlock, parsed.attachments);

      setComments((current) => {
        const next = current.map((item) =>
          item.uid === comment.uid
            ? {
                ...item,
                content: nextContent,
                is_edited: true,
                edited_at: new Date().toISOString(),
              }
            : item,
        );
        syncCount(next);
        return next;
      });
      setEditingUid(null);

      try {
        const updated = await editComment(taskUid, comment.uid, nextContent);
        setComments((current) => {
          const next = current.map((item) => (item.uid === comment.uid ? { ...item, ...updated } : item));
          syncCount(next);
          return next;
        });
        showSuccessToast(t('task.comments.editSuccess', 'Message updated'));
        await loadComments(false);
      } catch (error: any) {
        setComments(previous);
        syncCount(previous);
        showErrorToast(error?.message || t('task.comments.editError', 'Failed to edit comment'));
      }
    },
    [comments, editDraft, loadComments, showErrorToast, showSuccessToast, syncCount, t, taskUid],
  );

  const removeComment = useCallback(
    async (comment: Comment) => {
      const previous = comments;
      setActiveMenuUid(null);

      setComments((current) => {
        const next = current.filter((item) => item.uid !== comment.uid);
        syncCount(next);
        return next;
      });

      try {
        await deleteComment(taskUid, comment.uid);
        showSuccessToast(t('task.comments.deleteSuccess', 'Message deleted'));
        await loadComments(false);
      } catch (error: any) {
        setComments(previous);
        syncCount(previous);
        showErrorToast(error?.message || t('task.comments.deleteError', 'Failed to delete comment'));
      }
    },
    [comments, loadComments, showErrorToast, showSuccessToast, syncCount, t, taskUid],
  );

  const getCompactFlags = useCallback((index: number, items: CommentWithLocalState[]) => {
    const current = items[index];
    const prev = items[index - 1];
    const next = items[index + 1];
    const sameAsPrev =
      Boolean(prev) &&
      prev.user_id === current.user_id &&
      Math.abs(new Date(current.created_at).getTime() - new Date(prev.created_at).getTime()) < 8 * 60 * 1000;
    const sameAsNext =
      Boolean(next) &&
      next.user_id === current.user_id &&
      Math.abs(new Date(next.created_at).getTime() - new Date(current.created_at).getTime()) < 8 * 60 * 1000;

    return {
      compactTop: sameAsPrev,
      compactBottom: sameAsNext,
    };
  }, []);

  return (
    <div className="flex h-full max-h-[85vh] flex-col overflow-hidden rounded-[2rem] border border-white/40 bg-white/75 shadow-[0_30px_100px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-gray-800/60 dark:bg-gray-950/75">
      <div className="border-b border-gray-200/70 bg-[linear-gradient(90deg,rgba(255,255,255,0.92),rgba(249,250,251,0.72),rgba(255,255,255,0.65))] px-5 py-4 dark:border-gray-800/70 dark:bg-[linear-gradient(90deg,rgba(3,7,18,0.95),rgba(15,23,42,0.88),rgba(3,7,18,0.8))] sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-500/20">
              <ChatBubbleLeftRightIcon className="h-7 w-7" />
              <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500 dark:border-gray-950" />
            </div>
            <div>
              <h4 className="text-[1.15rem] font-black tracking-tight text-gray-900 dark:text-white">
                {t('task.comments.title', 'Discussion Space')}
              </h4>
              <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                {filteredComments.length} {t('task.comments.count', 'messages')} · {participants.length} contributors
                {statusNote ? ` · ${statusNote}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 lg:max-w-2xl">
            <div className="flex flex-wrap items-center gap-1.5">
              {participants.slice(0, 4).map(({ id, author }) => {
                const theme = getTheme(`${id}-${formatAuthorName(author)}`);
                return (
                  <div
                    key={id}
                    className="group flex items-center gap-2 rounded-full border border-gray-200/70 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-gray-600 shadow-sm backdrop-blur dark:border-gray-700/70 dark:bg-gray-900/80 dark:text-gray-300"
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black text-white shadow-sm"
                      style={{ backgroundImage: theme.avatar }}
                    >
                      {getInitial(author)}
                    </span>
                    <span className="max-w-[110px] truncate">{formatAuthorName(author)}</span>
                  </div>
                );
              })}
              {participants.length > 4 && (
                <div className="flex items-center gap-2 rounded-full border border-gray-200/70 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500 dark:border-gray-700/70 dark:bg-gray-900/80 dark:text-gray-400">
                  <UsersIcon className="h-3.5 w-3.5" />
                  +{participants.length - 4}
                </div>
              )}
            </div>

            <div className="relative min-w-[220px] flex-1 lg:max-w-[280px]">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('task.comments.search', 'Search messages...')}
                className="w-full rounded-2xl border border-gray-200/70 bg-white/85 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-gray-700/70 dark:bg-gray-900/85 dark:text-gray-100"
              />
            </div>

            <button
              type="button"
              onClick={() => loadComments(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200/70 bg-white/85 px-4 py-2.5 text-sm font-bold text-gray-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700/70 dark:bg-gray-900/85 dark:text-gray-300"
            >
              <ArrowPathIcon className={`h-4.5 w-4.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live thread
          </span>

          <button
            type="button"
            onClick={scrollToBottom}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold transition ${
              jumpVisible
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            Jump to latest
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
        style={{ scrollbarWidth: 'thin' }}
        onClick={() => setActiveMenuUid(null)}
      >
        {loading ? (
          <div className="space-y-5">
            {[1, 2, 3].map((index) => (
              <div key={index} className={`flex gap-3 ${index % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                <div className="h-11 w-11 rounded-[1.25rem] bg-gray-200/70 dark:bg-gray-800/70" />
                <div className="flex-1 space-y-2">
                  <div className={`h-4 w-40 rounded-full bg-gray-200/70 dark:bg-gray-800/70 ${index % 2 === 0 ? 'ml-auto' : ''}`} />
                  <div className="h-20 rounded-[1.75rem] bg-gray-100/80 dark:bg-gray-800/40" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
              <ChatBubbleLeftRightIcon className="h-10 w-10" />
            </div>
            <h3 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
              {searchQuery ? 'No matching messages' : 'Start the discussion'}
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">
              {searchQuery
                ? 'Try another keyword or clear the search to see the full thread.'
                : 'Use this space for updates, handoffs, reviews, and decisions. Attach files, quote messages, and keep the thread tidy.'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {groupedComments.map((group) => (
              <section key={group.label} className="mb-8 last:mb-0">
                <div className="sticky top-0 z-10 flex justify-center py-3">
                  <span className="rounded-full border border-gray-200/70 bg-white/92 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-gray-500 shadow-sm backdrop-blur dark:border-gray-700/70 dark:bg-gray-900/92 dark:text-gray-400">
                    {group.label}
                  </span>
                </div>

                <div className="space-y-3">
                  {group.items.map((comment, index) => {
                    const isOwn = resolvedCurrentUserId === comment.user_id;
                    const canEditDelete = canManage(comment);
                    const isTemp = comment.uid.startsWith('temp-');
                    const theme = getTheme(`${comment.user_id}-${formatAuthorName(comment.Author)}`);
                    const parsed = normalizeStoredContent(comment.content);
                    const compact = getCompactFlags(index, group.items);
                    const hasAttachments = parsed.attachments.length > 0;

                    return (
                      <motion.article
                        layout
                        key={comment.uid}
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className={`group relative flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${isTemp ? 'opacity-75' : ''}`}
                      >
                        <div className="flex flex-shrink-0 flex-col items-center">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-[1.25rem] text-sm font-black text-white shadow-lg transition-transform duration-300 group-hover:scale-[1.03] ${compact.compactTop ? 'scale-95' : ''}`}
                            style={{ backgroundImage: theme.avatar, boxShadow: `0 10px 30px ${theme.glow}` }}
                          >
                            {getInitial(comment.Author)}
                          </div>
                          {!compact.compactBottom && (
                            <div className="mt-2 h-full w-px bg-gradient-to-b from-gray-200 to-transparent dark:from-gray-700" />
                          )}
                        </div>

                        <div className={`min-w-0 flex-1 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div className={`mb-1.5 flex items-baseline gap-2 px-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                            <span className="text-[13px] font-black text-gray-900 dark:text-gray-100">
                              {isOwn ? 'You' : formatAuthorName(comment.Author)}
                            </span>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                              {TIME_FORMATTER.format(new Date(comment.created_at))}
                            </span>
                          </div>

                          <div className="relative">
                            <div
                              className={`relative rounded-[1.6rem] px-4 py-3 text-[15px] leading-relaxed shadow-sm transition-all duration-300 ${
                                isOwn
                                  ? 'rounded-tr-sm text-white'
                                  : 'rounded-tl-sm border border-gray-100 bg-white text-gray-800 shadow-[0_8px_30px_rgba(15,23,42,0.05)] dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100'
                              }`}
                              style={
                                isOwn
                                  ? {
                                      backgroundImage: theme.avatar,
                                      boxShadow: `0 18px 50px ${theme.glow}`,
                                    }
                                  : {
                                      borderLeft: `3px solid ${theme.accent}`,
                                      boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05)',
                                    }
                              }
                            >
                              {comment.pending && (
                                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/90 backdrop-blur">
                                  <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                                  Sending
                                </div>
                              )}

                              {editingUid === comment.uid ? (
                                <div className="w-[min(100%,520px)]">
                                  <textarea
                                    value={editDraft}
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    className={`w-full min-h-[120px] resize-none rounded-[1.2rem] p-3 text-sm outline-none focus:ring-4 ${
                                      isOwn
                                        ? 'bg-white/10 text-white placeholder:text-white/60 focus:ring-white/20'
                                        : 'bg-gray-50 text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/10 dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800'
                                    }`}
                                    autoFocus
                                  />
                                  <div className="mt-3 flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingUid(null)}
                                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${isOwn ? 'text-white/85 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void saveEdit(comment)}
                                      className={`rounded-xl px-4 py-1.5 text-xs font-black ${isOwn ? 'bg-white text-indigo-700 hover:bg-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                    >
                                      Save changes
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {parsed.quoteBlock && (
                                    <div className="mb-3">{renderRichContent(parsed.quoteBlock)}</div>
                                  )}

                                  {parsed.body ? (
                                    <div>{renderRichContent(parsed.body, searchQuery.trim())}</div>
                                  ) : (
                                    <p className={`${isOwn ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'} italic`}>
                                      Empty message
                                    </p>
                                  )}

                                  {hasAttachments && (
                                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                      {parsed.attachments.map((attachment) => {
                                        const image = isImageFile(attachment);
                                        return (
                                          <a
                                            key={attachment.id}
                                            href={attachment.dataUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            download={attachment.name}
                                            className={`group/att flex min-w-0 items-center gap-3 rounded-2xl border p-3 transition hover:-translate-y-0.5 ${
                                              isOwn
                                                ? 'border-white/15 bg-white/10 text-white hover:bg-white/15'
                                                : 'border-gray-200 bg-gray-50 text-gray-800 hover:border-indigo-300 hover:bg-indigo-50/70 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10'
                                            }`}
                                          >
                                            <div
                                              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl ${image ? 'bg-black/10' : 'bg-white/10'}`}
                                              style={image ? { backgroundImage: `url(${attachment.dataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                                            >
                                              {!image && (
                                                <span className={`rounded-lg p-1.5 ${isOwn ? 'bg-white/15' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'}`}>
                                                  {isImageFile(attachment) ? (
                                                    <PhotoIcon className="h-5 w-5" />
                                                  ) : (
                                                    <DocumentIcon className="h-5 w-5" />
                                                  )}
                                                </span>
                                              )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <div className="truncate text-sm font-bold">{attachment.name}</div>
                                              <div className={`truncate text-[11px] font-semibold ${isOwn ? 'text-white/75' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {formatAttachmentLabel(attachment)}
                                              </div>
                                            </div>
                                          </a>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {comment.is_edited && (
                                    <span className={`mt-3 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${isOwn ? 'text-white/80' : 'text-gray-400'}`}>
                                      <CheckIcon className="h-3.5 w-3.5" />
                                      Edited
                                    </span>
                                  )}
                                </>
                              )}

                              {!editingUid && !isTemp && (
                                <AnimatePresence>
                                  {activeMenuUid === comment.uid && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.95, y: -8 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95, y: -8 }}
                                      className={`absolute z-30 mt-3 w-56 overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-gray-900 ${isOwn ? 'right-0' : 'left-0'} border-gray-100 dark:border-gray-800`}
                                    >
                                      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-gray-800 dark:bg-gray-950/60">
                                        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-gray-400">Actions</span>
                                        <button
                                          type="button"
                                          onClick={() => setActiveMenuUid(null)}
                                          className="rounded-full p-1 text-gray-400 hover:bg-gray-200/60 dark:hover:bg-gray-800"
                                        >
                                          <XMarkIcon className="h-4 w-4" />
                                        </button>
                                      </div>

                                      <div className="grid grid-cols-3 gap-1 border-b border-gray-100 p-2 dark:border-gray-800">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setReplyingTo(comment);
                                            setActiveMenuUid(null);
                                          }}
                                          className="rounded-xl p-2.5 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
                                          title="Reply"
                                        >
                                          <ArrowUturnLeftIcon className="h-5 w-5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void copyComment(comment)}
                                          className="rounded-xl p-2.5 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
                                          title="Copy text"
                                        >
                                          <ClipboardDocumentIcon className="h-5 w-5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setActiveMenuUid(null)}
                                          className="rounded-xl p-2.5 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
                                          title="Close"
                                        >
                                          <XMarkIcon className="h-5 w-5" />
                                        </button>
                                      </div>

                                      <div className="p-1.5">
                                        {canEditDelete && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => startEdit(comment)}
                                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 dark:text-gray-200 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
                                            >
                                              <PencilIcon className="h-4 w-4" />
                                              Edit
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => void removeComment(comment)}
                                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                                            >
                                              <TrashIcon className="h-4 w-4" />
                                              Delete
                                            </button>
                                          </>
                                        )}
                                        {!canEditDelete && (
                                          <div className="px-3 py-2 text-xs text-gray-400">No extra actions available</div>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              )}
                            </div>

                            {!editingUid && (
                              <div className={`mt-2 flex items-center gap-2 px-1 text-[11px] font-semibold ${isOwn ? 'text-indigo-100/90' : 'text-gray-400'}`}>
                                <button
                                  type="button"
                                  onClick={() => quoteComment(comment)}
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-black/5 dark:hover:bg-white/5"
                                >
                                  <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                                  Reply
                                </button>
                                <span>·</span>
                                <span>{getRelativeTime(comment.created_at)}</span>
                                {comment.is_edited && (
                                  <>
                                    <span>·</span>
                                    <span>edited</span>
                                  </>
                                )}
                                {hasAttachments && (
                                  <>
                                    <span>·</span>
                                    <span>{parsed.attachments.length} attachment{parsed.attachments.length === 1 ? '' : 's'}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {!editingUid && !isTemp && (
                          <button
                            type="button"
                            onClick={() => setActiveMenuUid(activeMenuUid === comment.uid ? null : comment.uid)}
                            className={`absolute top-2 rounded-full border p-2 opacity-0 shadow-sm transition group-hover:opacity-100 ${isOwn ? '-left-14' : '-right-14'} ${
                              isOwn
                                ? 'border-white/20 bg-white/15 text-white hover:bg-white/20'
                                : 'border-gray-200 bg-white text-gray-500 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                            }`}
                            title="More actions"
                          >
                            <EllipsisHorizontalIcon className="h-4 w-4" />
                          </button>
                        )}
                      </motion.article>
                    );
                  })}
                </div>
              </section>
            ))}
          </AnimatePresence>
        )}

        <div ref={endRef} className="h-4" />
      </div>

      <div className="border-t border-gray-200/70 bg-white/92 px-4 py-4 backdrop-blur-xl dark:border-gray-800/70 dark:bg-gray-950/92 sm:px-6">
        <AnimatePresence>
          {replyingTo && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between rounded-r-2xl border-l-4 border-indigo-500 bg-indigo-50/80 px-4 py-3 dark:bg-indigo-500/10">
                <div className="min-w-0">
                  <div className="text-xs font-black text-indigo-700 dark:text-indigo-400">
                    Replying to {formatAuthorName(replyingTo.Author)}
                  </div>
                  <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {extractPlainText(replyingTo.content)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="rounded-full p-1.5 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-3 flex gap-2 overflow-x-auto pb-1"
            >
              {attachments.map((attachment) => {
                const image = isImageFile(attachment);
                return (
                  <div
                    key={attachment.id}
                    className="relative flex min-w-[180px] max-w-[240px] items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div
                      className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl ${image ? 'bg-black/10' : 'bg-white/80 dark:bg-gray-800'}`}
                      style={image ? { backgroundImage: `url(${attachment.dataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                    >
                      {!image && <DocumentIcon className="h-5 w-5 text-gray-500 dark:text-gray-300" />}
                    </div>
                    <div className="min-w-0 flex-1 pr-7">
                      <p className="truncate text-sm font-bold text-gray-800 dark:text-gray-100">{attachment.name}</p>
                      <p className="truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                        {formatFileSize(attachment.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="absolute right-2 top-2 rounded-full bg-white p-1 text-gray-500 shadow-sm hover:text-red-600 dark:bg-gray-950 dark:text-gray-400"
                      title="Remove attachment"
                    >
                      <XMarkIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className={`relative rounded-[1.7rem] border-2 bg-white shadow-sm transition-all duration-300 dark:bg-gray-950 ${
            draggingFiles
              ? 'border-indigo-500 bg-indigo-50/60 ring-4 ring-indigo-500/10 dark:bg-indigo-900/20'
              : 'border-gray-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 dark:border-gray-800'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDraggingFiles(true);
          }}
          onDragLeave={() => setDraggingFiles(false)}
          onDrop={handleDrop}
        >
          <div className="flex items-center gap-1 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            <button
              type="button"
              onClick={() => handleFormat('**')}
              className="rounded-lg px-2 py-1 text-sm font-black text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Bold"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => handleFormat('*')}
              className="rounded-lg px-2 py-1 text-sm italic text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Italic"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => handleFormat('`')}
              className="rounded-lg px-2 py-1 text-xs font-mono text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Code"
            >
              {'</>'}
            </button>
            <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
            <button
              type="button"
              onClick={() => setDraft((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}👍`)}
              className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Emoji"
            >
              <FaceSmileIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={openAttachmentPicker}
              className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Attach files"
            >
              <PaperClipIcon className="h-5 w-5" />
            </button>
            <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileSelect} />
          </div>

          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                void handleSubmit();
              }
              if (e.key === 'Escape') {
                if (replyingTo) setReplyingTo(null);
                setActiveMenuUid(null);
              }
            }}
            placeholder={
              draggingFiles
                ? 'Drop files here…'
                : t('task.comments.placeholder', 'Write a message, quote teammates, and attach evidence...')
            }
            className="min-h-[102px] w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-6 text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
            disabled={sending}
          />

          <div className="flex flex-col gap-3 border-t border-gray-100 px-3 py-2.5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <ComposerHint />

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <button
                type="button"
                onClick={openAttachmentPicker}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <PaperClipIcon className="h-4.5 w-4.5" />
                Attach
              </button>

              <motion.button
                whileHover={(!sending && (draft.trim().length > 0 || attachments.length > 0)) ? { scale: 1.03 } : {}}
                whileTap={(!sending && (draft.trim().length > 0 || attachments.length > 0)) ? { scale: 0.97 } : {}}
                onClick={() => void handleSubmit()}
                disabled={(draft.trim().length === 0 && attachments.length === 0) || sending}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition-all duration-300 ${
                  (draft.trim().length > 0 || attachments.length > 0) && !sending
                    ? 'bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40'
                    : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800'
                }`}
              >
                {sending ? (
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>Send</span>
                    <PaperAirplaneIcon className="h-4 w-4" />
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskCommentsCard;
