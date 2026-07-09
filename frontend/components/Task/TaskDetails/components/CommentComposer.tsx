import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowPathIcon,
  DocumentIcon,
  FaceSmileIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  XMarkIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { UseCommentComposerReturn } from '../hooks/useCommentComposer';
import { useMentions } from '../../../Shared/mentions/useMentions';
interface ReplyPreview {
  authorName: string;
  contentPreview: string;
}
import { getTaskUsers } from '../../../../utils/usersService';
interface CommentComposerProps {
  taskUid: string;
  composer: UseCommentComposerReturn;
  replyingTo: ReplyPreview | null;
  placeholder: string;
  onCancelReply: () => void;
  onSubmit: () => void;
  onEscape: () => void;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function isImageFile(file: { type: string; name: string }): boolean {
  return /^image\//i.test(file.type) || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
}

const ComposerHint = () => (
  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
    <SparklesIcon className="h-3.5 w-3.5" />
    <span>Ctrl+Enter sends</span>
  </div>
);

const CommentComposer: React.FC<CommentComposerProps> = ({
  taskUid,
  composer,
  replyingTo,
  placeholder,
  onCancelReply,
  onSubmit,
  onEscape,
}) => {
  const canSend = composer.draft.trim().length > 0 || composer.attachments.length > 0;
  const mentions = useMentions({
    loadUsers: () => getTaskUsers(taskUid),
});

  return (
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
                  Replying to {replyingTo.authorName}
                </div>
                <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {replyingTo.contentPreview}
                </div>
              </div>
              <button
                type="button"
                onClick={onCancelReply}
                className="rounded-full p-1.5 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {composer.attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-3 flex gap-2 overflow-x-auto pb-1"
          >
            {composer.attachments.map((attachment) => {
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
                    onClick={() => composer.removeAttachment(attachment.id)}
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
          composer.draggingFiles
            ? 'border-indigo-500 bg-indigo-50/60 ring-4 ring-indigo-500/10 dark:bg-indigo-900/20'
            : 'border-gray-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 dark:border-gray-800'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          composer.setDraggingFiles(true);
        }}
        onDragLeave={() => composer.setDraggingFiles(false)}
        onDrop={composer.handleDrop}
      >
        <div className="flex items-center gap-1 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
          <button type="button" onClick={() => composer.handleFormat('**')} className="rounded-lg px-2 py-1 text-sm font-black text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">B</button>
          <button type="button" onClick={() => composer.handleFormat('*')} className="rounded-lg px-2 py-1 text-sm italic text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">I</button>
          <button type="button" onClick={() => composer.handleFormat('`')} className="rounded-lg px-2 py-1 text-xs font-mono text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">{'</>'}</button>
          <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
          <button
            type="button"
            onClick={() => composer.setDraft((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}👍`)}
            className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <FaceSmileIcon className="h-5 w-5" />
          </button>
          <button type="button" onClick={composer.openAttachmentPicker} className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
            <PaperClipIcon className="h-5 w-5" />
          </button>
          <input ref={composer.fileInputRef} type="file" multiple hidden onChange={composer.handleFileSelect} />
        </div>

        {/* <textarea
                ref={composer.inputRef}
                value={composer.draft}
                onChange={(e) => {
                composer.setDraft(e.target.value);

                mentions.update(
                    e.target.value,
                    e.target.selectionStart ?? e.target.value.length,
                );
            }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
            if (e.key === 'Escape') onEscape();
          }}
          placeholder={composer.draggingFiles ? 'Drop files here…' : placeholder}
          className="min-h-[102px] w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-6 text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
          disabled={composer.sending}
        /> */}
        <textarea
  ref={composer.inputRef}
  value={composer.draft}
  onChange={(e) => {
    composer.setDraft(e.target.value);

    mentions.update(
      e.target.value,
      e.target.selectionStart ?? e.target.value.length,
    );
  }}
  onKeyDown={(e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === 'Escape') onEscape();
  }}
  placeholder={composer.draggingFiles ? 'Drop files here…' : placeholder}
  className="min-h-[102px] w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-6 text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
  disabled={composer.sending}
/>

{mentions.open && (
  <div className="absolute bottom-full left-3 z-50 mb-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900">
    {mentions.filteredUsers.map((user) => (
      <button
        key={user.id}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          const nextValue = mentions.insertMention(composer.draft, user);
          composer.setDraft(nextValue);

          window.requestAnimationFrame(() => {
            composer.inputRef.current?.focus();
          });
        }}
        className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {user.label}
      </button>
    ))}
  </div>
)}

        <div className="flex flex-col gap-3 border-t border-gray-100 px-3 py-2.5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <ComposerHint />

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <button
              type="button"
              onClick={composer.openAttachmentPicker}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <PaperClipIcon className="h-4.5 w-4.5" />
              Attach
            </button>

            <motion.button
              whileHover={!composer.sending && canSend ? { scale: 1.03 } : {}}
              whileTap={!composer.sending && canSend ? { scale: 0.97 } : {}}
              onClick={onSubmit}
              disabled={!canSend || composer.sending}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition-all duration-300 ${
                canSend && !composer.sending
                  ? 'bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800'
              }`}
            >
              {composer.sending ? (
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
  );
};

export default CommentComposer;