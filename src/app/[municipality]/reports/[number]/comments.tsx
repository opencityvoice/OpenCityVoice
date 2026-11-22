"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BadgeCheck, Eye, EyeOff, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TimeAgo } from "@/components/report-bits";
import { initials } from "@/components/user-menu";
import { FlagButton } from "@/components/flag-button";
import { PhotoGallery } from "@/components/photo-gallery";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/config";
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
};

type PendingPhoto = { id: string; blob: Blob; preview: string };

const MAX_COMMENT_PHOTOS = 3;

type Props = {
  reportId: string;
  path: string;
  currentUserId: string | null;
  canModerate: boolean;
  comments: Comment[];
};

export function Comments({ reportId, path, currentUserId, canModerate, comments }: Props) {
  const t = useTranslations("report");
  const tc = useTranslations("common");
  const tm = useTranslations("moderation");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setProcessing(true);
    const { default: imageCompression } = await import("browser-image-compression");
    const next: PendingPhoto[] = [];
    for (const file of Array.from(files).slice(0, MAX_COMMENT_PHOTOS - photos.length)) {
      try {
        const blob = await imageCompression(file, {
          maxWidthOrHeight: 1600,
          maxSizeMB: 0.7,
          fileType: "image/jpeg",
          initialQuality: 0.82,
          useWebWorker: true,
        });
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
        const storagePath = `${currentUserId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(storagePath, photo.blob, { contentType: "image/jpeg" });
        if (error) {
          toast.error(tc("error"));
          return;
        }
        paths.push(storagePath);
      }
      const result = await addComment({ reportId, body, photos: paths }, path);
      if (result.ok) {
        setBody("");
        photos.forEach((p) => URL.revokeObjectURL(p.preview));
        setPhotos([]);
      } else toast.error(tc("error"));
    });
  }

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

  return (
    <section id="comments" className="mt-10 scroll-mt-20 border-t pt-8">
      <h2 className="font-semibold">
        {t("comments")} <span className="font-normal text-muted-foreground">{comments.length}</span>
      </h2>

      <ul className="mt-5 space-y-5">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar className="size-8">
              {c.authorAvatar && <AvatarImage src={c.authorAvatar} alt="" />}
              <AvatarFallback className="text-xs">{initials(c.authorName)}</AvatarFallback>
            </Avatar>
            <div
              className={cn(
                "min-w-0 flex-1",
                c.isHidden && "opacity-60",
                c.isOfficial && "rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <span className="font-medium">{c.authorName || t("anonymous")}</span>
                {c.isOfficial && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <BadgeCheck className="size-3.5" />
                    {t("official")}
                  </span>
                )}
                <TimeAgo date={c.createdAt} className="text-xs text-muted-foreground" />
                <div className="ml-auto flex items-center gap-3">
                  {c.isHidden && <span className="text-xs font-medium text-amber-700">{tm("hidden")}</span>}
                  {canModerate && (
                    <button
                      onClick={() => toggleHidden(c)}
                      disabled={pending}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={c.isHidden ? tm("show") : tm("hide")}
                      title={c.isHidden ? tm("show") : tm("hide")}
                    >
                      {c.isHidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    </button>
                  )}
                  {currentUserId && c.authorId !== currentUserId && !canModerate && (
                    <FlagButton reportId={reportId} commentId={c.id} compact />
                  )}
                  {(c.authorId === currentUserId || canModerate) && (
                    <button
                      onClick={() => remove(c.id)}
                      disabled={pending}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t("deleteComment")}
                      title={t("deleteComment")}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {c.body && <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{c.body}</p>}
              {c.photos.length > 0 && <PhotoGallery paths={c.photos} className="mt-2 max-w-sm" />}
            </div>
          </li>
        ))}
        {comments.length === 0 && <li className="text-sm text-muted-foreground">{t("noComments")}</li>}
      </ul>

      {currentUserId ? (
        <form onSubmit={submit} className="mt-6 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("commentPlaceholder")}
            maxLength={2000}
            rows={3}
            aria-label={t("addComment")}
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
            <Button type="submit" className="ml-auto" disabled={pending || processing || (!body.trim() && photos.length === 0)}>
              {pending && <Loader2 className="animate-spin" />}
              {t("postComment")}
            </Button>
          </div>
        </form>
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
