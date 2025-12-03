import { ProjectItem } from "./ProjectItem";

interface Project {
  path: string;
  name: string;
  framework: string;
  startCommand: string;
  port: number;
  analyzedAt: string;
}

interface ProjectListProps {
  projects: Project[];
  onProjectClick: (project: Project) => void;
  onProjectContextMenu: (e: React.MouseEvent, project: Project) => void;
}

export function ProjectList({
  projects,
  onProjectClick,
  onProjectContextMenu,
}: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <p className="text-gray-500 text-sm">No recent projects yet</p>
        <p className="text-gray-400 text-xs mt-2">
          Open a project to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {projects.map((project) => (
        <ProjectItem
          key={project.path}
          name={project.name}
          path={project.path}
          onClick={() => onProjectClick(project)}
          onContextMenu={(e) => onProjectContextMenu(e, project)}
        />
      ))}
    </div>
  );
}
