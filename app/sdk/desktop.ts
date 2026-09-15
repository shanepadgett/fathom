export interface NotificationTarget {
  projectId: string;
  sessionId: string;
}

export interface DesktopNotification {
  title: string;
  body: string;
  target?: NotificationTarget;
}

export interface DesktopBindings {
  notificationPermission(request?: boolean): Promise<NotificationPermission>;
  showNotification(value: DesktopNotification): Promise<boolean>;
}
