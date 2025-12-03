interface ProjectItemProps {
  name: string;
  path: string;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function ProjectItem({
  name,
  path,
  onClick,
  onContextMenu,
}: ProjectItemProps) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="w-full hover:bg-gray-50 rounded-md p-3 flex justify-between items-center transition-colors cursor-pointer"
    >
      <span className="font-medium text-black text-sm">{name}</span>
      <span className="text-xs text-gray-400 font-mono">{path}</span>
    </button>
  );
}
