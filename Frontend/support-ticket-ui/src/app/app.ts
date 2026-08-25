import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { UserRole } from './core/models/enums';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = 'Support Ticket Management System';
  protected readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  protected readonly UserRole = UserRole;
  private readonly router = inject(Router);

  constructor() {
    // Every existing <mat-icon>name</mat-icon> in the app keeps working unchanged — Material
    // Symbols Outlined uses the same ligature names as the legacy Material Icons font.
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
  }

  protected get initials(): string {
    const user = this.authService.currentUser();
    if (!user) {
      return '';
    }
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  }

  protected logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
