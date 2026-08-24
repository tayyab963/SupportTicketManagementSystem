import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiErrorResponse } from '../../../../core/models/api-response.model';
import { CommentItem } from '../../../../core/models/ticket.model';
import { TicketService } from '../../../../core/services/ticket.service';

/**
 * Reusable comments panel: loads and lists a ticket's comments, and — when `canComment` is true —
 * offers a post form. The backend is the sole authority on who may comment; `canComment` only
 * avoids showing a form that would be rejected server-side (e.g. an unassigned agent).
 */
@Component({
  selector: 'app-comments-section',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, MatSnackBarModule],
  template: `
    <section class="comments-section">
      <h3>Comments</h3>

      @if (loading()) {
        <mat-progress-spinner diameter="24" mode="indeterminate" />
      } @else if (loadError()) {
        <p class="error-message">{{ loadError() }}</p>
      } @else if (comments().length === 0) {
        <p class="empty-state">No comments yet.</p>
      } @else {
        <ul class="comment-list">
          @for (comment of comments(); track comment.id) {
            <li>
              <div class="comment-meta">
                <strong>{{ comment.userName }}</strong>
                <span class="comment-role">{{ comment.userRole }}</span>
                <span class="comment-date">{{ comment.createdAt | date: 'medium' }}</span>
              </div>
              <p>{{ comment.commentText }}</p>
            </li>
          }
        </ul>
      }

      @if (canComment) {
        <form [formGroup]="commentForm" (ngSubmit)="submit()" class="comment-form">
          <mat-form-field appearance="outline">
            <mat-label>Add a comment</mat-label>
            <textarea matInput formControlName="commentText" rows="3"></textarea>
          </mat-form-field>
          @if (actionError()) {
            <p class="error-message">{{ actionError() }}</p>
          }
          <button mat-flat-button color="primary" type="submit" [disabled]="commentForm.invalid || submitting()">
            Post Comment
          </button>
        </form>
      }
    </section>
  `,
  styles: [`
    .comments-section h3 { margin: 0 0 8px; font-size: 0.95rem; }
    .comment-list { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 12px; }
    .comment-list li { border-left: 3px solid var(--mat-sys-outline-variant); padding-left: 10px; }
    .comment-list p { margin: 4px 0 0; white-space: pre-wrap; }
    .comment-meta { display: flex; gap: 8px; align-items: baseline; font-size: 0.8rem; }
    .comment-role { opacity: 0.6; }
    .comment-date { opacity: 0.5; margin-left: auto; }
    .comment-form { display: flex; flex-direction: column; gap: 4px; max-width: 480px; }
    .error-message { color: var(--mat-sys-error); font-size: 0.875rem; }
    .empty-state { opacity: 0.7; }
  `]
})
export class CommentsSectionComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly ticketService = inject(TicketService);
  private readonly snackBar = inject(MatSnackBar);

  @Input({ required: true }) ticketId!: string;
  @Input() canComment = false;
  @Output() readonly commentAdded = new EventEmitter<void>();

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly comments = signal<CommentItem[]>([]);
  protected readonly submitting = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly commentForm = this.fb.nonNullable.group({
    commentText: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ticketId'] && !changes['ticketId'].firstChange) {
      this.load();
    }
  }

  reload(): void {
    this.load();
  }

  protected submit(): void {
    if (this.commentForm.invalid) {
      return;
    }

    this.submitting.set(true);
    this.actionError.set(null);
    this.ticketService.addComment(this.ticketId, this.commentForm.getRawValue()).subscribe({
      next: () => {
        this.commentForm.reset({ commentText: '' });
        this.submitting.set(false);
        this.load();
        this.commentAdded.emit();
        this.snackBar.open('Comment posted.', 'Dismiss', { duration: 3000 });
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        const body = error.error as ApiErrorResponse | undefined;
        this.actionError.set(body?.message ?? 'That comment could not be posted. Please try again.');
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.ticketService.getComments(this.ticketId).subscribe({
      next: (comments) => {
        this.comments.set(comments);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Could not load comments.');
      }
    });
  }
}
