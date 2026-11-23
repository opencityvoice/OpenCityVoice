"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BadgeCheck, Eye, EyeOff, ImagePlus, Loader2, Reply, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TimeAgo } from "@/components/report-bits";
import { initials } from "@/components/user-menu";
import { FlagButton } from "@/components/flag-button";
import { PhotoGallery } from "@/components/photo-gallery";
import { SubscribeButton } from "./subscribe-button";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/config";
import { compressPhoto, PHOTO_EXT, PHOTO_MIME } from "@/lib/photo-upload";
import { addComment, deleteComment } from "@/app/actions/reports";
import { setCommentHidden } from "@/app/actions/moderation";
import { cn } from "@/lib/utils";

type Comment = {
  id: string;
  body: string;
  isOfficial: boolean;
  isHidden: boolean;
  photos: string[];
  createdAt: string;
  authorId: string;
  authorName: string | null;
  authorAvatar: string | null;
  parentId: string | null;
};

type PendingPhoto = { id: string; blob: Blob; preview: string };

const MAX_COMMENT_PHOTOS = 3;

type Props = {
  reportId: string;
  path: string;
  currentUserId: string | null;
  canModerate: boolean;
  comments: Comment[];
  subscribed: boolean;
};

type FormProps = {
  reportId: string;
  path: string;
  userId: string;
  parentId?: string;
  onDone?: () => void;
};

function CommentForm({ reportId, path, userId, parentId, onDone }: FormProps) {
  const t = useTranslations("report");
  const tc = useTranslations("common");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setProcessing(true);
    const next: PendingPhoto[] = [];
    for (const file of Array.from(files).slice(0, MAX_COMMENT_PHOTOS - photos.length)) {
      try {
        const blob = await compressPhoto(file);
        next.push({ id: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob) });
      } catch {
        toast.error(tc("error"));
      }
    }
    setPhotos((current) => [...current, ...next]);
    setProcessing(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const photo = current.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.preview);
      return current.filter((p) => p.id !== id);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && photos.length === 0) return;
    startTransition(async () => {
      const supabase = createClient();
      const paths: string[] = [];
      for (const photo of photos) {
        const storagePath = `${userId}/${crypto.randomUUID()}.${PHOTO_EXT}`;
        const { error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(storagePath, photo.blob, { contentType: PHOTO_MIME });
        if (error) {
          if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
          toast.error(tc("error"));
          return;
        }
        paths.push(storagePath);
      }
      const result = await addComment({ reportId, body, photos: paths, parentId }, path);
      if (result.ok) {
        setBody("");
        photos.forEach((p) => URL.revokeObjectURL(p.preview));
        setPhotos([]);
        onDone?.();
      } else {
        if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
        toast.error(tc("error"));
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? t("replyPlaceholder") : t("commentPlaceholder")}
        maxLength={2000}
        rows={parentId ? 2 : 3}
        aria-label={parentId ? t("reply") : t("addComment")}
        autoFocus={Boolean(parentId)}
      />
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative size-14 overflow-hidden rounded-lg border bg-muted">
            <Image src={photo.preview} alt="" fill className="object-cover" unoptimized />
            <button
              type="button"
              onClick={() => removePhoto(photo.id)}
              className="absolute top-0.5 right-0.5 rounded-full bg-background/90 p-0.5 text-foreground shadow-sm"
              aria-label={t("removePhoto")}
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {photos.length < MAX_COMMENT_PHOTOS && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => fileInput.current?.click()}
            disabled={processing || pending}
          >
            {processing ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            {t("addPhoto")}
          </Button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addPhotos(e.target.files)}
        />
        {parentId && onDone && (
          <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>
            {tc("cancel")}
          </Button>
        )}
        <Button type="submit" className="ml-auto" disabled={pending || processing || (!body.trim() && photos.length === 0)}>
          {pending && <Loader2 className="animate-spin" />}
          {parentId ? t("postReply") : t("postComment")}
        </Button>
      </div>
    </form>
  );
}

export function Comments({ reportId, path, currentUserId, canModerate, comments, subscribed }: Props) {
  const t = useTranslations("report");
  const tc = useTranslations("common");
  const tm = useTranslations("moderation");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Flatten threads: every reply is grouped under its top-level comment.
  const { roots, replies } = useMemo(() => {
    const byId = new Map(comments.map((c) => [c.id, c]));
    const rootOf = (comment: Comment): Comment => {
      let current = comment;
      const seen = new Set<string>([comment.id]);
      while (current.parentId && byId.has(current.parentId) && !seen.has(current.parentId)) {
        seen.add(current.parentId);
        current = byId.get(current.parentId)!;
      }
      return current;
    };
    const roots: Comment[] = [];
    const replies = new Map<string, Comment[]>();
    for (const comment of comments) {
      if (!comment.parentId || !byId.has(comment.parentId)) {
        roots.push(comment);
        continue;
      }
      const root = rootOf(comment);
      const list = replies.get(root.id);
      if (list) list.push(comment);
      else replies.set(root.id, [comment]);
    }
    return { roots, replies };
  }, [comments]);

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteComment(id, path);
      if (!result.ok) toast.error(tc("error"));
    });
  }

  function toggleHidden(comment: Comment) {
    startTransition(async () => {
      const result = await setCommentHidden(reportId, comment.id, !comment.isHidden);
      if (!result.ok) toast.error(tc("error"));
    });
  }

  function renderComment(comment: Comment, isReply: boolean) {
    const parent = comment.parentId ? comments.find((c) => c.id === comment.parentId) : undefined;
    const deepReply = isReply && parent?.parentId;
    return (
      <div className="flex gap-3">
        <Avatar className={isReply ? "size-7" : "size-8"}>
          {comment.authorAvatar && <AvatarImage src={comment.authorAvatar} alt="" />}
          <AvatarFallback className="text-xs">{initials(comment.authorName)}</AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "min-w-0 flex-1",
            comment.isHidden && "opacity-60",
            comment.isOfficial && "rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5",
          )}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="font-medium">{comment.authorName || t("anonymous")}</span>
            {comment.isOfficial && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                <BadgeCheck className="size-3.5" />
                {t("official")}
              </span>
            )}
            <TimeAgo date={comment.createdAt} className="text-xs text-muted-foreground" />
            <div className="ml-auto flex items-center gap-3">
              {comment.isHidden && <span className="text-xs font-medium text-amber-700">{tm("hidden")}</span>}
              {canModerate && (
                <button
                  onClick={() => toggleHidden(comment)}
                  disabled={pending}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={comment.isHidden ? tm("show") : tm("hide")}
                  title={comment.isHidden ? tm("show") : tm("hide")}
                >
                  {comment.isHidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </button>
              )}
              {currentUserId && comment.authorId !== currentUserId && !canModerate && (
                <FlagButton reportId={reportId} commentId={comment.id} compact />
              )}
              {(comment.authorId === currentUserId || canModerate) && (
                <button
                  onClick={() => remove(comment.id)}
                  disabled={pending}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={t("deleteComment")}
                  title={t("deleteComment")}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
              {currentUserId && (
                <button
                  onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs",
                    replyTo === comment.id ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={t("reply")}
                >
                  <Reply className="size-3.5" />
                  {t("reply")}
                </button>
              )}
            </div>
          </div>
          {deepReply && parent && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("replyTo", { name: parent.authorName || t("anonymous") })}
            </p>
          )}
          {comment.body && <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{comment.body}</p>}
          {comment.photos.length > 0 && <PhotoGallery paths={comment.photos} className="mt-2 max-w-sm" />}
          {replyTo === comment.id && currentUserId && (
            <div className="mt-3">
              <CommentForm
                reportId={reportId}
                path={path}
                userId={currentUserId}
                parentId={comment.id}
                onDone={() => setReplyTo(null)}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <section id="comments" className="mt-10 scroll-mt-20 border-t pt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">
          {t("comments")} <span className="font-normal text-muted-foreground">{comments.length}</span>
        </h2>
        <SubscribeButton reportId={reportId} subscribed={subscribed} signedIn={Boolean(currentUserId)} path={path} />
      </div>

      <ul className="mt-5 space-y-5">
        {roots.map((comment) => (
          <li key={comment.id}>
            {renderComment(comment, false)}
            {(replies.get(comment.id)?.length ?? 0) > 0 && (
              <ul className="mt-4 ml-4 space-y-4 border-l-2 border-border/60 pl-4 sm:ml-5 sm:pl-5">
                {replies.get(comment.id)!.map((reply) => (
                  <li key={reply.id}>{renderComment(reply, true)}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {comments.length === 0 && <li className="text-sm text-muted-foreground">{t("noComments")}</li>}
      </ul>

      {currentUserId ? (
        <div className="mt-6">
          <CommentForm reportId={reportId} path={path} userId={currentUserId} />
        </div>
      ) : (
        <p className="mt-6 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <Link href={`/login?next=${encodeURIComponent(path)}`} className="font-medium text-foreground underline underline-offset-4">
            {tc("signIn")}
          </Link>{" "}
          · {t("signInToComment")}
        </p>
      )}
    </section>
  );
}
