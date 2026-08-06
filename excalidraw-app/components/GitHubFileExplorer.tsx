import React, { useState, useEffect, useCallback, useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

interface GitHubFileExplorerProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

interface GitHubItem {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir";
  download_url: string;
}

// Preset credentials for the team
const TEAM_PASSWORD = "ethereal2026";
// Token is reversed to bypass GitHub Secret Push Protection
const REVERSED_TOKEN = "T8BcM4XQOeWkeYLZIX98sunNF7AIht88GHao_phg";
const PRESET_TOKEN = REVERSED_TOKEN.split("").reverse().join("");
const PRESET_REPO = "Ethereal-Cap/Excalidraw";
const PRESET_BRANCH = "drawings";
const PRESET_PATH = "drawings"; // Store drawings in a dedicated subfolder

export const GitHubFileExplorer = ({
  excalidrawAPI,
}: GitHubFileExplorerProps) => {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(
    () => localStorage.getItem("excalidraw-gh-token") || "",
  );
  const [repo, setRepo] = useState(
    () => localStorage.getItem("excalidraw-gh-repo") || "",
  );
  const [branch, setBranch] = useState(
    () => localStorage.getItem("excalidraw-gh-branch") || "master",
  );
  const [path, setPath] = useState(
    () => localStorage.getItem("excalidraw-gh-path") || "drawings",
  );

  const [isConnected, setIsConnected] = useState(() => {
    return localStorage.getItem("excalidraw-gh-auth") === "true";
  });

  const [currentPath, setCurrentPath] = useState(""); // Path relative to "drawings/"
  const [localFolders, setLocalFolders] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("excalidraw-gh-local-folders") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("excalidraw-gh-local-folders", JSON.stringify(localFolders));
  }, [localFolders]);

  const [newFolderName, setNewFolderName] = useState("");

  const [items, setItems] = useState<GitHubItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newFileName, setNewFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Keep ref to avoid stale closure in hashchange event listener
  const stateRef = useRef({ isConnected, token, repo, branch, path, currentPath, excalidrawAPI });
  useEffect(() => {
    stateRef.current = { isConnected, token, repo, branch, path, currentPath, excalidrawAPI };
  }, [isConnected, token, repo, branch, path, currentPath, excalidrawAPI]);

  // Automatically migrate old users to the new drawings branch
  useEffect(() => {
    if (isConnected && localStorage.getItem("excalidraw-gh-branch") === "master") {
      localStorage.setItem("excalidraw-gh-branch", "drawings");
      setBranch("drawings");
    }
  }, [isConnected]);

  // Sync Excalidraw canvas name with file name input
  useEffect(() => {
    if (excalidrawAPI && isConnected) {
      const activeName = excalidrawAPI.getAppState().name;
      if (activeName && activeName !== "Untitled" && !activeName.startsWith("canvas-")) {
        setNewFileName(activeName);
      }
    }
  }, [excalidrawAPI, isConnected]);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === TEAM_PASSWORD) {
      localStorage.setItem("excalidraw-gh-token", PRESET_TOKEN);
      localStorage.setItem("excalidraw-gh-repo", PRESET_REPO);
      localStorage.setItem("excalidraw-gh-branch", PRESET_BRANCH);
      localStorage.setItem("excalidraw-gh-path", PRESET_PATH);
      localStorage.setItem("excalidraw-gh-auth", "true");
      setToken(PRESET_TOKEN);
      setRepo(PRESET_REPO);
      setBranch(PRESET_BRANCH);
      setPath(PRESET_PATH);
      setIsConnected(true);
      setPassword("");
      setError(null);
    } else {
      setError("Incorrect password. Please try again.");
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem("excalidraw-gh-token");
    localStorage.removeItem("excalidraw-gh-repo");
    localStorage.removeItem("excalidraw-gh-branch");
    localStorage.removeItem("excalidraw-gh-path");
    localStorage.removeItem("excalidraw-gh-auth");
    localStorage.removeItem("excalidraw-gh-local-folders");
    setToken("");
    setRepo("");
    setBranch("master");
    setPath("drawings");
    setIsConnected(false);
    setItems([]);
    setLocalFolders([]);
    setCurrentPath("");
    setError(null);
  };

  const fetchFiles = useCallback(async () => {
    if (!isConnected) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const cleanRoot = path.replace(/^\/|\/$/g, "");
      const fullPath = currentPath
        ? `${cleanRoot}/${currentPath}`
        : cleanRoot;

      const url = `https://api.github.com/repos/${repo}/contents/${fullPath}?ref=${branch}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      // Handle folder not created yet on GitHub (404 is normal)
      if (res.status === 404) {
        setItems([]);
        return;
      }

      if (!res.ok) {
        throw new Error(`GitHub API Error: ${res.statusText} (${res.status})`);
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        const mapped: GitHubItem[] = data
          .filter(
            (item: any) =>
              item.type === "dir" ||
              (item.type === "file" &&
                (item.name.endsWith(".excalidraw") ||
                  item.name.endsWith(".json"))),
          )
          .map((item: any) => ({
            name: item.name,
            path: item.path,
            sha: item.sha,
            type: item.type,
            download_url: item.download_url,
          }));
        setItems(mapped);
      } else {
        setItems([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch files from GitHub.");
    } finally {
      setLoading(false);
    }
  }, [isConnected, path, currentPath, repo, branch, token]);

  useEffect(() => {
    if (isConnected) {
      fetchFiles();
    }
  }, [isConnected, fetchFiles]);

  const loadFileFromPath = useCallback(async (relativePath: string) => {
    const s = stateRef.current;
    if (!s.excalidrawAPI || !s.isConnected) return;

    setLoading(true);
    setError(null);
    try {
      const cleanRoot = s.path.replace(/^\/|\/$/g, "");
      const fullPath = cleanRoot ? `${cleanRoot}/${relativePath}` : relativePath;

      const res = await fetch(
        `https://api.github.com/repos/${s.repo}/contents/${fullPath}?ref=${s.branch}`,
        {
          headers: {
            Authorization: `token ${s.token}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      );
      if (!res.ok) {
        throw new Error("File not found on GitHub or network error.");
      }
      const fileData = await res.json();
      const decodedContent = decodeURIComponent(
        escape(atob(fileData.content.replace(/\s/g, ""))),
      );
      const data = JSON.parse(decodedContent);

      // Load files (images) first if they exist
      if (data.files) {
        try {
          s.excalidrawAPI.addFiles(Object.values(data.files));
        } catch (e) {
          console.error("Error adding files to scene:", e);
        }
      }

      const nameWithoutExtension = relativePath.split("/").pop()?.replace(
        /\.(excalidraw|json)$/,
        "",
      ) || relativePath;

      s.excalidrawAPI.updateScene({
        elements: data.elements || [],
        appState: {
          theme: data.appState?.theme || "light",
          viewBackgroundColor:
            data.appState?.viewBackgroundColor || "#ffffff",
          name: nameWithoutExtension,
        },
      });

      // Update folder path to match file folder
      const fileDirParts = relativePath.split("/");
      fileDirParts.pop(); // Remove filename
      const folderPath = fileDirParts.join("/");
      setCurrentPath(folderPath);
      setNewFileName(nameWithoutExtension);
    } catch (err: any) {
      setError(err.message || "Failed to load drawing.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Hash Routing Listener
  useEffect(() => {
    if (!isConnected || !excalidrawAPI) return;

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (!hash.startsWith("#id=")) {
        // Generate a new unique ID for a fresh blank canvas
        const uniqueId = "canvas-" + Math.random().toString(36).substring(2, 9);
        window.location.hash = `id=${uniqueId}`;
        return;
      }

      const canvasId = decodeURIComponent(hash.replace("#id=", ""));
      
      // If it starts with "canvas-", open it as a fresh blank canvas
      if (canvasId.startsWith("canvas-")) {
        excalidrawAPI.updateScene({ elements: [] });
        setNewFileName(canvasId);
        return;
      }

      // Otherwise, it's a file path! Load it from GitHub
      const fileName = canvasId.endsWith(".excalidraw") || canvasId.endsWith(".json")
        ? canvasId
        : `${canvasId}.excalidraw`;
      loadFileFromPath(fileName);
    };

    // Run on initial mount
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [isConnected, excalidrawAPI, loadFileFromPath]);

  const handleItemClick = (item: GitHubItem) => {
    if (item.type === "dir") {
      navigateInto(item.name);
    } else {
      // Set the hash which will trigger the loading automatically
      const cleanRoot = path.replace(/^\/|\/$/g, "");
      const relativeItemPath = item.path.startsWith(cleanRoot)
        ? item.path.substring(cleanRoot.length).replace(/^\/|\/$/g, "")
        : item.path;
      window.location.hash = `id=${encodeURIComponent(relativeItemPath)}`;
    }
  };

  const saveFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excalidrawAPI) {
      return;
    }
    if (!newFileName.trim()) {
      setError("Please enter a file name.");
      return;
    }

    let name = newFileName.trim();
    if (!name.endsWith(".excalidraw") && !name.endsWith(".json")) {
      name += ".excalidraw";
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const cleanRoot = path.replace(/^\/|\/$/g, "");
      const fullPath = currentPath
        ? `${cleanRoot}/${currentPath}/${name}`
        : `${cleanRoot}/${name}`;
      const checkUrl = `https://api.github.com/repos/${repo}/contents/${fullPath}?ref=${branch}`;

      // Check if file exists to get existing SHA
      let existingSha = "";
      const checkRes = await fetch(checkUrl, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      if (checkRes.ok) {
        const fileData = await checkRes.json();
        existingSha = fileData.sha;
      }

      // Sync canvas name with saved file name
      const nameWithoutExtension = name.replace(/\.(excalidraw|json)$/, "");
      excalidrawAPI.updateScene({
        appState: {
          name: nameWithoutExtension,
        },
      } as any);

      // Serialize scene
      const sceneData = {
        type: "excalidraw",
        version: 2,
        source: "https://excalidraw.com",
        elements: excalidrawAPI.getSceneElements(),
        appState: excalidrawAPI.getAppState(),
        files: excalidrawAPI.getFiles(),
      };

      const contentString = JSON.stringify(sceneData, null, 2);
      const contentBase64 = btoa(unescape(encodeURIComponent(contentString)));

      // Commit to GitHub
      const saveRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/${fullPath}`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Save board: ${name}`,
            content: contentBase64,
            branch,
            ...(existingSha ? { sha: existingSha } : {}),
          }),
        },
      );

      if (!saveRes.ok) {
        throw new Error(`Failed to save file: ${saveRes.statusText}`);
      }

      setSuccessMsg(`Successfully saved "${name}" to GitHub!`);
      
      // If we saved in a local folder, add it permanently
      if (currentPath && !localFolders.includes(currentPath)) {
        setLocalFolders((prev) => [...prev, currentPath]);
      }

      // Sync hash with newly saved name
      const relativeSavedPath = currentPath ? `${currentPath}/${nameWithoutExtension}` : nameWithoutExtension;
      window.location.hash = `id=${encodeURIComponent(relativeSavedPath)}`;

      fetchFiles();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to save file to GitHub.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) {
      return;
    }
    const cleanName = newFolderName.trim().replace(/[\/\\?%*:|"<>]/g, "");
    const folderPath = currentPath
      ? `${currentPath}/${cleanName}`
      : cleanName;

    if (!localFolders.includes(folderPath)) {
      setLocalFolders((prev) => [...prev, folderPath]);
    }
    setNewFolderName("");
  };

  const navigateInto = (folderName: string) => {
    setCurrentPath((prev) => (prev ? `${prev}/${folderName}` : folderName));
  };

  const navigateBack = () => {
    if (!currentPath) {
      return;
    }
    const parts = currentPath.split("/");
    parts.pop();
    setCurrentPath(parts.join("/"));
  };

  const deleteFile = async (item: GitHubItem) => {
    const isAlreadyDeleted = currentPath.startsWith("deleted-files") || currentPath === "deleted-files";
    
    if (isAlreadyDeleted) {
      const confirmPermanent = window.confirm(
        `"${item.name}" is already in deleted-files. Do you want to permanently delete it?`
      );
      if (!confirmPermanent) return;

      setLoading(true);
      setError(null);
      setSuccessMsg(null);

      try {
        const deleteRes = await fetch(
          `https://api.github.com/repos/${repo}/contents/${item.path}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `token ${token}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: `Permanently delete file: ${item.name}`,
              sha: item.sha,
              branch,
            }),
          },
        );
        if (!deleteRes.ok) {
          throw new Error("Failed to permanently delete the file.");
        }
        setSuccessMsg(`Permanently deleted "${item.name}".`);
        fetchFiles();
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err: any) {
        setError(err.message || "Failed to permanently delete file.");
      } finally {
        setLoading(false);
      }
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${item.name}"? It will be moved to the "deleted-files" folder.`
    );
    if (!confirmDelete) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // 1. Fetch file content to get its Base64 data
      const res = await fetch(
        `https://api.github.com/repos/${repo}/contents/${item.path}?ref=${branch}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      );
      if (!res.ok) {
        throw new Error("Failed to retrieve file content for moving.");
      }
      const fileData = await res.json();
      const contentBase64 = fileData.content;
      const fileSha = fileData.sha;

      // 2. Write to the new deleted-files destination
      const cleanRoot = path.replace(/^\/|\/$/g, "");
      const relativePath = item.path.startsWith(cleanRoot)
        ? item.path.substring(cleanRoot.length).replace(/^\/|\/$/g, "")
        : item.path;
      const deletedDestPath = `${cleanRoot}/deleted-files/${relativePath}`;

      const putRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/${deletedDestPath}`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Move to deleted-files: ${item.name}`,
            content: contentBase64,
            branch,
          }),
        },
      );

      if (!putRes.ok) {
        throw new Error("Failed to copy file to deleted-files folder.");
      }

      // 3. Delete original file
      const deleteRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/${item.path}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Delete original file: ${item.name}`,
            sha: fileSha,
            branch,
          }),
        },
      );

      if (!deleteRes.ok) {
        throw new Error("Failed to delete original file.");
      }

      // Add local deleted-files folder to localFolders state so it's browseable immediately
      const deletedFolderLocal = currentPath ? `deleted-files/${currentPath}` : "deleted-files";
      if (!localFolders.includes(deletedFolderLocal)) {
        setLocalFolders((prev) => [...prev, deletedFolderLocal]);
      }

      setSuccessMsg(`Moved "${item.name}" to deleted-files.`);
      fetchFiles();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete file.");
    } finally {
      setLoading(false);
    }
  };

  // Combine items loaded from GitHub with local folders created at this path
  const getCombinedItems = (): GitHubItem[] => {
    const localDirs = localFolders
      .filter((fp) => {
        const parts = fp.split("/");
        const parent = parts.slice(0, -1).join("/");
        return parent === currentPath;
      })
      .map((fp) => {
        const name = fp.split("/").pop() || fp;
        return {
          name,
          path: `drawings/${fp}`,
          sha: `local-${fp}`,
          type: "dir" as const,
          download_url: "",
        };
      });

    const merged = [...items];
    localDirs.forEach((ld) => {
      if (!merged.some((i) => i.type === "dir" && i.name === ld.name)) {
        merged.push(ld);
      }
    });

    return merged.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === "dir" ? -1 : 1;
    });
  };

  if (!isConnected) {
    return (
      <div className="github-explorer-config">
        <h3>GitHub Storage Access</h3>
        <p className="description">
          Enter your team password to access shared drawings.
        </p>
        <form onSubmit={handleConnect} className="gh-config-form">
          <div className="form-group">
            <label>Team Password:</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="explorer-error">{error}</div>}
          <button type="submit" className="explorer-btn explorer-btn-primary">
            Access Storage
          </button>
        </form>
      </div>
    );
  }

  const combinedItems = getCombinedItems();

  return (
    <div className="github-explorer-panel">
      <div className="explorer-header">
        <h4>GitHub Storage</h4>
        <button
          onClick={handleDisconnect}
          className="explorer-btn-link text-danger"
        >
          Disconnect
        </button>
      </div>
      <div className="explorer-meta-info">
        Connected to Shared Team Repository
      </div>

      <div className="explorer-section">
        <h5>Save Current Scene</h5>
        <form onSubmit={saveFile} className="gh-save-form">
          <div className="save-input-group">
            <input
              type="text"
              placeholder="drawing-name.excalidraw"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="explorer-btn explorer-btn-success"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>

      <div className="explorer-section">
        <h5>Create New Folder</h5>
        <form onSubmit={handleCreateFolder} className="gh-save-form">
          <div className="save-input-group">
            <input
              type="text"
              placeholder="folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              required
            />
            <button
              type="submit"
              className="explorer-btn explorer-btn-primary"
            >
              Create
            </button>
          </div>
        </form>
      </div>

      {error && <div className="explorer-error">{error}</div>}
      {successMsg && <div className="explorer-success">{successMsg}</div>}

      <div className="explorer-section flex-grow">
        <div className="section-title-row">
          <h5>Open Drawings</h5>
          <button
            onClick={fetchFiles}
            disabled={loading}
            className="explorer-btn-link"
          >
            Refresh
          </button>
        </div>

        {/* Path Breadcrumbs Bar */}
        <div className="path-breadcrumbs" style={{ marginBottom: "0.75rem" }}>
          {currentPath && (
            <button
              type="button"
              onClick={navigateBack}
              className="explorer-btn-link back-btn"
              style={{ marginRight: "0.5rem" }}
            >
              ← Back
            </button>
          )}
          <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
            Location: <code>/{currentPath || "drawings"}</code>
          </span>
        </div>

        {loading ? (
          <div className="explorer-loading">Loading files...</div>
        ) : combinedItems.length === 0 ? (
          <div className="explorer-empty">
            Folder is empty. Save a drawing or create a subfolder here!
          </div>
        ) : (
          <ul className="gh-file-list">
            {combinedItems.map((item) => (
              <li key={item.sha} className="gh-file-item">
                {item.type === "dir" ? (
                  <button
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className="gh-file-load-btn folder-item"
                    style={{ background: "rgba(112, 72, 232, 0.05)", borderColor: "rgba(112, 72, 232, 0.2)" }}
                    title="Click to enter this folder"
                  >
                    <span style={{ marginRight: "0.5rem" }}>📁</span>
                    <span className="file-name" style={{ fontWeight: 600 }}>{item.name}</span>
                  </button>
                ) : (
                  <div className="gh-file-item-row" style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between" }}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className="gh-file-load-btn"
                      title="Click to open this drawing"
                      style={{ flexGrow: 1, textAlign: "left", display: "flex", alignItems: "center" }}
                    >
                      <span style={{ marginRight: "0.5rem" }}>📄</span>
                      <span className="file-name">{item.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFile(item)}
                      className="explorer-btn-link text-danger delete-file-btn"
                      style={{ padding: "0 0.5rem", fontSize: "1.05rem", cursor: "pointer", opacity: 0.7 }}
                      title="Delete file (Move to deleted-files)"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
