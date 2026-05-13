import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ExecutionService } from '../../core/services/execution.service';
import { LiveRefreshService } from '../../core/services/live-refresh.service';
import { ProjectService } from '../../core/services/project.service';
import { LanguageInfo, Project } from '../../core/models/codesync.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly projectService = inject(ProjectService);
  private readonly executionService = inject(ExecutionService);
  private readonly liveRefreshService = inject(LiveRefreshService);
  private readonly subscriptions = new Subscription();

  projects: Project[] = [];
  filteredProjects: Project[] = [];
  languages: LanguageInfo[] = [];
  searchTerm = '';
  selectedLanguage = '';
  guestMode = false;
  loading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.guestMode = this.route.snapshot.data['guestMode'] === true;

    if (!this.guestMode) {
      this.subscriptions.add(
        this.liveRefreshService.poll(() => this.executionService.getSupportedLanguages(), 60000).subscribe((result) => {
          this.languages = result.ok ? result.data : [];
          this.loading = false;
        })
      );
      return;
    }

    this.subscriptions.add(
      this.liveRefreshService
        .poll(() =>
          forkJoin({
            projects: this.projectService.getPublicProjects(),
            languages: this.executionService.getSupportedLanguages()
          })
        )
        .subscribe((result) => {
          if (result.ok) {
            this.projects = this.sortProjects(result.data.projects);
            this.languages = result.data.languages;
            this.applyFilters();
            this.loading = false;
            return;
          }

          if (this.loading) {
            this.errorMessage = 'Unable to load public projects right now.';
            this.languages = [];
            this.loading = false;
          }
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  applyFilters(): void {
    const search = this.searchTerm.trim().toLowerCase();
    const language = this.selectedLanguage.trim().toLowerCase();

    this.filteredProjects = this.projects.filter((project) => {
      const matchesSearch = !search || this.getProjectSearchText(project).includes(search);
      const matchesLanguage = !language || project.language.toLowerCase() === language;

      return matchesSearch && matchesLanguage;
    });
  }

  getOwnerLabel(project: Project): string {
    return (
      project.ownerUsername ||
      project.ownerFullName ||
      project.owner?.username ||
      project.owner?.fullName ||
      `Owner #${project.ownerId}`
    );
  }

  getContributorLabels(project: Project): string[] {
    const contributorNames = project.contributors
      ?.map((contributor) => contributor.username || contributor.fullName || contributor.email || this.formatUserId(contributor.userId))
      .filter((name): name is string => !!name);

    const labels = contributorNames?.length
      ? contributorNames
      : project.contributorUsernames?.length
        ? project.contributorUsernames
        : project.contributorIds?.map((userId) => this.formatUserId(userId));

    return labels?.length ? this.uniqueLabels(labels) : [this.getOwnerLabel(project)];
  }

  private sortProjects(projects: Project[]): Project[] {
    return [...projects].sort((left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  }

  private getProjectSearchText(project: Project): string {
    return [
      project.projectName,
      project.description,
      project.language,
      project.visibility,
      String(project.ownerId),
      this.getOwnerLabel(project),
      ...this.getContributorLabels(project)
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  private formatUserId(userId?: number): string {
    return userId ? `User #${userId}` : '';
  }

  private uniqueLabels(labels: string[]): string[] {
    return Array.from(new Set(labels.map((label) => label.trim()).filter(Boolean)));
  }
}
