import { useState, useRef, useEffect, useCallback } from "react";
import { ServerInstance } from "../_types";

interface UseBrowserViewProps {
  api: any;
  showTerminal: boolean;
  viewMode: "browser" | "editor";
  firstRunningServer: ServerInstance | undefined;
  showSidebar?: boolean;
}

export function useBrowserView({
  api,
  showTerminal,
  viewMode,
  firstRunningServer,
  showSidebar,
}: UseBrowserViewProps) {
  const [browserViewReady, setBrowserViewReady] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [browserTabs, setBrowserTabs] = useState<
    Array<{ id: string; title: string; url: string; isActive: boolean }>
  >([]);
  const [activeBrowserTabId, setActiveBrowserTabId] = useState<string | null>(
    null
  );

  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Sync BrowserView bounds
  useEffect(() => {
    if (!api?.setBrowserViewBounds) return;

    const syncBounds = () => {
      if (viewMode === "editor") {
        api.setBrowserViewBounds({ x: -9999, y: -9999, width: 1, height: 1 });
      } else if (previewContainerRef.current && browserViewReady) {
        const rect = previewContainerRef.current.getBoundingClientRect();
        api.setBrowserViewBounds({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    // Use setTimeout to ensure DOM has updated
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(syncBounds);
    }, 50);

    let resizeObserver: ResizeObserver | null = null;

    if (previewContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(syncBounds);
      });
      resizeObserver.observe(previewContainerRef.current);
    }

    window.addEventListener("resize", syncBounds);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", syncBounds);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [viewMode, showTerminal, browserViewReady, api, showSidebar]);

  // Initialize BrowserView
  useEffect(() => {
    const initBrowserView = async () => {
      if (!api?.createBrowserView || !previewContainerRef.current) return;

      try {
        const container = previewContainerRef.current;
        const rect = container.getBoundingClientRect();

        console.log("🌐 Initializing BrowserView with bounds:", {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });

        await api.createBrowserView({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });

        setBrowserViewReady(true);
      } catch (error) {
        console.error("Failed to create BrowserView:", error);
      }
    };

    const timer = setTimeout(initBrowserView, 100);

    return () => {
      clearTimeout(timer);
      if (api?.destroyBrowserView) {
        api.destroyBrowserView().catch(console.error);
      }
    };
  }, [api]);

  // Update bounds when terminal opens/closes
  useEffect(() => {
    const updateBrowserViewBounds = async () => {
      if (
        !api?.setBrowserViewBounds ||
        !previewContainerRef.current ||
        !browserViewReady
      )
        return;

      try {
        const container = previewContainerRef.current;
        const rect = container.getBoundingClientRect();

        // Use container rect directly - layout already handles terminal/sidebar position
        await api.setBrowserViewBounds({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      } catch (error) {
        console.error("Failed to update BrowserView bounds:", error);
      }
    };

    updateBrowserViewBounds();
  }, [showTerminal, browserViewReady, api]);

  // Navigate when server is ready
  useEffect(() => {
    const navigateToServer = async () => {
      if (
        !browserViewReady ||
        !firstRunningServer?.url ||
        !api?.navigateBrowserView
      )
        return;

      try {
        console.log(
          `🔗 Navigating embedded preview to ${firstRunningServer.url}`
        );
        await api.navigateBrowserView(firstRunningServer.url);
        if (api?.canNavigateBrowserView) {
          const navState = await api.canNavigateBrowserView();
          setCanGoBack(navState.canGoBack);
          setCanGoForward(navState.canGoForward);
        }
      } catch (error) {
        console.error("Failed to navigate BrowserView:", error);
      }
    };

    navigateToServer();
  }, [browserViewReady, firstRunningServer?.url, api?.navigateBrowserView]);

  // Listen for tab updates
  useEffect(() => {
    if (!api?.onTabUpdated) return;

    api.onTabUpdated((data: any) => {
      console.log("🔖 Tab updated:", data);
      setBrowserTabs((prev) =>
        prev.map((tab) =>
          tab.id === data.id
            ? { ...tab, title: data.title, url: data.url }
            : tab
        )
      );
    });
  }, [api]);

  // Load initial tabs
  useEffect(() => {
    const loadTabs = async () => {
      if (!api?.getTabs || !browserViewReady) return;

      try {
        const result = await api.getTabs();
        if (result.success && result.tabs) {
          console.log("📂 Loaded tabs:", result.tabs);
          setBrowserTabs(result.tabs);
          const activeTab = result.tabs.find((t: any) => t.isActive);
          if (activeTab) {
            setActiveBrowserTabId(activeTab.id);
          }
        }
      } catch (error) {
        console.error("Failed to load tabs:", error);
      }
    };

    loadTabs();
  }, [api, browserViewReady]);

  // Tab management helpers
  const handleTabClick = async (tabId: string) => {
      if (
        api?.switchTab &&
        tabId !== activeBrowserTabId &&
        previewContainerRef.current
      ) {
        const container = previewContainerRef.current;
        const rect = container.getBoundingClientRect();
        
        // Use the container rect directly - it already accounts for terminal/sidebar
        await api.switchTab(tabId, {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
        setActiveBrowserTabId(tabId);
        setBrowserTabs((prev) =>
          prev.map((t) => ({
            ...t,
            isActive: t.id === tabId,
          }))
        );
      }
  };

  const handleTabClose = async (tabId: string) => {
      if (
        api?.closeTab &&
        browserTabs.length > 1 &&
        previewContainerRef.current
      ) {
        await api.closeTab(tabId);
        setBrowserTabs((prev) =>
          prev.filter((t) => t.id !== tabId)
        );
        if (tabId === activeBrowserTabId) {
          const remaining = browserTabs.filter(
            (t) => t.id !== tabId
          );
          if (remaining.length > 0) {
            const container = previewContainerRef.current;
            const rect = container.getBoundingClientRect();

            await api.switchTab(remaining[0].id, {
              x: Math.round(rect.left),
              y: Math.round(rect.top),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            });
            setActiveBrowserTabId(remaining[0].id);
          }
        }
      }
  };

  const handleNewTab = async () => {
    if (!api?.createTab || !previewContainerRef.current) return;

    const container = previewContainerRef.current;
    const rect = container.getBoundingClientRect();

    try {
      const serverUrl = firstRunningServer?.url;
      // Use the container rect directly - it already accounts for terminal/sidebar
      const result = await api.createTab({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        url: serverUrl,
      });

      if (result.success) {
        setBrowserTabs((prev) =>
          prev.map((t) => ({ ...t, isActive: false }))
        );
        setBrowserTabs((prev) => [
          ...prev,
          {
            id: result.tabId,
            title: result.title || serverUrl || "New Tab",
            url: result.url || serverUrl || "",
            isActive: true,
          },
        ]);
        setActiveBrowserTabId(result.tabId);
      }
    } catch (error) {
      console.error("Failed to create new tab:", error);
    }
  };

  const handleGoBack = async () => {
    if (api?.goBackBrowserView) {
        const result = await api.goBackBrowserView();
        if (api?.canNavigateBrowserView) {
          const navState = await api.canNavigateBrowserView();
          setCanGoBack(navState.canGoBack);
          setCanGoForward(navState.canGoForward);
        }
      }
  };

  const handleGoForward = async () => {
    if (api?.goForwardBrowserView) {
        const result = await api.goForwardBrowserView();
        if (api?.canNavigateBrowserView) {
          const navState = await api.canNavigateBrowserView();
          setCanGoBack(navState.canGoBack);
          setCanGoForward(navState.canGoForward);
        }
      }
  };

  const handleReload = async () => {
    if (api?.reloadBrowserView) {
        await api.reloadBrowserView();
      }
  };

  return {
    browserViewReady,
    previewContainerRef,
    canGoBack,
    canGoForward,
    browserTabs,
    activeBrowserTabId,
    setBrowserTabs,
    setActiveBrowserTabId,
    setCanGoBack,
    setCanGoForward,
    handleTabClick,
    handleTabClose,
    handleNewTab,
    handleGoBack,
    handleGoForward,
    handleReload
  };
}
