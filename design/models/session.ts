export interface Project {
  id: string;
  name: string;
  path: string;
}

export interface Chat {
  id: string;
  title: string;
  projectId: string;
  branch: string;
  time: string;
  status?: string;
}
