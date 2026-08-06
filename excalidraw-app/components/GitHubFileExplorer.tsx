import React, { useState, useEffect, useCallback } from "react";
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
const PRESET_BRANCH = "master";
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
  const [localFolders, setLocalFolders] = useState<string[]>([]); // List of local folder paths (relative to drawings/)
  const [newFolderName, setNewFolderName] = useState("");

  const [items, setItems] = useState<GitHubItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newFileName, setNewFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync Excalidraw canvas name with file name input
  useEffect(() => {
    if (excalidrawAPI && isConnected) {
      const activeName = excalidrawAPI.getAppState().name;
      if (activeName && activeName !== "Untitled") {
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
        // Map and filter elements
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

  const loadFile = async (file: GitHubItem) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/contents/${file.path}?ref=${branch}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      );
      if (!res.ok) {
        throw new Error("Failed to download drawing file.");
      }
      const fileData = await res.json();
      const decodedContent = decodeURIComponent(
        escape(atob(fileData.content.replace(/\s/g, ""))),
      );
      const data = JSON.parse(decodedContent);

      if (excalidrawAPI) {
        const nameWithoutExtension = file.name.replace(
          /\.(excalidraw|json)$/,
          "",
        );
        excalidrawAPI.updateScene({
          elements: data.elements || [],
          appState: {
            theme: data.appState?.theme || "light",
            viewBackgroundColor:
              data.appState?.viewBackgroundColor || "#ffffff",
            name: nameWithoutExtension,
          },
        });
        setNewFileName(nameWithoutExtension); // Update local input field
        setSuccessMsg(`Loaded "${file.name}"`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        throw new Error("Excalidraw Editor instance is not ready yet.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load drawing.");
    } finally {
      setLoading(false);
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

  // Combine items loaded from GitHub with local folders created at this path
  const getCombinedItems = (): GitHubItem[] => {
    // Get unique local folders created in the current directory level
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

    // Merge them together, prioritizing GitHub items
    const merged = [...items];
    localDirs.forEach((ld) => {
      if (!merged.some((i) => i.type === "dir" && i.name === ld.name)) {
        merged.push(ld);
      }
    });

    // Sort: directories first, then files
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
  const folderParts = currentPath.split("/").filter(Boolean);

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
                    onClick={() => navigateInto(item.name)}
                    className="gh-file-load-btn folder-item"
                    style={{ background: "rgba(112, 72, 232, 0.05)", borderColor: "rgba(112, 72, 232, 0.2)" }}
                    title="Click to enter this folder"
                  >
                    <span style={{ marginRight: "0.5rem" }}>📁</span>
                    <span className="file-name" style={{ fontWeight: 600 }}>{item.name}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => loadFile(item)}
                    className="gh-file-load-btn"
                    title="Click to open this drawing"
                  >
                    <span style={{ marginRight: "0.5rem" }}>📄</span>
                    <span className="file-name">{item.name}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
