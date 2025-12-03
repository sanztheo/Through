"use client";

interface TitleBarProps {
  title?: string;
}

export function TitleBar({
  title = "Through - Project Analyzer",
}: TitleBarProps) {
  return (
    <div className="h-10 bg-white border-b border-gray-200 flex items-center justify-between px-4 draggable">
      <div className="flex items-center gap-2">
        <div className="flex gap-2">
          <button className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors non-draggable" />
          <button className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors non-draggable" />
          <button className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors non-draggable" />
        </div>
      </div>
      <div className="absolute left-1/2 transform -translate-x-1/2 text-sm text-gray-700 font-medium">
        {title}
      </div>
      <div className="w-16" /> {/* Spacer for centering */}
    </div>
  );
}
