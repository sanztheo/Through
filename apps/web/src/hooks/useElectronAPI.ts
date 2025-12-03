import { useEffect, useState } from "react";

export function useElectronAPI() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(typeof window !== "undefined" && !!window.electronAPI);
  }, []);

  return {
    isElectron,
    api: isElectron ? window.electronAPI : null,
  };
}
