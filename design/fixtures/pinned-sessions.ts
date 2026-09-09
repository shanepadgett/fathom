import type { Chat, Project } from "../models/session.ts";

import { chats, projects } from "./sessions.ts";

export const pinnedProjects: Project[] = [
  ...projects,
  { id: "atlas", name: "Atlas documentation platform", path: "~/dev/atlas" },
  { id: "harbor", name: "Harbor", path: "~/dev/harbor" },
  { id: "orbit", name: "Orbit mobile", path: "~/dev/orbit" },
  { id: "metrics", name: "Infrastructure metrics dashboard", path: "~/dev/metrics" },
];

export const pinnedSessions: Chat[] = [
  chats[0],
  {
    id: "atlas-search",
    title: "Improve search ranking for nested documentation pages",
    projectId: "atlas",
    branch: "feature/documentation-search-ranking-and-keyboard-navigation",
    time: "12m",
    activity: "attention",
    unread: true,
  },
  ...chats.slice(1),
  {
    id: "harbor-retry",
    title: "Retry interrupted uploads",
    projectId: "harbor",
    branch: "fix/resumable-uploads",
    time: "2d",
    activity: "completed",
    unread: true,
  },
  {
    id: "orbit-settings",
    title: "Polish account settings",
    projectId: "orbit",
    branch: "feature/account-settings",
    time: "2d",
  },
  {
    id: "metrics-cache",
    title: "Investigate stale deployment metrics",
    projectId: "metrics",
    branch: "fix/invalidate-cached-metrics-after-deployment-rollbacks",
    time: "3d",
    activity: "attention",
  },
  {
    id: "atlas-links",
    title: "Check broken reference links",
    projectId: "atlas",
    branch: "chore/link-audit",
    time: "3d",
    activity: "completed",
  },
  {
    id: "harbor-auth",
    title: "Refresh expired credentials",
    projectId: "harbor",
    branch: "fix/token-refresh",
    time: "4d",
  },
  {
    id: "orbit-offline",
    title: "Keep drafts available offline",
    projectId: "orbit",
    branch: "feature/offline-draft-storage-and-background-sync",
    time: "4d",
    activity: "completed",
    unread: true,
  },
  {
    id: "metrics-filters",
    title: "Save dashboard filters",
    projectId: "metrics",
    branch: "feature/saved-filters",
    time: "5d",
  },
  {
    id: "atlas-theme",
    title: "Review code block contrast",
    projectId: "atlas",
    branch: "design/code-themes",
    time: "5d",
  },
  {
    id: "harbor-tests",
    title: "Cover multipart upload edge cases",
    projectId: "harbor",
    branch: "test/multipart-boundaries",
    time: "6d",
    activity: "completed",
  },
  {
    id: "orbit-release",
    title: "Prepare release notes",
    projectId: "orbit",
    branch: "release/2.4",
    time: "1w",
  },
  {
    id: "metrics-export",
    title: "Export filtered usage reports",
    projectId: "metrics",
    branch: "feature/export-filtered-usage-reports-as-csv",
    time: "1w",
  },
];

export const pinnedSessionIds = ["rename", "atlas-search"];
