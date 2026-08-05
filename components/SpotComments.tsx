'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { EyeOff, MessageSquare, Send, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useDeleteSpotComment, useHideSpotComment, usePostSpotComment, useSpotComments } from '@/hooks/useSpotComments';
import { COMMENT_MAX_LENGTH, type SpotCommentDTO } from '@/lib/spotContent';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useT } from '@/components/i18n/I18nProvider';

/**
 * Sección «Comentarios» del detalle de plaza (roadmap nº9): lista con autor
 * y fecha relativa, formulario con contador (500) y moderación (el autor
 * borra; MODERATOR/ADMIN ocultan).
 */
export function SpotComments({ spotId }: { spotId: number }) {
  const { data: session } = useSession();
  const { data: comments, isLoading } = useSpotComments(spotId);
  const t = useT();

  const isModerator = session?.user.role === 'MODERATOR' || session?.user.role === 'ADMIN';

  return (
    <Card className="home-fade-up home-fade-up-delay-2 rounded-2xl shadow-elevated">
      <CardHeader>
        <CardTitle className="text-lg font-bold tracking-tight">{t.comments.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {session?.user ? (
          <CommentForm spotId={spotId} />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t.comments.loginPrompt}</p>
            <Button asChild className="btn-cta min-h-11">
              <Link href="/login">{t.auth.login}</Link>
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : !comments || comments.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            {t.comments.empty}
          </p>
        ) : (
          <ul className="space-y-1">
            {comments.map((comment, index) => (
              <li key={comment.id}>
                {index > 0 ? <Separator className="my-3" /> : null}
                <CommentItem
                  comment={comment}
                  spotId={spotId}
                  canDelete={session?.user.id === comment.authorId}
                  canHide={isModerator && session?.user.id !== comment.authorId}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CommentItem({
  comment,
  spotId,
  canDelete,
  canHide,
}: {
  comment: SpotCommentDTO;
  spotId: number;
  canDelete: boolean;
  canHide: boolean;
}) {
  const deleteComment = useDeleteSpotComment(spotId);
  const hideComment = useHideSpotComment(spotId);
  const t = useT();

  return (
    <div className="group flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-semibold">{comment.authorName}</span>{' '}
          <span className="text-xs text-muted-foreground">
            · {formatRelativeTime(new Date(comment.createdAt), t.time)}
          </span>
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/90">{comment.body}</p>
      </div>
      {canDelete ? (
        <button
          type="button"
          onClick={() => deleteComment.mutate(comment.id)}
          disabled={deleteComment.isPending}
          aria-label={t.comments.deleteMine}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : canHide ? (
        <button
          type="button"
          onClick={() => hideComment.mutate(comment.id)}
          disabled={hideComment.isPending}
          aria-label={t.comments.hideModeration}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function CommentForm({ spotId }: { spotId: number }) {
  const postComment = usePostSpotComment(spotId);
  const [body, setBody] = useState('');
  const t = useT();

  const trimmed = body.trim();
  const tooLong = body.length > COMMENT_MAX_LENGTH;
  const canSubmit = trimmed.length > 0 && !tooLong && !postComment.isPending;

  const submit = () => {
    if (!canSubmit) return;
    postComment.mutate(trimmed, { onSuccess: () => setBody('') });
  };

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor="spot-comment-body" className="sr-only">
        {t.comments.writeLabel}
      </label>
      <textarea
        id="spot-comment-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={t.comments.placeholder}
        className="flex min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn('text-xs', tooLong ? 'font-semibold text-destructive' : 'text-muted-foreground')}
          aria-live="polite"
        >
          {body.length}/{COMMENT_MAX_LENGTH}
        </span>
        <Button type="submit" className="btn-cta min-h-11 gap-2" disabled={!canSubmit}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {postComment.isPending ? t.comments.publishing : t.comments.publish}
        </Button>
      </div>
    </form>
  );
}
